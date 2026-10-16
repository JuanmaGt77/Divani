// Lectura y escritura de parámetros de la URL (filtros compartibles, producto abierto).

export function getParams() {
  return new URLSearchParams(location.search);
}

export function setParams(obj, { replace = true } = {}) {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length) || v === false) p.delete(k);
    else p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const qs = p.toString();
  const url = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
  try {
    history[replace ? 'replaceState' : 'pushState'](history.state, '', url);
  } catch { /* algunos visores no permiten modificar el historial */ }
}

export const listParam = (p, key) => (p.get(key) || '').split(',').map((s) => s.trim()).filter(Boolean);

/** Enlace compartible a un producto (abre la vista rápida en la tienda). */
export function productUrl(slug, base) {
  const origin = base || `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
  return `${origin.replace(/\/?$/, '/')}tienda.html?p=${encodeURIComponent(slug)}`;
}
