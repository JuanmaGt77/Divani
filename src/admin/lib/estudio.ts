/**
 * Estudio IA en el panel: preparar las fotos, guardar el trabajo en curso de este teléfono y
 * convertir un trabajo en lo que necesita el editor de producto.
 */
import { COLOR_FAMILIES, guessFamily } from '@/lib/model';
import type { Taxonomy } from '@/lib/types';
import type { Ficha, NombrePaso, Trabajo } from '@/estudio/tipos';

const LLAVE_TRABAJO = 'divani.estudio.trabajo';
const LADO_FOTO = 2048;
const TONO_POR_DEFECTO = '#D9C6A6';

export const trabajoGuardado = (): string | null => {
  try {
    return localStorage.getItem(LLAVE_TRABAJO);
  } catch {
    return null;
  }
};

export const guardarTrabajo = (id: string | null): void => {
  try {
    if (id) localStorage.setItem(LLAVE_TRABAJO, id);
    else localStorage.removeItem(LLAVE_TRABAJO);
  } catch {
    /* modo privado */
  }
};

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => mal(new Error('No se pudo leer esa foto. Prueba con otra.'));
    im.src = src;
  });
}

/** Reduce la foto a 2048 px y la pasa a JPG: sube más rápido y la IA la acepta siempre. */
export async function prepararFoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const im = await cargarImagen(url);
    const k = Math.min(1, LADO_FOTO / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.max(1, Math.round(im.naturalWidth * k));
    const h = Math.max(1, Math.round(im.naturalHeight * k));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo preparar la foto.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(im, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.88));
    if (!blob) throw new Error('No se pudo preparar la foto.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Cloudinary guarda en WebP; para el teléfono se descarga en JPG, que abre en cualquier parte. */
export function urlJpg(url: string): string {
  const i = url.indexOf('/upload/');
  if (i < 0) return url;
  return `${url.slice(0, i + 8)}f_jpg,q_92/${url.slice(i + 8).replace(/\.[a-z0-9]+$/i, '.jpg')}`;
}

export const nombreArchivo = (nombre: string | undefined, tipo: 'modelo' | 'prenda'): string => {
  const slug =
    String(nombre || 'prenda')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'prenda';
  return `divani-${slug}-${tipo === 'modelo' ? 'modelo' : 'gancho'}.jpg`;
};

export const tiempo = (s: number): string =>
  s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;

export const pasoOcupado = (t: Trabajo, paso: NombrePaso): boolean =>
  t.pasos[paso].estado === 'trabajando' || t.pasos[paso].estado === 'en_cola';

/** La foto de ese paso, solo si la última generación terminó bien. */
export const fotoLista = (t: Trabajo, tipo: 'modelo' | 'prenda'): string | null =>
  t.pasos[tipo].estado === 'listo' ? t.imagenes[tipo] : null;

export const puedeImportar = (t: Trabajo): boolean =>
  !!t.ficha && !pasoOcupado(t, 'ficha') && !!(fotoLista(t, 'modelo') || fotoLista(t, 'prenda'));

const NOMBRE_FOTO = { modelo: 'La foto con modelo', prenda: 'La foto en gancho' } as const;

/** Por qué una foto no se va a importar (para avisarlo antes y en el editor). */
export function fotosSinImportar(t: Trabajo): string[] {
  return (['modelo', 'prenda'] as const)
    .filter((tipo) => !fotoLista(t, tipo))
    .map((tipo) => `${NOMBRE_FOTO[tipo]} no está lista y no se importa.`);
}

/** Lo que el editor de producto llena con un trabajo. Precio, costo y existencias quedan para ti. */
export interface ImportEstudio {
  name: string;
  description: string;
  detailsText: string;
  material: string;
  care: string;
  origin: string;
  department: string | null;
  category: string;
  tags: string[];
  color: { name: string; hex: string; family: string; images: string[] };
  /** La talla de la etiqueta, si se leyó. */
  size: string | null;
  avisos: string[];
}

export function importarTrabajo(t: Trabajo, ficha: Ficha, tax: Taxonomy | undefined): ImportEstudio {
  const hex = ficha.color_hex || TONO_POR_DEFECTO;
  const department = tax?.departments.find((d) => d.slug === ficha.departamento)?.slug ?? null;
  // Se revisa contra los registros de hoy: la categoría pudo borrarse desde que se generó
  const category = tax?.categories.find((c) => c.slug === ficha.categoria && c.department === department)?.slug ?? '';
  const images = [fotoLista(t, 'modelo'), fotoLista(t, 'prenda')].filter((u): u is string => !!u);
  const avisos = [...ficha.avisos];
  if (!ficha.material_de_etiqueta && ficha.material) {
    avisos.push('Material estimado por la IA: confírmalo con la etiqueta.');
  }
  if (!ficha.cuidados_de_etiqueta && ficha.cuidados) {
    avisos.push('Cuidados estimados por la IA: confírmalos con la etiqueta.');
  }
  if (ficha.categoria && !category) avisos.push('La categoría que eligió la IA ya no existe; elige otra.');
  avisos.push(...fotosSinImportar(t));
  return {
    name: ficha.nombre,
    description: ficha.descripcion,
    detailsText: ficha.detalles.join('\n'),
    material: ficha.material,
    care: ficha.cuidados,
    origin: ficha.origen,
    department,
    category,
    tags: ficha.etiquetas,
    color: {
      name: ficha.color,
      hex,
      family: COLOR_FAMILIES.some((f) => f.id === ficha.familia_color) ? ficha.familia_color : guessFamily(hex),
      images,
    },
    size: ficha.talla || null,
    avisos,
  };
}
