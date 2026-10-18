/** Hooks pequeños de uso común. */
import { useEffect, useRef, useState } from 'react';
import { normalize } from '@/lib/model';

export function useMedia(query: string): boolean {
  const [ok, setOk] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const fn = () => setOk(m.matches);
    fn();
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, [query]);
  return ok;
}

export const useIsMobile = (): boolean => useMedia('(max-width: 899px)');

export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

type Getter<T> = (row: T) => unknown;

/** Ordenar una tabla: const { rows, sort, setSort } = useSort(data, { key: 'total', dir: 'desc' }, getters) */
export function useSort<T>(
  rows: T[] | null | undefined,
  initial: SortState,
  getters: Record<string, Getter<T>> = {},
): { rows: T[]; sort: SortState; setSort: (key: string) => void } {
  const [sort, setSortState] = useState<SortState>(initial);
  // Ordenar unos cientos de filas es instantáneo: se calcula en cada render
  let sorted = rows || [];
  if (rows && sort?.key) {
    const get: Getter<T> = getters[sort.key] || ((r) => (r as Record<string, unknown>)[sort.key]);
    const dir = sort.dir === 'asc' ? 1 : -1;
    sorted = [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
      return String(x ?? '').localeCompare(String(y ?? ''), 'es', { numeric: true }) * dir;
    });
  }
  const setSort = (key: string) =>
    setSortState((s) =>
      s?.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: typeof getters[key] === 'function' || key !== 'name' ? 'desc' : 'asc' },
    );
  return { rows: sorted, sort, setSort };
}

type Field = string | number | null | undefined | false | Field[];

/** Búsqueda sin acentos sobre varios campos. */
export function matches(q: string, ...fields: Field[]): boolean {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = normalize((fields as unknown[]).flat(Infinity).filter(Boolean).join(' '));
  return words.every((w) => hay.includes(w));
}

/** Atajo de teclado: useHotkey('/', () => …) (ignora cuando se escribe en un campo). */
export function useHotkey(key: string, fn: (e: KeyboardEvent) => void): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== key || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      fnRef.current(e);
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [key]);
}
