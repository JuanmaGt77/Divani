/**
 * Cinta que se desliza sin fin (avisos superiores y cintas cruzadas). Repite las frases hasta
 * cubrir la pantalla, las duplica para el bucle sin saltos y ajusta la velocidad para que sea
 * la misma sin importar el largo del texto.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export function Marquee({
  items,
  className,
  itemClassName,
}: {
  items: ReactNode[];
  className: string;
  itemClassName?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [reps, setReps] = useState(1);
  const [duration, setDuration] = useState<string>();

  useLayoutEffect(() => {
    const el = track.current;
    if (!el || !items.length) return;
    const one = el.scrollWidth / (2 * reps);
    if (!one) return;
    const need = Math.max(1, Math.min(12, Math.ceil((window.innerWidth * 1.2) / one)));
    if (need !== reps) {
      setReps(need);
      return;
    }
    setDuration(`${Math.max(18, el.scrollWidth / 2 / 42)}s`);
  }, [items, reps]);

  // Solo la primera vuelta la leen los lectores de pantalla; las repeticiones son decorativas
  const copies = Array.from({ length: reps * 2 }, (_, r) =>
    items.map((it, i) => (
      <span key={`${r}-${i}`} className={itemClassName} aria-hidden={r > 0 || undefined}>
        {it}
      </span>
    )),
  );

  return (
    <div ref={track} className={className} style={duration ? { '--marquee-dur': duration } : undefined}>
      {copies}
    </div>
  );
}
