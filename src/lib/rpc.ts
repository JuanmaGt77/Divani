/**
 * Llamadas públicas a las funciones de Supabase (storefront, product_page, place_order) con la
 * clave publicable. Sirve en el navegador y en el servidor (Cloudflare Workers) y no necesita
 * supabase-js, así la tienda carga menos código.
 */
import { SUPABASE } from './env';

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, { status = 0, data = null }: { status?: number; data?: unknown } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const OFFLINE = 'No pudimos conectar con la tienda. Revisa tu conexión e inténtalo de nuevo.';

export async function rpc<T>(
  name: string,
  body: object = {},
  { timeout = 15000 }: { timeout?: number } = {},
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${SUPABASE.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      // Igual que supabase-js: la clave va en apikey y en Authorization
      headers: {
        apikey: SUPABASE.key,
        Authorization: `Bearer ${SUPABASE.key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      // Los mensajes de place_order ya vienen en español y listos para la clienta
      const message = (data as { message?: string } | null)?.message;
      const msg =
        res.status < 500 && message && !/function|schema|permission|JWT|apikey/i.test(message)
          ? message
          : 'No pudimos conectar con la tienda. Inténtalo de nuevo en un momento.';
      throw new ApiError(msg, { status: res.status, data });
    }
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError('La tienda tardó demasiado en responder. Revisa tu conexión.', { status: 408 });
    }
    throw new ApiError(OFFLINE);
  } finally {
    clearTimeout(timer);
  }
}
