/**
 * Configuración de Estudio IA. Todo se puede cambiar con variables del Worker
 * (`npx wrangler secret put …` o, en tu computadora, el archivo .dev.vars).
 */
export interface ConfigEstudio {
  /** Clave de OpenAI. Solo vive en el servidor, nunca llega al navegador. */
  openaiKey: string;
  openaiBaseUrl: string;
  /** Llave de la cola para entrar a las funciones estudio_worker_* de Supabase. */
  workerToken: string;
  /** Modo demostración: no llama a OpenAI, devuelve resultados de ejemplo. */
  demo: boolean;
  demoRapido: boolean;
  /** Sunburst es el modelo de OpenAI pensado para ediciones precisas. */
  imageModel: string;
  /** low | medium | high | xhigh | max */
  imageQuality: string;
  /** 4:5 vertical, múltiplos de 16 (mismo formato que el catálogo de Divani). */
  imageSize: string;
  /** Cuánto «planea» el modelo antes de dibujar (solo modelos 2.6): low | medium | high. */
  complexityPrenda: string;
  complexityModelo: string;
  /** «low» evita bloqueos falsos con tops deportivos o trajes de baño; «auto» es el filtro estándar. */
  moderation: string;
  outputCompression: number;
  /** Modelo de texto que mira las fotos, elige modelo y escribe la ficha. */
  textModel: string;
  /** none | low | medium | high */
  textReasoning: string;
  /** Valor fijo para el campo «Origen» de la ficha. */
  origen: string;
  /** Cuántas prendas pueden procesarse a la vez, para cuidar el gasto. */
  maxTrabajosActivos: number;
}

export const MAX_FOTOS = 4;

/** La cola corta cada paso a este tiempo. Supabase da un paso por cortado a los 12 minutos. */
export const PLAZO_PASO_MS = 11 * 60_000;
/** Cloudflare corta cada invocación de la cola a los 15 minutos. */
export const PLAZO_INVOCACION_MS = 14.5 * 60_000;

type Variables = Record<string, unknown>;

export function leerConfig(env: Variables): ConfigEstudio {
  const v = (nombre: string, def = ''): string => String(env[nombre] ?? def).trim() || def;
  const si = (nombre: string): boolean => ['1', 'true'].includes(v(nombre).toLowerCase());
  return {
    openaiKey: v('OPENAI_API_KEY'),
    openaiBaseUrl: v('OPENAI_BASE_URL', 'https://api.openai.com/v1').replace(/\/+$/, ''),
    workerToken: v('ESTUDIO_WORKER_TOKEN'),
    demo: si('ESTUDIO_DEMO'),
    demoRapido: si('ESTUDIO_DEMO_RAPIDO'),
    imageModel: v('IMAGE_MODEL', 'gpt-image-2.6-sunburst'),
    imageQuality: v('IMAGE_QUALITY', 'high'),
    imageSize: v('IMAGE_SIZE', '1152x1440'),
    complexityPrenda: v('IMAGE_COMPLEXITY_PRENDA', 'medium'),
    complexityModelo: v('IMAGE_COMPLEXITY_MODELO', 'high'),
    moderation: v('IMAGE_MODERATION', 'low'),
    outputCompression: Number(v('IMAGE_JPEG_QUALITY', '92')),
    textModel: v('TEXT_MODEL', 'gpt-6.1-terra'),
    textReasoning: v('TEXT_REASONING', 'low'),
    origen: v('ORIGEN', 'Importado de EE. UU.'),
    maxTrabajosActivos: Number(v('MAX_TRABAJOS_ACTIVOS', '3')),
  };
}
