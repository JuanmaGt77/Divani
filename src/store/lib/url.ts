/** Direcciones de la tienda y parámetros de la URL (filtros compartibles, producto abierto). */

/** Página de un producto: /producto/vestido-slip-satinado */
export const productPath = (slug: string): string => `/producto/${encodeURIComponent(slug)}`;

/** Enlace completo a un producto (para compartir por WhatsApp o redes). */
export function productUrl(slug: string): string {
  const origin = typeof location === 'undefined' ? '' : location.origin;
  return `${origin}${productPath(slug)}`;
}

export const shopUrl = (params: Record<string, string> = {}): string => {
  const qs = new URLSearchParams(params).toString();
  return `/tienda${qs ? `?${qs}` : ''}`;
};

export const getParams = (): URLSearchParams =>
  new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

/** Cambia parámetros de la URL sin recargar (por defecto, sin crear historial). */
export function setParams(
  obj: Record<string, string | string[] | boolean | null | undefined>,
  { replace = true } = {},
): void {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '' || v === false || (Array.isArray(v) && !v.length)) p.delete(k);
    else p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const qs = p.toString();
  const url = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
  try {
    history[replace ? 'replaceState' : 'pushState'](history.state, '', url);
  } catch {
    /* algunos visores no permiten modificar el historial */
  }
}

export const listParam = (p: URLSearchParams, key: string): string[] =>
  (p.get(key) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
