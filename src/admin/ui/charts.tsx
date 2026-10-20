/**
 * Gráficas en SVG, sin librerías.
 * Paleta validada (superficie #fffdf9): bronce #b06f2a · azul #2e6da6 · verde #5a8f3f — pasa
 * banda de luminosidad, croma, separación para daltonismo y contraste.
 * Reglas: líneas de 2 px, relleno al ~10 %, cuadrícula fina y sólida, un solo eje,
 * barras ≤ 24 px con punta redondeada de 4 px, textos siempre en tinta (nunca del color de la serie).
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { cx } from './controls';

export const SERIES = ['#b06f2a', '#2e6da6', '#5a8f3f'];
export const MUTED = '#b9ad9f';
const GRID = '#ebe3d7';
const SURFACE = '#fffdf9';

const colorAt = (i: number): string => SERIES[i % SERIES.length] as string;
export { colorAt as seriesColor };

function useWidth(ref: RefObject<HTMLElement | null>, fallback = 600): number {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => {
      if (e) setW(Math.max(120, Math.round(e.contentRect.width)));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/**
 * Escala del eje con marcas redondas y enteras (1, 2 o 5 × 10ⁿ): nunca se repite una etiqueta
 * (con montos pequeños, 0.25, 0.5 y 0.75 se veían todos como «Q 1»).
 */
function niceScale(v: number, count = 4): { max: number; ticks: number[] } {
  const raw = Math.max(v, 1) / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * p).find((x) => x >= raw) ?? 10 * p);
  const n = Math.max(1, Math.ceil(v / step));
  return { max: n * step, ticks: Array.from({ length: n + 1 }, (_, i) => i * step) };
}

type Pt = [number, number];

/** Curva monótona (no se pasa de los datos entre puntos). */
function monotonePath(pts: Pt[]): string {
  const n = pts.length;
  if (n < 2) return n ? `M${pts[0]![0]},${pts[0]![1]}` : '';
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];
  const t: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1]![0] - pts[i]![0];
    dy[i] = pts[i + 1]![1] - pts[i]![1];
    m[i] = dy[i]! / (dx[i] || 1);
  }
  t[0] = m[0]!;
  t[n - 1] = m[n - 2]!;
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i]! / m[i]!;
    const b = t[i + 1]! / m[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i]!;
      t[i + 1] = k * b * m[i]!;
    }
  }
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]! / 3;
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    d += `C${x0 + h},${y0 + h * t[i]!} ${x1 - h},${y1 - h * t[i + 1]!} ${x1},${y1}`;
  }
  return d;
}

export interface ChartPoint {
  key?: string;
  label: string;
  value: number;
  count?: number;
  date?: Date;
}

/**
 * Serie en el tiempo con área, cursor que se ajusta al punto más cercano y tooltip.
 * compare: valores del periodo anterior (opcional)
 */
export function AreaChart<P extends ChartPoint>({
  points,
  compare,
  height = 240,
  format = String,
  formatAxis = format,
  tickLabel = (p) => p.label,
  tipTitle = (p) => p.label,
  seriesLabel = 'Ventas',
  compareLabel = 'Periodo anterior',
  countLabel = 'ventas',
  color = colorAt(0),
  loading,
}: {
  points: P[];
  compare?: { value: number }[] | null;
  height?: number;
  format?: (v: number) => string;
  formatAxis?: (v: number) => string;
  tickLabel?: (p: P, i: number) => string;
  tipTitle?: (p: P, i: number) => string;
  seriesLabel?: string;
  compareLabel?: string;
  countLabel?: string;
  color?: string;
  loading?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const gid = `fill-${useId().replace(/[^\w-]/g, '')}`;
  const width = useWidth(wrap);
  const [hover, setHover] = useState<number | null>(null);
  const pad = { t: 14, r: 14, b: 28, l: 52 };
  const W = width;
  const H = height;
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const { max, ticks } = niceScale(Math.max(0, ...points.map((p) => p.value), ...(compare || []).map((c) => c.value)));
  const x = (i: number) => pad.l + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const line = useMemo(
    () => monotonePath(points.map((p, i) => [x(i), y(p.value)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, width, max],
  );
  const cmpLine = useMemo(
    () => (compare?.length ? monotonePath(compare.slice(0, points.length).map((c, i) => [x(i), y(c.value)])) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compare, points, width, max],
  );
  const area = line ? `${line}L${x(points.length - 1)},${pad.t + ih}L${x(0)},${pad.t + ih}Z` : '';
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 78))));

  const pick = (clientX: number) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    const px = clientX - r.left;
    const i = Math.round(((px - pad.l) / Math.max(1, iw)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1));
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setHover((h) => Math.max(0, (h ?? points.length) - 1));
    }
    if (e.key === 'Escape') setHover(null);
  };
  const hp = hover != null ? points[hover] : null;
  const tipLeft = hover != null ? x(hover) : 0;
  const flip = tipLeft > W - 190;
  const last = points[points.length - 1];

  return (
    <div className={cx('chart', loading && 'is-refreshing')} ref={wrap} style={{ height: `${H}px` }}>
      <svg
        width={W}
        height={H}
        role="img"
        aria-label={`${seriesLabel}: ${points.length} periodos. Máximo ${format(Math.max(0, ...points.map((p) => p.value)))}.`}
        tabIndex={0}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover(points.length - 1)}
        onBlur={() => setHover(null)}
        onKeyDown={onKey}
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={pad.l - 10} y={y(t)} textAnchor="end" dominantBaseline="middle" className="chart__tick">
              {formatAxis(t)}
            </text>
          </g>
        ))}
        {points.map(
          (p, i) =>
            (i % every === 0 || i === points.length - 1) && (
              <text
                key={p.key ?? i}
                x={x(i)}
                y={H - 8}
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                className="chart__tick"
              >
                {tickLabel(p, i)}
              </text>
            ),
        )}
        {cmpLine && (
          <path d={cmpLine} fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {hp && hover != null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={pad.t}
              y2={pad.t + ih}
              stroke="#171513"
              strokeOpacity="0.22"
              strokeWidth="1"
            />
            {compare?.[hover] && (
              <circle cx={x(hover)} cy={y(compare[hover]!.value)} r="4" fill={MUTED} stroke={SURFACE} strokeWidth="2" />
            )}
            <circle cx={x(hover)} cy={y(hp.value)} r="5" fill={color} stroke={SURFACE} strokeWidth="2" />
          </g>
        )}
        {!hp && last && (
          <circle cx={x(points.length - 1)} cy={y(last.value)} r="4" fill={color} stroke={SURFACE} strokeWidth="2" />
        )}
      </svg>
      {hp && hover != null && (
        <div
          className="chart-tip"
          style={{ left: `${tipLeft}px`, transform: `translateX(${flip ? 'calc(-100% - 14px)' : '14px'})` }}
          role="status"
        >
          <p className="chart-tip__title">{tipTitle(hp, hover)}</p>
          <p className="chart-tip__row">
            <span className="chart-tip__key" style={{ background: color }} />
            <strong>{format(hp.value)}</strong>
            <span>{seriesLabel}</span>
          </p>
          {compare?.[hover] && (
            <p className="chart-tip__row">
              <span className="chart-tip__key" style={{ background: MUTED }} />
              <strong>{format(compare[hover]!.value)}</strong>
              <span>{compareLabel}</span>
            </p>
          )}
          {hp.count != null && (
            <p className="chart-tip__meta">
              {hp.count} {countLabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label} className="legend__item">
          <span className={cx('legend__key', it.line && 'legend__key--line')} style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export interface BarRow {
  key: string;
  label: ReactNode;
  value: number;
  sub?: ReactNode;
  media?: ReactNode;
}

/** Barras horizontales delgadas con el valor en la punta (magnitud, un solo tono). */
export function BarList<R extends BarRow>({
  rows,
  format = String,
  color = colorAt(0),
  max,
  empty = 'Sin datos en este periodo',
  onSelect,
}: {
  rows: R[];
  format?: (v: number) => string;
  color?: string;
  max?: number;
  empty?: string;
  onSelect?: (r: R) => void;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) {
    return (
      <p className="muted small" style={{ padding: '8px 0' }}>
        {empty}
      </p>
    );
  }
  return (
    <ul className="barlist">
      {rows.map((r) => {
        const content = (
          <>
            <span className="barlist__label">
              {r.media}
              <span className="ellipsis">{r.label}</span>
              {r.sub && <span className="barlist__sub">{r.sub}</span>}
            </span>
            <span className="barlist__value num">{format(r.value)}</span>
            <span className="barlist__track" aria-hidden="true">
              <span
                className="barlist__bar"
                style={{ width: `${Math.max(1.5, (r.value / top) * 100)}%`, background: color }}
              />
            </span>
          </>
        );
        return (
          <li key={r.key}>
            {onSelect ? (
              <button className="barlist__row" type="button" onClick={() => onSelect(r)}>
                {content}
              </button>
            ) : (
              <div className="barlist__row">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Parte de un todo: una barra apilada con separación de 2 px y leyenda con valores. */
export function StackedBar({
  segments,
  format = String,
  total: totalProp,
}: {
  segments: Segment[];
  format?: (v: number) => string;
  total?: number;
}) {
  const total = totalProp ?? segments.reduce((a, s) => a + s.value, 0);
  const [hover, setHover] = useState<number | null>(null);
  if (!total) return <p className="muted small">Sin datos en este periodo</p>;
  const shown = segments.filter((s) => s.value > 0);
  return (
    <div className="stackbar">
      <div
        className="stackbar__bar"
        role="img"
        aria-label={shown.map((s) => `${s.label}: ${Math.round((s.value / total) * 100)} %`).join(', ')}
      >
        {shown.map((s, i) => (
          <span
            key={s.key}
            className={cx('stackbar__seg', hover === i && 'is-hover')}
            style={{ flexGrow: s.value, background: s.color }}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            title={`${s.label}: ${format(s.value)}`}
          />
        ))}
      </div>
      <ul className="stackbar__legend">
        {shown.map((s, i) => (
          <li
            key={s.key}
            className={cx(hover === i && 'is-hover')}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="legend__key" style={{ background: s.color }} />
            <span className="grow">{s.label}</span>
            <strong className="num">{format(s.value)}</strong>
            <span className="muted num">{Math.round((s.value / total) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Mini tendencia para las tarjetas de indicadores: gris con el último punto en el acento. */
export function Sparkline({
  values = [],
  height = 34,
  color = colorAt(0),
}: {
  values?: number[];
  height?: number;
  color?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 160);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts: Pt[] = values.map((v, i) => [
    2 + (i / Math.max(1, values.length - 1)) * (width - 8),
    3 + (height - 6) * (1 - (v - min) / (max - min || 1)),
  ]);
  const last = pts[pts.length - 1];
  return (
    <div
      ref={wrap}
      className={values.length >= 2 ? 'sparkline' : undefined}
      style={{ height: `${height}px` }}
      aria-hidden="true"
    >
      {values.length >= 2 && last && (
        <svg width={width} height={height}>
          <path
            d={monotonePath(pts)}
            fill="none"
            stroke={MUTED}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} stroke={SURFACE} strokeWidth="2" />
        </svg>
      )}
    </div>
  );
}
