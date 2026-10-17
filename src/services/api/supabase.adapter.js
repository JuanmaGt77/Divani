/**
 * Tienda conectada a Supabase. Usa solo la clave publicable (pública por diseño):
 *  - rpc/storefront → todo lo que la tienda muestra, en una sola llamada.
 *  - rpc/place_order → registra el pedido (valida existencias y precios en el servidor).
 * Las reglas de seguridad (RLS) viven en supabase/schema.sql.
 */
import { SUPABASE } from '../../backend/config.js';
import { ApiError } from './http.js';
import { payloadAdapter } from './payload.adapter.js';

const CACHE_KEY = 'divani.storefront.v1';

async function rpc(name, body = {}, { timeout = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${SUPABASE.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      // Igual que supabase-js: la clave va en apikey y en Authorization
      headers: { apikey: SUPABASE.key, Authorization: `Bearer ${SUPABASE.key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      credentials: 'omit',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // Los mensajes de place_order ya vienen en español y listos para la clienta
      const msg = res.status < 500 && data?.message && !/function|schema|permission|JWT|apikey/i.test(data.message)
        ? data.message
        : 'No pudimos conectar con la tienda. Inténtalo de nuevo en un momento.';
      throw new ApiError(msg, { status: res.status, data });
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new ApiError('La tienda tardó demasiado en responder. Revisa tu conexión.', { status: 408 });
    if (err instanceof ApiError) throw err;
    throw new ApiError('No pudimos conectar con la tienda. Revisa tu conexión e inténtalo de nuevo.');
  } finally {
    clearTimeout(timer);
  }
}

/** Último paquete guardado (para pintar al instante y como respaldo sin conexión). */
export function cachedPayload() {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return v?.data && v.url === SUPABASE.url ? v : null;
  } catch {
    return null;
  }
}

async function loadPayload() {
  try {
    const data = await rpc('storefront');
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), url: SUPABASE.url, data })); } catch { /* sin espacio */ }
    return data;
  } catch (err) {
    const cached = cachedPayload();
    if (cached) return cached.data;
    throw err;
  }
}

export const supabaseAdapter = payloadAdapter({
  name: 'supabase',
  load: loadPayload,
  placeOrder: (payload) => rpc('place_order', { payload }),
});
