/**
 * Cliente mínimo para la API de OpenAI (sin dependencias): análisis con la Responses API y
 * edición de imágenes con la Images API. Las fotos se mandan por dirección (`image_url`), así el
 * Worker no carga con ellas. Los mensajes de error ya vienen en español para mostrarlos tal cual.
 */
import type { ConfigEstudio } from './config';
import { esquemaAnalisis, promptAnalisis, type ContextoAnalisis } from './prompts';

interface OpcionesError {
  codigo?: string | null;
  status?: number | null;
  reintentable?: boolean;
  detalle?: string | null;
}

export class ErrorIA extends Error {
  codigo: string | null;
  status: number | null;
  reintentable: boolean;
  detalle: string | null;
  constructor(
    mensaje: string,
    { codigo = null, status = null, reintentable = false, detalle = null }: OpcionesError = {},
  ) {
    super(mensaje);
    this.name = 'ErrorIA';
    this.codigo = codigo;
    this.status = status;
    this.reintentable = reintentable;
    this.detalle = detalle;
  }
}

/** Lo que se puede cambiar en las pruebas: la red y el reloj. */
export interface Herramientas {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  esperar: (ms: number) => Promise<void>;
  ahora: () => number;
}

export const herramientasReales: Herramientas = {
  // Dentro de una función: en los Workers, fetch falla si se llama como método de otro objeto
  fetch: (url, init) => fetch(url, init),
  esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
  ahora: () => Date.now(),
};

interface ErrorApi {
  code?: string | null;
  type?: string | null;
  param?: string | null;
  message?: string | null;
}

/** Parámetros opcionales que se pueden quitar si algún modelo no los acepta. */
const OPCIONALES = ['complexity', 'moderation', 'output_compression', 'reasoning', 'max_output_tokens'];
/** Se recuerda qué parámetro rechazó cada modelo mientras viva esta instancia del Worker. */
const rechazados = new Set<string>();

/** Solo para las pruebas. */
export const olvidarRechazados = (): void => rechazados.clear();

function traducirError(status: number, err: ErrorApi | null, texto: string): ErrorIA {
  const codigo = err?.code || null;
  const tipo = err?.type || '';
  const msg = (err?.message || texto || '').toString();
  const bajo = msg.toLowerCase();

  if (status === 401) {
    return new ErrorIA('La clave de OpenAI no es válida. Revisa OPENAI_API_KEY en el servidor.', { codigo, status });
  }
  if (status === 403 && (bajo.includes('verif') || bajo.includes('organization'))) {
    return new ErrorIA(
      'Tu organización de OpenAI debe estar verificada para usar los modelos de imagen (platform.openai.com → Settings → Organization → General).',
      { codigo, status },
    );
  }
  if (status === 429 && (codigo === 'insufficient_quota' || bajo.includes('quota') || bajo.includes('billing'))) {
    return new ErrorIA(
      'La cuenta de OpenAI se quedó sin saldo o llegó a su límite de gasto. Recarga créditos y vuelve a intentar.',
      { codigo, status },
    );
  }
  if (codigo === 'moderation_blocked') {
    return new ErrorIA(
      'El filtro de seguridad de OpenAI bloqueó esta imagen. Vuelve a intentarlo; si se repite, prueba con otra modelo o con otra foto de la prenda.',
      { codigo, status },
    );
  }
  if (tipo === 'image_generation_user_error') {
    return new ErrorIA(`OpenAI no pudo generar la imagen: ${msg}`, { codigo, status });
  }
  if (status === 429 || status >= 500) {
    return new ErrorIA('OpenAI está saturado en este momento. Intenta de nuevo en un minuto.', {
      codigo,
      status,
      reintentable: true,
      detalle: msg,
    });
  }
  return new ErrorIA(`Error de OpenAI (${status}): ${msg.slice(0, 300)}`, { codigo, status, detalle: msg });
}

const espera = (intento: number): number =>
  Math.min(20000, 1500 * 2 ** (intento - 1)) + Math.floor(Math.random() * 800);

const TARDO = 'OpenAI tardó demasiado en responder. Intenta de nuevo.';

interface OpcionesLlamada {
  timeoutMs: number;
  intentos?: number;
  etiqueta?: string;
  /** Momento (Date.now) en que el paso ya no puede seguir. */
  limite?: number | undefined;
  h: Herramientas;
}

async function llamar<T>(
  cfg: ConfigEstudio,
  ruta: string,
  cuerpo: Record<string, unknown>,
  { timeoutMs, intentos = 3, etiqueta = ruta, limite, h }: OpcionesLlamada,
): Promise<T> {
  const body = { ...cuerpo };
  for (const p of OPCIONALES) if (rechazados.has(`${String(body.model)}:${p}`)) delete body[p];
  let intento = 0;
  let quitados = 0;

  while (true) {
    intento++;
    const resta = limite === undefined ? timeoutMs : Math.min(timeoutMs, limite - h.ahora());
    if (resta <= 0) throw new ErrorIA(TARDO, { reintentable: true });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), resta);
    let res: Response;
    let texto: string;
    try {
      res = await h.fetch(`${cfg.openaiBaseUrl}${ruta}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      texto = await res.text();
    } catch (e) {
      clearTimeout(timer);
      const tiempo = (e as Error).name === 'AbortError';
      const error = new ErrorIA(tiempo ? TARDO : 'No se pudo conectar con OpenAI.', {
        reintentable: true,
        detalle: (e as Error).message,
      });
      // Si se agotó el tiempo no reintentamos: la imagen pudo haberse cobrado.
      if (!tiempo && intento < intentos) {
        await h.esperar(espera(intento));
        continue;
      }
      throw error;
    }
    clearTimeout(timer);

    let json: unknown = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      /* respuesta no JSON */
    }

    if (res.ok) {
      if (!json) throw new ErrorIA('OpenAI devolvió una respuesta vacía o inválida.');
      return json as T;
    }

    const err = (json as { error?: ErrorApi } | null)?.error || null;

    // Si el modelo no acepta un parámetro opcional, lo quitamos y repetimos.
    if (res.status === 400 && quitados < OPCIONALES.length) {
      const msg = `${err?.param || ''} ${err?.message || ''}`.toLowerCase();
      const param = OPCIONALES.find((p) => p in body && msg.includes(p));
      if (param && err?.code !== 'moderation_blocked') {
        console.warn(`[openai] ${etiqueta}: el modelo no acepta "${param}", se reintenta sin él.`);
        delete body[param];
        rechazados.add(`${String(body.model)}:${param}`);
        quitados++;
        intento--;
        continue;
      }
    }

    const error = traducirError(res.status, err, texto);
    if (error.reintentable && intento < intentos) {
      const retryAfter = Number(res.headers.get('retry-after'));
      await h.esperar(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : espera(intento));
      continue;
    }
    throw error;
  }
}

export interface Uso {
  input_tokens?: number;
  output_tokens?: number;
}

/** Una imagen lista para subir: `archivo` es un data URL o una dirección https. */
export interface ImagenGenerada {
  archivo: string;
  uso: Uso | null;
}

export async function editarImagen(
  {
    imagenes,
    prompt,
    complexity,
    limite,
  }: { imagenes: string[]; prompt: string; complexity?: string; limite?: number },
  cfg: ConfigEstudio,
  h: Herramientas = herramientasReales,
): Promise<ImagenGenerada> {
  const cuerpo: Record<string, unknown> = {
    model: cfg.imageModel,
    prompt,
    images: imagenes.map((image_url) => ({ image_url })),
    size: cfg.imageSize,
    quality: cfg.imageQuality,
    output_format: 'jpeg',
    output_compression: cfg.outputCompression,
    n: 1,
  };
  if (cfg.moderation) cuerpo.moderation = cfg.moderation;
  if (complexity && /2\.6/.test(cfg.imageModel)) cuerpo.complexity = complexity;

  const json = await llamar<{ data?: { b64_json?: string }[]; usage?: Uso }>(cfg, '/images/edits', cuerpo, {
    timeoutMs: 6 * 60_000,
    intentos: 3,
    etiqueta: 'images/edits',
    limite,
    h,
  });
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new ErrorIA('OpenAI no devolvió ninguna imagen. Intenta de nuevo.');
  // Sin decodificar: Cloudinary recibe el data URL tal cual y así el Worker gasta menos
  return { archivo: `data:image/jpeg;base64,${b64}`, uso: json.usage || null };
}

interface RespuestaAnalisis {
  status?: string;
  output_text?: string;
  output?: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[];
  usage?: Uso;
}

export async function analizarPrenda(
  fotos: string[],
  ctx: ContextoAnalisis,
  cfg: ConfigEstudio,
  { limite, h = herramientasReales }: { limite?: number; h?: Herramientas } = {},
): Promise<{ ficha: Record<string, unknown>; uso: Uso | null }> {
  const cuerpo: Record<string, unknown> = {
    model: cfg.textModel,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: promptAnalisis(ctx) },
          ...fotos.map((image_url) => ({ type: 'input_image', image_url })),
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'ficha_divani',
        strict: true,
        schema: esquemaAnalisis(ctx),
      },
    },
    max_output_tokens: 6000,
  };
  if (cfg.textReasoning && cfg.textReasoning !== 'default') {
    cuerpo.reasoning = { effort: cfg.textReasoning };
  }

  const json = await llamar<RespuestaAnalisis>(cfg, '/responses', cuerpo, {
    timeoutMs: 3 * 60_000,
    intentos: 3,
    etiqueta: 'responses',
    limite,
    h,
  });

  let texto = typeof json.output_text === 'string' ? json.output_text : '';
  if (!texto) {
    for (const item of json.output || []) {
      if (item.type !== 'message') continue;
      for (const c of item.content || []) {
        if (c.type === 'output_text') texto += c.text || '';
        if (c.type === 'refusal') throw new ErrorIA(`La IA no quiso analizar la prenda: ${c.refusal}`);
      }
    }
  }
  if (json.status === 'incomplete' && !texto) {
    throw new ErrorIA('La IA no terminó de escribir la ficha. Intenta de nuevo.');
  }
  let ficha: Record<string, unknown>;
  try {
    ficha = JSON.parse(texto) as Record<string, unknown>;
  } catch {
    throw new ErrorIA('La IA devolvió la ficha en un formato inesperado. Intenta de nuevo.', {
      detalle: texto.slice(0, 300),
    });
  }
  return { ficha, uso: json.usage || null };
}
