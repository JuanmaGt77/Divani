import { API } from '../../config/site.config.js';

export class ApiError extends Error {
  constructor(message, { status = 0, data = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Cliente HTTP para el backend REST.
 * http('/products', { params: { department: 'mujer' } })
 * http('/orders', { method: 'POST', body: {...} })
 */
export async function http(path, { method = 'GET', params, body, headers, signal, timeout = API.timeout } = {}) {
  const url = new URL(`${API.baseUrl}${path}`, location.href);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
      url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
  try {
    const res = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      credentials: 'omit',
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(data?.error?.message || `Error ${res.status}`, { status: res.status, data });
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new ApiError('La solicitud tardó demasiado. Revisa tu conexión.', { status: 408 });
    if (err instanceof ApiError) throw err;
    throw new ApiError('No pudimos conectar con la tienda. Revisa tu conexión e inténtalo de nuevo.');
  } finally {
    clearTimeout(timer);
  }
}
