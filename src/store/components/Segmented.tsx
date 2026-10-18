/** Control segmentado con «lente» que se desliza (estilo iOS). */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from './cx';

export interface SegmentedOption {
  value: string;
  label: string;
}

export function Segmented({
  options,
  value,
  onChange,
  label,
  scroll,
  className,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  scroll?: boolean;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);

  const place = () => {
    const btn = root.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (btn) setThumb({ x: btn.offsetLeft, w: btn.offsetWidth });
  };

  useLayoutEffect(() => {
    place();
    const el = root.current;
    const btn = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (el && btn && el.scrollWidth > el.clientWidth) {
      el.scrollTo({ left: btn.offsetLeft - el.clientWidth / 2 + btn.offsetWidth / 2, behavior: 'smooth' });
    }
  }, [value, options.length]);

  // Se reacomoda si cambia el tamaño (fuentes, rotación de pantalla)
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(place);
    ro.observe(el);
    void document.fonts?.ready.then(place);
    return () => ro.disconnect();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  };

  return (
    <div
      ref={root}
      className={cx('segmented', scroll && 'segmented--scroll', 'glass pill', className)}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      <span
        className="segmented__thumb"
        aria-hidden="true"
        style={thumb ? { '--x': `${thumb.x}px`, '--w': `${thumb.w}px` } : undefined}
      />
      {options.map((o) => (
        <button
          key={o.value}
          className="segmented__btn"
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => o.value !== value && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
