/**
 * Selector de color de las prendas: un color (área de saturación y brillo, barra de tono,
 * código, gotero y tonos de temporada) o multicolor de 2 a 6 rayas. Se abre junto a la
 * muestra; en celular sube desde abajo. El valor es el de product_colors.hex (ver colorStops).
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, Pipette } from 'lucide-react';
import { MAX_STRIPES, colorStops, swatchFill } from '@/lib/model';
import { Button, Segmented, cx } from './controls';

/** Tonos frecuentes en ropa, con el nombre que se sugiere para el color. */
export const FASHION_COLORS = [
  { name: 'Negro', hex: '#1B1A19' },
  { name: 'Blanco', hex: '#FAF8F3' },
  { name: 'Marfil', hex: '#F0E8D8' },
  { name: 'Beige', hex: '#D9C6A6' },
  { name: 'Camel', hex: '#B8895B' },
  { name: 'Café', hex: '#6B4A35' },
  { name: 'Gris', hex: '#9C9A95' },
  { name: 'Azul marino', hex: '#1F2B45' },
  { name: 'Mezclilla', hex: '#4F6D8F' },
  { name: 'Azul cielo', hex: '#A8C5E3' },
  { name: 'Verde olivo', hex: '#6B6D3E' },
  { name: 'Salvia', hex: '#A7B39A' },
  { name: 'Rosa palo', hex: '#E8C8BE' },
  { name: 'Fucsia', hex: '#C2185B' },
  { name: 'Rojo', hex: '#B42A22' },
  { name: 'Vino', hex: '#6D1F2E' },
  { name: 'Mostaza', hex: '#CF9F2B' },
  { name: 'Lila', hex: '#B7A5D3' },
];

/** Nombres que pone el selector solo (se pueden reemplazar sin preguntar). */
export const SUGGESTED_NAMES = new Set([...FASHION_COLORS.map((c) => c.name), 'Multicolor']);

/** Tonos con los que se completan las rayas nuevas. */
const STRIPE_FILL = ['#1B1A19', '#F0E8D8', '#B8895B', '#4F6D8F', '#E8C8BE', '#6B6D3E'];

interface Hsv {
  h: number;
  s: number;
  v: number;
}

function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${[f(5), f(3), f(1)]
    .map((x) =>
      Math.round(x * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;
}

/** «#abc», «abc123», «rgb(1, 2, 3)» → «#AABBCC» (o null si no es un color). */
function parseColor(text: string): string | null {
  const t = text.trim();
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(t);
  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map((x) => Math.min(255, Number(x)).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()}`;
  }
  const hex = t.startsWith('#') ? t : `#${t}`;
  return /^#(?:[0-9a-f]{3}){1,2}$/i.test(hex) ? (colorStops(hex)[0] as string) : null;
}

/** La palomita se ve en blanco sobre tonos oscuros y en tinta sobre claros. */
const isDark = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 150;
};

/** Ajusta la lista de rayas a `n`, completando con tonos que combinan. */
function resize(stops: string[], n: number): string[] {
  const out = stops.slice(0, n);
  for (let i = 0; out.length < n; i++) {
    const c = STRIPE_FILL[i % STRIPE_FILL.length] as string;
    if (!out.includes(c) || i >= STRIPE_FILL.length) out.push(c);
  }
  return out;
}

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
const eyeDropper = (): EyeDropperCtor | undefined =>
  typeof window === 'undefined' ? undefined : (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;

export function ColorPicker({
  value,
  onChange,
  onSuggestName,
  label,
}: {
  /** «#AABBCC» o, si es multicolor, «#AABBCC,#112233,…». */
  value: string;
  onChange: (value: string) => void;
  /** Nombre sugerido al tocar un tono de temporada o al pasar a multicolor. */
  onSuggestName?: (name: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [dropping, setDropping] = useState(false);
  const [pos, setPos] = useState<CSSProperties>({ visibility: 'hidden' });
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const droppingRef = useRef(false);

  const stops = colorStops(value);
  const multi = stops.length > 1;
  const idx = Math.min(active, stops.length - 1);
  const current = stops[idx] as string;
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(current));
  const [text, setText] = useState(current);
  const editingText = useRef(false);

  // Si el color cambia desde fuera (paleta, código, otra raya), el área lo sigue.
  // Al arrastrar no: así se conserva el tono aunque el color sea gris, blanco o negro.
  useEffect(() => {
    setHsv((h) => (hsvToHex(h) === current ? h : hexToHsv(current)));
    if (!editingText.current) setText(current);
  }, [current]);

  const close = useCallback((focus = true) => {
    setOpen(false);
    if (focus) btn.current?.focus();
  }, []);

  // Posición: debajo de la muestra (o arriba si no cabe). En celular la acomoda el CSS (hoja inferior).
  const place = useCallback(() => {
    const b = btn.current?.getBoundingClientRect();
    const p = panel.current;
    if (!b || !p) return;
    if (window.matchMedia('(max-width: 599px)').matches) {
      setPos({});
      return;
    }
    const m = 12;
    const w = p.offsetWidth;
    const h = p.offsetHeight;
    const left = Math.min(Math.max(m, b.left - 6), window.innerWidth - w - m);
    const below = b.bottom + 8;
    const fitsBelow = below + h <= window.innerHeight - m;
    const top = fitsBelow ? below : Math.max(m, Math.min(b.top - 8 - h, window.innerHeight - h - m));
    setPos({ top, left, transformOrigin: fitsBelow ? 'top left' : 'bottom left' });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos({ visibility: 'hidden' });
      return undefined;
    }
    place();
    const ro = new ResizeObserver(place);
    if (panel.current) ro.observe(panel.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e: globalThis.PointerEvent) => {
      if (droppingRef.current) return;
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) close(false);
    };
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !droppingRef.current) close();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', esc);
    };
  }, [open, close]);

  /* ---------- cambios ---------- */
  const setStop = (hex: string) => {
    const next = [...stops];
    next[idx] = hex;
    onChange(next.join(','));
  };
  const setColor = (h: Hsv) => {
    setHsv(h);
    setStop(hsvToHex(h));
  };
  const setMode = (mode: 'liso' | 'multi') => {
    if (mode === 'multi' && !multi) {
      onChange(resize(stops, 3).join(','));
      onSuggestName?.('Multicolor');
    } else if (mode === 'liso' && multi) {
      onChange(current);
    }
    setActive(0);
  };
  const setCount = (n: number) => {
    onChange(resize(stops, n).join(','));
    setActive((a) => Math.min(a, n - 1));
  };
  const pickPreset = (c: { name: string; hex: string }) => {
    setStop(c.hex);
    if (!multi) onSuggestName?.(c.name);
  };

  /* ---------- área de saturación y brillo ---------- */
  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    setColor({ ...hsv, s, v });
  };
  const onAreaKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (!d) return;
    e.preventDefault();
    const clamp = (x: number) => Math.min(1, Math.max(0, x));
    setColor({ ...hsv, s: clamp(hsv.s + (d[0] as number)), v: clamp(hsv.v + (d[1] as number)) });
  };

  /* ---------- gotero ---------- */
  const Dropper = eyeDropper();
  const drop = async () => {
    if (!Dropper) return;
    droppingRef.current = true;
    setDropping(true);
    try {
      const { sRGBHex } = await new Dropper().open();
      const hex = parseColor(sRGBHex);
      if (hex) setStop(hex);
    } catch {
      // Se canceló con Esc: no cambia nada
    } finally {
      droppingRef.current = false;
      setDropping(false);
    }
  };

  const hueColor = `hsl(${Math.round(hsv.h)} 100% 50%)`;

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={cx('color-dot', open && 'is-open')}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Cambiar color"
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <span className="swatch" style={{ '--c': swatchFill(value), '--s': '34px' }} />
      </button>
      {open &&
        createPortal(
          <>
            <div className="cpk-veil" aria-hidden="true" onClick={() => close(false)} />
            <div
              ref={panel}
              className={cx('cpk', dropping && 'is-dropping')}
              role="dialog"
              aria-label={label}
              style={pos}
            >
              <Segmented
                block
                size="sm"
                label="Tipo de color"
                value={multi ? 'multi' : 'liso'}
                onChange={setMode}
                options={[
                  { value: 'liso', label: 'Un color' },
                  { value: 'multi', label: 'Multicolor' },
                ]}
              />

              {multi && (
                <div className="cpk__multi">
                  <div className="cpk__line">
                    <span className="cpk__label">Rayas</span>
                    <Segmented
                      size="sm"
                      label="Número de rayas"
                      value={stops.length}
                      onChange={setCount}
                      options={Array.from({ length: MAX_STRIPES - 1 }, (_, i) => ({ value: i + 2, label: i + 2 }))}
                    />
                  </div>
                  <div className="cpk__stripes" role="radiogroup" aria-label="Raya que estás editando">
                    {stops.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        role="radio"
                        aria-checked={i === idx}
                        aria-label={`Raya ${i + 1}`}
                        className={cx('cpk__stripe', isDark(c) && 'is-dark')}
                        style={{ '--c': c }}
                        onClick={() => setActive(i)}
                      >
                        {i === idx && <Check aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                  <p className="cpk__hint">Toca una raya y elige su color.</p>
                </div>
              )}

              <div
                className="cpk__area"
                style={{ '--hue': hueColor }}
                role="slider"
                tabIndex={0}
                aria-label="Saturación y brillo"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(hsv.v * 100)}
                aria-valuetext={`Saturación ${Math.round(hsv.s * 100)} %, brillo ${Math.round(hsv.v * 100)} %`}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  fromPointer(e);
                }}
                onPointerMove={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e);
                }}
                onKeyDown={onAreaKey}
              >
                <span
                  className="cpk__thumb"
                  style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, '--c': current }}
                />
              </div>
              <input
                className="cpk__hue"
                type="range"
                min={0}
                max={359}
                value={Math.round(hsv.h)}
                style={{ '--hue': hueColor }}
                onChange={(e) =>
                  setColor({ ...hsv, h: Number(e.currentTarget.value), s: hsv.s || 0.6, v: hsv.v || 0.7 })
                }
                aria-label="Tono"
              />

              <div className="cpk__line">
                <label className="cpk__code">
                  <span className="swatch" style={{ '--c': current, '--s': '24px' }} />
                  <input
                    value={text}
                    maxLength={7}
                    spellCheck={false}
                    autoComplete="off"
                    aria-label="Código del color"
                    onFocus={() => (editingText.current = true)}
                    onBlur={() => {
                      editingText.current = false;
                      setText(current);
                    }}
                    onChange={(e) => {
                      const t = e.currentTarget.value.toUpperCase();
                      setText(t);
                      const hex = /^#?[0-9A-F]{6}$/.test(t) ? parseColor(t) : null;
                      if (hex) setStop(hex);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                  />
                </label>
                {Dropper && (
                  <Button size="sm" variant="secondary" icon={Pipette} onClick={() => void drop()}>
                    Gotero
                  </Button>
                )}
              </div>
              {Dropper && <p className="cpk__hint">Con el gotero puedes tomar el color directo de la foto.</p>}

              <div className="cpk__presets-wrap">
                <span className="cpk__label">Tonos de temporada</span>
                <div className="cpk__presets">
                  {FASHION_COLORS.map((c) => {
                    const on = c.hex === current;
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        className={cx('cpk__preset', isDark(c.hex) && 'is-dark')}
                        style={{ '--c': c.hex }}
                        aria-label={c.name}
                        aria-pressed={on}
                        data-tip={c.name}
                        onClick={() => pickPreset(c)}
                      >
                        {on && <Check aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button variant="primary" block onClick={() => close()}>
                Listo
              </Button>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
