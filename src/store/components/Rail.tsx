/** Carril horizontal de productos con flechas (las flechas viven en el encabezado de la sección). */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export function useRail() {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth - 4;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft >= max });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [update]);
  /** Vuelve al inicio (al cambiar el contenido) y recalcula las flechas. */
  const reset = useCallback(() => {
    if (ref.current) ref.current.scrollLeft = 0;
    update();
  }, [update]);
  const scroll = useCallback((dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * Math.max(260, el.clientWidth * 0.75), behavior: 'smooth' });
  }, []);
  return {
    ref,
    update,
    reset,
    prev: () => scroll(-1),
    next: () => scroll(1),
    atStart: edges.start,
    atEnd: edges.end,
  };
}

export type RailApi = ReturnType<typeof useRail>;

export function RailArrows({ rail }: { rail: RailApi }) {
  return (
    <div className="rail-arrows">
      <button
        className="icon-btn glass round"
        type="button"
        onClick={rail.prev}
        disabled={rail.atStart}
        aria-label="Anterior"
      >
        <Icon name="chevron-left" />
      </button>
      <button
        className="icon-btn glass round"
        type="button"
        onClick={rail.next}
        disabled={rail.atEnd}
        aria-label="Siguiente"
      >
        <Icon name="chevron-right" />
      </button>
    </div>
  );
}

export function Rail({ rail, children }: { rail: RailApi; children: ReactNode }) {
  return (
    <div className="rail" ref={rail.ref}>
      <div className="rail__track">{children}</div>
    </div>
  );
}
