/**
 * Lectura de datos con caché compartida e invalidación por tema.
 *   const { data, loading, error } = useQuery('orders:30d', () => api.orders.list(...), ['orders']);
 *   invalidate('orders')  → vuelve a pedir todas las consultas que dependen de pedidos.
 * Los cambios que llegan de otras pestañas o de Supabase en tiempo real también invalidan.
 */
import { useEffect, useReducer, useRef, useCallback, useState } from 'preact/hooks';

const cache = new Map(); // key → { data, error, promise, fetcher, topics, subs, at }

function entry(key) {
  if (!cache.has(key)) cache.set(key, { data: undefined, error: null, promise: null, fetcher: null, topics: [], subs: new Set(), at: 0 });
  return cache.get(key);
}

function run(key) {
  const e = entry(key);
  if (!e.fetcher) return Promise.resolve();
  const p = Promise.resolve().then(e.fetcher).then(
    (data) => { if (e.promise === p) { e.data = data; e.error = null; e.at = Date.now(); } },
    (err) => { if (e.promise === p) { e.error = err; console.error(err); } },
  ).finally(() => {
    if (e.promise === p) e.promise = null;
    e.subs.forEach((fn) => fn());
  });
  e.promise = p;
  e.subs.forEach((fn) => fn());
  return p;
}

export function useQuery(key, fetcher, topics = [], { enabled = true } = {}) {
  const [, force] = useReducer((x) => x + 1, 0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const e = entry(key);
  e.fetcher = () => fetchRef.current();
  e.topics = topics;

  useEffect(() => {
    e.subs.add(force);
    if (enabled && e.data === undefined && !e.promise) run(key);
    return () => e.subs.delete(force);
  }, [key, enabled]);

  return {
    data: e.data,
    error: e.error,
    loading: e.data === undefined && (!!e.promise || (enabled && !e.error)),
    refreshing: !!e.promise,
    refetch: () => run(key),
  };
}

/** Vuelve a pedir las consultas de un tema ('*' = todas). Las que no están en pantalla se descartan. */
export function invalidate(...topics) {
  const all = topics.includes('*');
  for (const [key, e] of cache) {
    if (!all && !e.topics.some((t) => topics.includes(t))) continue;
    if (e.subs.size) run(key);
    else cache.delete(key);
  }
}

export function clearCache() {
  cache.clear();
}

/**
 * Ejecuta una acción con estado de carga y manejo de errores.
 *   const [save, saving] = useAction(async (x) => …, { topics: ['products'], success: 'Guardado' })
 */
export function useAction(fn, { topics = [], onError, onSuccess } = {}) {
  const [busy, setBusy] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const exec = useCallback(async (...args) => {
    setBusy(true);
    try {
      const res = await fnRef.current(...args);
      if (topics.length) invalidate(...topics);
      onSuccess?.(res);
      return res;
    } catch (err) {
      if (onError) onError(err);
      else throw err;
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [topics.join('|')]);
  return [exec, busy];
}
