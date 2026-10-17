/** Hooks pequeños de uso común. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { normalize } from '../../backend/model.js';

export function useMedia(query) {
  const [ok, setOk] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const fn = () => setOk(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, [query]);
  return ok;
}
export const useIsMobile = () => useMedia('(max-width: 899px)');

export function useDebounced(value, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Ordenar una tabla: const { rows, sort, setSort } = useSort(data, { key: 'total', dir: 'desc' }, getters) */
export function useSort(rows, initial, getters = {}) {
  const [sort, setSortState] = useState(initial);
  const sorted = useMemo(() => {
    if (!rows || !sort?.key) return rows || [];
    const get = getters[sort.key] || ((r) => r[sort.key]);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
      return String(x ?? '').localeCompare(String(y ?? ''), 'es', { numeric: true }) * dir;
    });
  }, [rows, sort?.key, sort?.dir]);
  const setSort = (key) => setSortState((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: typeof getters[key] === 'function' || key !== 'name' ? 'desc' : 'asc' }));
  return { rows: sorted, sort, setSort };
}

/** Búsqueda sin acentos sobre varios campos. */
export function matches(q, ...fields) {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = normalize(fields.flat().filter(Boolean).join(' '));
  return words.every((w) => hay.includes(w));
}

/** Atajo de teclado: useHotkey('/', () => …) (ignora cuando se escribe en un campo). */
export function useHotkey(key, fn) {
  useEffect(() => {
    const h = (e) => {
      if (e.key !== key || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      fn(e);
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [key, fn]);
}
