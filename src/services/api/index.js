/**
 * Punto único de acceso a datos de la tienda. Elige el origen según la configuración:
 *  - VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY → Supabase (tienda real).
 *  - VITE_API_URL → un backend REST propio (ver docs/API.md).
 *  - Sin variables → modo demostración: si el panel ya se abrió en este navegador, la
 *    tienda muestra esos datos (y registra ahí los pedidos); si no, el catálogo de muestra
 *    de public/data/*.json.
 */
import { API } from '../../config/site.config.js';
import { hasSupabase } from '../../backend/config.js';
import { mockAdapter } from './mock.adapter.js';
import { restAdapter } from './rest.adapter.js';
import { supabaseAdapter } from './supabase.adapter.js';
import { demoAdapter, demoAvailable } from './demo.adapter.js';

export const dataSource = hasSupabase ? 'supabase' : API.baseUrl ? 'rest' : 'local';

/** Modo local: se decide una sola vez (y sin bloquear) si hay datos del panel en este navegador. */
let localPick = null;
const pickLocal = () => (localPick ??= demoAvailable().then((ok) => (ok ? demoAdapter : mockAdapter)));

const METHODS = ['getSettings', 'getContent', 'getBanners', 'getFaq', 'getLookbooks', 'getCategories', 'listProducts', 'getProduct', 'createOrder', 'subscribe'];
const localAdapter = Object.fromEntries(METHODS.map((m) => [m, async (...args) => {
  const a = await pickLocal();
  return a[m] ? a[m](...args) : null;
}]));
localAdapter.name = 'local';

export const api = dataSource === 'supabase' ? supabaseAdapter : dataSource === 'rest' ? restAdapter : localAdapter;

/** ¿Los pedidos se registran en una base de datos (y no solo se envían por WhatsApp)? */
export async function registersOrders() {
  if (dataSource === 'supabase' || dataSource === 'rest') return true;
  return (await pickLocal()).registersOrders === true;
}

/** true cuando la tienda usa el catálogo de muestra de public/data. */
export const usingMockData = dataSource === 'local';
export { ApiError } from './http.js';
