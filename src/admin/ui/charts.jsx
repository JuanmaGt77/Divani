/**
 * Gráficas en SVG, sin librerías.
 * Paleta validada (scripts de dataviz, superficie #fffdf9): bronce #b06f2a · azul #2e6da6 ·
 * verde #5a8f3f — pasa banda de luminosidad, croma, separación para daltonismo y contraste.
 * Reglas: líneas de 2 px, relleno al ~10 %, cuadrícula fina y sólida, un solo eje,
 * barras ≤ 24 px con punta redondeada de 4 px, textos siempre en tinta (nunca del color de la serie).
 */
import { useEffect, useMemo, useRef, useState, useId } from 'preact/hooks';
import { cx } from './controls.jsx';

export const SERIES = ['#b06f2a', '#2e6da6', '#5a8f3f'];
export const MUTED = '#b9ad9f';
const GRID = '#ebe3d7';
const SURFACE = '#fffdf9';

function useWidth(ref, fallback = 600) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(120, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return w;
}

/** Máximo «redondo» para el eje: 1, 2, 2.5, 5 × 10ⁿ */
function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Curva monótona (no se pasa de los datos entre puntos). */
function monotonePath(pts) {
  const n = pts.length;
  if (n < 2) return n ? `M${pts[0][0]},${pts[0][1]}` : '';
  const dx = [], dy = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    dy[i] = pts[i + 1][1] - pts[i][1];
    m[i] = dy[i] / (dx[i] || 1);
  }
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${pts[i][0] + h},${pts[i][1] + h * t[i]} ${pts[i + 1][0] - h},${pts[i + 1][1] - h * t[i + 1]} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

/**
 * Serie en el tiempo con área, cursor que se ajusta al punto más cercano y tooltip.
 * points: [{ key, label, value, count }] · compare: valores del periodo anterior (opcional)
 */
export function AreaChart({ points, compare, height = 240, format = String, formatAxis = format, tickLabel = (p) => p.label, tipTitle = (p) => p.label, seriesLabel = 'Ventas', compareLabel = 'Periodo anterior', countLabel = 'ventas', color = SERIES[0], loading }) {
  const wrap = useRef(null);
  const gid = `fill-${useId().replace(/[^\w-]/g, '')}`;
  const width = useWidth(wrap);
  const [hover, setHover] = useState(null);
  const pad = { t: 14, r: 14, b: 28, l: 52 };
  const W = width, H = height;
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...points.map((p) => p.value), ...(compare || []).map((c) => c.value)));
  const x = (i) => pad.l + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => pad.t + ih - (v / max) * ih;
  const line = useMemo(() => monotonePath(points.map((p, i) => [x(i), y(p.value)])), [points, width, max]);
  const cmpLine = useMemo(() => (compare?.length ? monotonePath(compare.slice(0, points.length).map((c, i) => [x(i), y(c.value)])) : ''), [compare, points, width, max]);
  const area = line ? `${line}L${x(points.length - 1)},${pad.t + ih}L${x(0)},${pad.t + ih}Z` : '';
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 78))));

  const pick = (clientX) => {
    const r = wrap.current.getBoundingClientRect();
    const px = clientX - r.left;
    const i = Math.round(((px - pad.l) / Math.max(1, iw)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setHover((h) => Math.max(0, (h ?? points.length) - 1)); }
    if (e.key === 'Escape') setHover(null);
  };
  const hp = hover != null ? points[hover] : null;
  const tipLeft = hover != null ? x(hover) : 0;
  const flip = tipLeft > W - 190;

  return (
    <div class={cx('chart', loading && 'is-refreshing')} ref={wrap} style={{ height: `${H}px` }}>
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
            <stop offset="0%" stop-color={color} stop-opacity="0.16" />
            <stop offset="100%" stop-color={color} stop-opacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} stroke-width="1" />
            <text x={pad.l - 10} y={y(t)} text-anchor="end" dominant-baseline="middle" class="chart__tick">{formatAxis(t)}</text>
          </g>
        ))}
        {points.map((p, i) => (i % every === 0 || i === points.length - 1) && (
          <text x={x(i)} y={H - 8} text-anchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} class="chart__tick">{tickLabel(p, i)}</text>
        ))}
        {cmpLine && <path d={cmpLine} fill="none" stroke={MUTED} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        {hp && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="#171513" stroke-opacity="0.22" stroke-width="1" />
            {compare?.[hover] && <circle cx={x(hover)} cy={y(compare[hover].value)} r="4" fill={MUTED} stroke={SURFACE} stroke-width="2" />}
            <circle cx={x(hover)} cy={y(hp.value)} r="5" fill={color} stroke={SURFACE} stroke-width="2" />
          </g>
        )}
        {!hp && points.length > 0 && <circle cx={x(points.length - 1)} cy={y(points.at(-1).value)} r="4" fill={color} stroke={SURFACE} stroke-width="2" />}
      </svg>
      {hp && (
        <div class="chart-tip" style={{ left: `${tipLeft}px`, transform: `translateX(${flip ? 'calc(-100% - 14px)' : '14px'})` }} role="status">
          <p class="chart-tip__title">{tipTitle(hp, hover)}</p>
          <p class="chart-tip__row"><span class="chart-tip__key" style={{ background: color }} /><strong>{format(hp.value)}</strong><span>{seriesLabel}</span></p>
          {compare?.[hover] && <p class="chart-tip__row"><span class="chart-tip__key" style={{ background: MUTED }} /><strong>{format(compare[hover].value)}</strong><span>{compareLabel}</span></p>}
          {hp.count != null && <p class="chart-tip__meta">{hp.count} {countLabel}</p>}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div class="legend">
      {items.map((it) => (
        <span class="legend__item"><span class={cx('legend__key', it.line && 'legend__key--line')} style={{ background: it.color }} />{it.label}</span>
      ))}
    </div>
  );
}

/** Barras horizontales delgadas con el valor en la punta (magnitud, un solo tono). */
export function BarList({ rows, format = String, color = SERIES[0], max, empty = 'Sin datos en este periodo', onSelect }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p class="muted small" style={{ padding: '8px 0' }}>{empty}</p>;
  return (
    <ul class="barlist">
      {rows.map((r) => {
        const Tag = onSelect ? 'button' : 'div';
        return (
          <li>
            <Tag class="barlist__row" type={onSelect ? 'button' : undefined} onClick={onSelect ? () => onSelect(r) : undefined}>
              <span class="barlist__label">
                {r.media}
                <span class="ellipsis">{r.label}</span>
                {r.sub && <span class="barlist__sub">{r.sub}</span>}
              </span>
              <span class="barlist__value num">{format(r.value)}</span>
              <span class="barlist__track" aria-hidden="true">
                <span class="barlist__bar" style={{ width: `${Math.max(1.5, (r.value / top) * 100)}%`, background: color }} />
              </span>
            </Tag>
          </li>
        );
      })}
    </ul>
  );
}

/** Parte de un todo: una barra apilada con separación de 2 px y leyenda con valores. */
export function StackedBar({ segments, format = String, total: totalProp }) {
  const total = totalProp ?? segments.reduce((a, s) => a + s.value, 0);
  const [hover, setHover] = useState(null);
  if (!total) return <p class="muted small">Sin datos en este periodo</p>;
  const shown = segments.filter((s) => s.value > 0);
  return (
    <div class="stackbar">
      <div class="stackbar__bar" role="img" aria-label={shown.map((s) => `${s.label}: ${Math.round((s.value / total) * 100)} %`).join(', ')}>
        {shown.map((s, i) => (
          <span
            class={cx('stackbar__seg', hover === i && 'is-hover')}
            style={{ flexGrow: s.value, background: s.color }}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            title={`${s.label}: ${format(s.value)}`}
          />
        ))}
      </div>
      <ul class="stackbar__legend">
        {shown.map((s, i) => (
          <li class={cx(hover === i && 'is-hover')} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <span class="legend__key" style={{ background: s.color }} />
            <span class="grow">{s.label}</span>
            <strong class="num">{format(s.value)}</strong>
            <span class="muted num">{Math.round((s.value / total) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Mini tendencia para las tarjetas de indicadores: gris con el último punto en el acento. */
export function Sparkline({ values = [], height = 34, color = SERIES[0] }) {
  const wrap = useRef(null);
  const width = useWidth(wrap, 160);
  if (values.length < 2) return <div ref={wrap} style={{ height: `${height}px` }} />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [2 + (i / (values.length - 1)) * (width - 8), 3 + (height - 6) * (1 - (v - min) / (max - min || 1))]);
  const last = pts.at(-1);
  return (
    <div ref={wrap} class="sparkline" style={{ height: `${height}px` }} aria-hidden="true">
      <svg width={width} height={height}>
        <path d={monotonePath(pts)} fill="none" stroke={MUTED} stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} stroke={SURFACE} stroke-width="2" />
      </svg>
    </div>
  );
}
