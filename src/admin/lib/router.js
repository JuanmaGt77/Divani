/**
 * Rutas con hash (#/pedidos/DV-1001): funcionan en cualquier hosting estático
 * sin configurar redirecciones.
 */
import { useEffect, useState } from 'preact/hooks';

const parse = () => {
  const raw = location.hash.startsWith('#/') ? location.hash.slice(1) : '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path.replace(/\/+$/, '') || '/', query: Object.fromEntries(new URLSearchParams(qs)) };
};

let current = parse();
let lastHash = location.hash;
const subs = new Set();
let guard = null;

/** Evita salir de una pantalla con cambios sin guardar. guard() devuelve true si se puede salir. */
export function setLeaveGuard(fn) {
  guard = fn;
  return () => { if (guard === fn) guard = null; };
}

/** ¿Se puede salir de la pantalla actual? (pregunta si hay cambios sin guardar) */
export const canLeave = () => !guard || guard();

window.addEventListener('hashchange', () => {
  if (guard && !guard()) {
    history.replaceState(history.state, '', lastHash || '#/');
    return;
  }
  lastHash = location.hash;
  current = parse();
  subs.forEach((fn) => fn(current));
});
window.addEventListener('beforeunload', (e) => {
  if (guard && !guard(true)) { e.preventDefault(); e.returnValue = ''; }
});

export function navigate(to, { replace = false } = {}) {
  const hash = `#${to.startsWith('/') ? to : `/${to}`}`;
  if (replace) {
    history.replaceState(history.state, '', hash);
    lastHash = hash;
    current = parse();
    subs.forEach((fn) => fn(current));
  } else {
    location.hash = hash;
  }
}

export function useRoute() {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    subs.add(setRoute);
    setRoute(current);
    return () => subs.delete(setRoute);
  }, []);
  return route;
}

/** Compara un patrón «/pedidos/:id» con la ruta y devuelve los parámetros o null. */
export function match(pattern, path) {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export const href = (to) => `#${to}`;

/** Actualiza los parámetros de la URL actual sin crear historial (filtros). */
export function setQuery(patch) {
  const q = { ...current.query, ...patch };
  Object.keys(q).forEach((k) => (q[k] === '' || q[k] == null) && delete q[k]);
  const qs = new URLSearchParams(q).toString();
  navigate(`${current.path}${qs ? `?${qs}` : ''}`, { replace: true });
}
