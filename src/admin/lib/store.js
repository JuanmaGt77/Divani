/** Estado global mínimo con suscripción + hook para Preact. */
import { useEffect, useState } from 'preact/hooks';

export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(next) {
      state = typeof next === 'function' ? next(state) : next;
      subs.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export function useStore(store, select = (s) => s) {
  const [value, setValue] = useState(() => select(store.get()));
  useEffect(() => {
    setValue(select(store.get()));
    return store.subscribe((s) => setValue(select(s)));
  }, [store]);
  return value;
}
