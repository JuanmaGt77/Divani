/** Hooks pequeños de uso común. */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
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

/**
 * Marca con data-more="start|end|both" un contenedor que se desliza de lado y todavía tiene contenido
 * escondido: el CSS desvanece ese borde para que se note que hay más (pestañas, segmentos).
 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>, deps: unknown[] = []): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const more = max <= 2 ? '' : el.scrollLeft <= 2 ? 'end' : el.scrollLeft >= max - 2 ? 'start' : 'both';
      if (more) el.dataset.more = more;
      else delete el.dataset.more;
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Achica la letra de un número grande (por ejemplo «Q 1,250,480.00») para que quepa completo en su
 * recuadro. Usa la variable CSS --fit (1 = tamaño normal; mínimo `min`).
 */
export function useFitText(ref: RefObject<HTMLElement | null>, min = 0.5): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      el.style.removeProperty('--fit');
      const ratio = el.clientWidth / Math.max(1, el.scrollWidth);
      if (ratio < 1) el.style.setProperty('--fit', String(Math.max(min, Math.floor(ratio * 100) / 100)));
    };
    fit();
    // Solo cuando cambia el ancho (al achicar la letra cambia la altura y no debe repetirse)
    let width = -1;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry?.contentRect.width ?? 0);
      if (w !== width) {
        width = w;
        fit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  });
}
