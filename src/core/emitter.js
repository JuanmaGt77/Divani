// Estado observable mínimo: get / set / subscribe.

export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(next) {
      state = typeof next === 'function' ? next(state) : next;
      subs.forEach((fn) => fn(state));
    },
    subscribe(fn, { immediate = true } = {}) {
      subs.add(fn);
      if (immediate) fn(state);
      return () => subs.delete(fn);
    },
  };
}

// Bus de eventos de la app (abrir hojas, toasts, etc.)
const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export const listen = (type, fn) => {
  const h = (e) => fn(e.detail);
  bus.addEventListener(type, h);
  return () => bus.removeEventListener(type, h);
};
