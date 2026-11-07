/**
 * El flujo de una prenda, ya sin memoria: cada mensaje de la cola es un paso y todo el estado vive
 * en Supabase, así el trabajo sigue aunque el teléfono se apague. La foto en gancho corre en
 * paralelo con la ficha; la foto con modelo va después porque usa la modelo elegida.
 */
import { COLOR_FAMILIES } from '@/lib/model';
import { PLAZO_INVOCACION_MS, PLAZO_PASO_MS, type ConfigEstudio } from './config';
import { MODELOS, modeloPorId } from './modelos';
import { ErrorIA, type ImagenGenerada, type Uso } from './openai';
import type { ContextoAnalisis } from './prompts';
import type { Contexto, Ficha, MensajeCola, NombrePaso } from './tipos';

/** Lo que se guarda al cerrar un paso (ver estudio_worker_terminar). */
export interface ResultadoPaso {
  estado: 'listo' | 'error' | 'omitido';
  error?: string;
  nota?: string;
  url?: string;
  ficha?: Ficha;
  modeloId?: string | null;
  motivo?: string | null;
}

export interface BaseEstudio {
  contexto(id: string): Promise<Contexto | null>;
  tomar(id: string, paso: NombrePaso, intento: number): Promise<boolean>;
  elegir(id: string, modelo: string, motivo: string): Promise<void>;
  terminar(id: string, paso: NombrePaso, intento: number, datos: ResultadoPaso): Promise<boolean>;
}

export interface Servicios {
  cfg: ConfigEstudio;
  db: BaseEstudio;
  analizar(
    fotos: string[],
    ctx: ContextoAnalisis,
    limite: number,
  ): Promise<{ ficha: Record<string, unknown>; uso: Uso | null }>;
  imagenPrenda(fotos: string[], limite: number): Promise<ImagenGenerada>;
  imagenModelo(referencia: string, fotos: string[], ficha: Ficha | null, limite: number): Promise<ImagenGenerada>;
  /** Sube el resultado a Cloudinary (en WebP) y devuelve su dirección. */
  subir(archivo: string): Promise<string>;
  ahora(): number;
}

const limpio = (s: unknown): string => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
const lista = (v: unknown, max: number): string[] =>
  (Array.isArray(v) ? v : []).map(limpio).filter(Boolean).slice(0, max);

/** Deja la ficha lista para guardar, comparando lo que dijo la IA con los registros reales. */
export function normalizarFicha(
  f: Record<string, unknown>,
  ctx: Pick<Contexto, 'departamentos' | 'categorias'>,
  cfg: Pick<ConfigEstudio, 'origen'>,
): Ficha {
  const depto = ctx.departamentos.find((d) => d.slug === f.departamento);
  const cat = ctx.categorias.find((c) => c.slug === f.categoria);
  // La categoría debe ser del mismo departamento; si no, se elige a mano en el editor
  const categoria = cat && cat.department === depto?.slug ? cat : null;
  const avisos = lista(f.avisos, 5);
  if (cat && !categoria) avisos.push('La categoría no coincide con el departamento; elígela a mano.');
  const hex = limpio(f.color_hex).toUpperCase();
  return {
    tipo_prenda: limpio(f.tipo_prenda),
    departamento: depto?.slug || '',
    departamento_nombre: depto?.name || '',
    grupo: limpio(f.grupo),
    estilo: limpio(f.estilo),
    nombre: limpio(f.nombre),
    descripcion: limpio(f.descripcion),
    detalles: lista(f.detalles, 6),
    material: limpio(f.material),
    material_de_etiqueta: !!f.material_de_etiqueta,
    cuidados: limpio(f.cuidados),
    cuidados_de_etiqueta: !!f.cuidados_de_etiqueta,
    origen: cfg.origen,
    color: limpio(f.color),
    color_hex: /^#[0-9A-F]{6}$/.test(hex) ? hex : '',
    familia_color: COLOR_FAMILIES.some((x) => x.id === f.familia_color) ? String(f.familia_color) : '',
    categoria: categoria?.slug || '',
    categoria_nombre: categoria?.name || (f.categoria === 'otra' ? 'Otra (elígela tú)' : ''),
    talla: limpio(f.talla),
    marca_visible: limpio(f.marca_visible),
    etiquetas: lista(f.etiquetas, 4).map((e) => e.toLowerCase()),
    avisos,
  };
}

function log(id: string, msg: string, error = false): void {
  (error ? console.error : console.log)(`[estudio ${id.slice(0, 8)}] ${msg}`);
}

function logUso(id: string, paso: string, uso: Uso | null): void {
  if (!uso) return;
  const partes: string[] = [];
  if (uso.input_tokens != null) partes.push(`entrada ${uso.input_tokens}`);
  if (uso.output_tokens != null) partes.push(`salida ${uso.output_tokens}`);
  if (partes.length) log(id, `${paso}: tokens ${partes.join(' · ')}`);
}

/** Reserva el paso, lo corre y guarda el resultado. Nunca lanza: un fallo queda en la base. */
async function correrPaso(
  s: Servicios,
  id: string,
  paso: NombrePaso,
  intento: number,
  fn: () => Promise<Omit<ResultadoPaso, 'estado'>>,
): Promise<void> {
  if (!(await s.db.tomar(id, paso, intento))) return;
  const inicio = s.ahora();
  let datos: ResultadoPaso;
  try {
    datos = { estado: 'listo', ...(await fn()) };
    log(id, `${paso} listo en ${((s.ahora() - inicio) / 1000).toFixed(1)} s`);
  } catch (e) {
    const detalle = e instanceof ErrorIA && e.detalle ? ` | ${e.detalle}` : '';
    log(id, `${paso} falló: ${(e as Error).message}${detalle}`, true);
    datos = {
      estado: 'error',
      error: e instanceof ErrorIA ? e.message : 'Ocurrió un error inesperado. Intenta de nuevo.',
    };
  }
  await s.db.terminar(id, paso, intento, datos);
}

async function pasoPrenda(s: Servicios, ctx: Contexto, intento: number, limite: number): Promise<void> {
  await correrPaso(s, ctx.id, 'prenda', intento, async () => {
    const res = await s.imagenPrenda(ctx.fotos, limite);
    logUso(ctx.id, 'prenda', res.uso);
    return { url: await s.subir(res.archivo) };
  });
}

async function pasoFicha(s: Servicios, ctx: Contexto, intento: number, limite: number): Promise<void> {
  await correrPaso(s, ctx.id, 'ficha', intento, async () => {
    const { ficha, uso } = await s.analizar(ctx.fotos, ctx, limite);
    logUso(ctx.id, 'ficha', uso);
    const elegida = typeof ficha.modelo_id === 'string' ? modeloPorId(ficha.modelo_id) : undefined;
    return {
      ficha: normalizarFicha(ficha, ctx, s.cfg),
      modeloId: elegida?.id || null,
      motivo: limpio(ficha.motivo_modelo) || null,
    };
  });
}

async function generarModelo(s: Servicios, ctx: Contexto, intento: number, limite: number): Promise<void> {
  await correrPaso(s, ctx.id, 'modelo', intento, async () => {
    const modelo = modeloPorId(ctx.modeloId);
    if (!modelo) throw new ErrorIA('Elige una modelo primero.');
    const res = await s.imagenModelo(modelo.referencia, ctx.fotos, ctx.ficha, limite);
    logUso(ctx.id, 'modelo', res.uso);
    return { url: await s.subir(res.archivo) };
  });
}

/** Después de la ficha: decide si hay foto con modelo y con cuál. */
async function seguirConModelo(s: Servicios, id: string, limite: number): Promise<void> {
  const ctx = await s.db.contexto(id);
  if (!ctx) return;
  const intento = ctx.pasos.modelo.intento;
  if (ctx.modeloPorIA && ctx.ficha && ctx.ficha.departamento !== 'mujer') {
    const nombre = ctx.ficha.departamento_nombre.toLowerCase() || 'otro departamento';
    await s.db.terminar(id, 'modelo', intento, {
      estado: 'omitido',
      nota: `La prenda parece de ${nombre} y las modelos son para ropa de mujer. Si quieres la foto igual, elige una modelo abajo.`,
    });
    return;
  }
  if (!ctx.modeloId) {
    // Sin análisis (o sin elección): usamos la modelo menos usada.
    const menosUsada = [...MODELOS].sort(
      (a, b) => (ctx.uso[a.id] || 0) - (ctx.uso[b.id] || 0),
    )[0] as (typeof MODELOS)[0];
    await s.db.elegir(id, menosUsada.id, 'Elegida automáticamente por ser la menos usada.');
    ctx.modeloId = menosUsada.id;
  }
  await generarModelo(s, ctx, intento, limite);
}

/** Atiende un mensaje de la cola. */
export async function procesarMensaje(msg: MensajeCola, s: Servicios): Promise<void> {
  const fin = s.ahora() + PLAZO_INVOCACION_MS;
  const limite = (): number => Math.min(s.ahora() + PLAZO_PASO_MS, fin);
  const ctx = await s.db.contexto(msg.trabajoId);
  if (!ctx) return;
  if (msg.paso === 'prenda') await pasoPrenda(s, ctx, msg.intento, limite());
  else if (msg.paso === 'modelo') await generarModelo(s, ctx, msg.intento, limite());
  else {
    await pasoFicha(s, ctx, msg.intento, limite());
    if (msg.encadenar) await seguirConModelo(s, ctx.id, limite());
  }
}
