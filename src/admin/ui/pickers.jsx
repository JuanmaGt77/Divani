/** Selector de periodo: atajos en filas (con palomita) y rango personalizado al pie. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { CalendarRange, Check, ChevronDown } from 'lucide-preact';
import { PRESETS, rangeFor, toInputDate, fromInputDate } from '../lib/dates.js';
import { dateShort, dateMedium } from '../lib/format.js';
import { Button, cx } from './controls.jsx';

/** value: { preset } o { from, to } (Date) */
export function rangeLabel(value) {
  if (value.preset) return PRESETS.find((p) => p.id === value.preset)?.label || 'Periodo';
  const thisYear = new Date().getFullYear();
  const short = value.from.getFullYear() === thisYear && value.to.getFullYear() === thisYear;
  return `${short ? dateShort(value.from) : dateMedium(value.from)} – ${short ? dateShort(value.to) : dateMedium(value.to)}`;
}

export const resolveRange = (value) => (value.preset ? rangeFor(value.preset) : { from: value.from, to: value.to });

export function DateRangePicker({ value, onChange, presets = PRESETS, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const r = resolveRange(value);
    setFrom(toInputDate(r.from));
    setTo(toInputDate(r.to));
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const choose = (v) => { onChange(v); setOpen(false); };

  return (
    <div class="menu-wrap" ref={ref}>
      <button type="button" class="btn btn--secondary" aria-haspopup="dialog" aria-expanded={String(open)} onClick={() => setOpen(!open)}>
        <CalendarRange aria-hidden="true" />
        {rangeLabel(value)}
        <ChevronDown aria-hidden="true" style={{ width: '16px', height: '16px', opacity: 0.6 }} />
      </button>
      {open && (
        <div class={cx('menu', 'range-menu', align === 'left' && 'menu--left')} role="dialog" aria-label="Elegir periodo">
          {presets.map((p) => (
            <button type="button" class="menu__item" aria-pressed={String(value.preset === p.id)} onClick={() => choose({ preset: p.id })}>
              {value.preset === p.id ? <Check class="range-menu__check" aria-hidden="true" /> : <span class="range-menu__blank" aria-hidden="true" />}
              <span class="grow">{p.label}</span>
            </button>
          ))}
          <div class="menu__sep" role="separator" />
          <p class="menu__label">Rango personalizado</p>
          <div class="range-custom">
            <div class="row" style={{ '--gap': '6px' }}>
              <input class="input input--sm" type="date" value={from} max={to || undefined} onInput={(e) => setFrom(e.currentTarget.value)} aria-label="Desde" />
              <span class="muted small">a</span>
              <input class="input input--sm" type="date" value={to} min={from || undefined} onInput={(e) => setTo(e.currentTarget.value)} aria-label="Hasta" />
            </div>
            <Button size="sm" variant="primary" block disabled={!from || !to || from > to} onClick={() => choose({ from: fromInputDate(from), to: fromInputDate(to, true) })}>
              Aplicar rango
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
