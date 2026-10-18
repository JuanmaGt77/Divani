/** Selector de periodo: atajos en filas (con palomita) y rango personalizado al pie. */
import { useEffect, useRef, useState } from 'react';
import { CalendarRange, Check, ChevronDown } from 'lucide-react';
import { dateMedium, dateShort } from '@/lib/format';
import { PRESETS, fromInputDate, rangeFor, toInputDate, type DateRange } from '../lib/dates';
import { Button, cx } from './controls';

/** Un atajo («Últimos 30 días») o un rango con fechas. */
export type RangeValue = { preset: string } | DateRange;

export function rangeLabel(value: RangeValue): string {
  if ('preset' in value) return PRESETS.find((p) => p.id === value.preset)?.label || 'Periodo';
  const thisYear = new Date().getFullYear();
  const short = value.from.getFullYear() === thisYear && value.to.getFullYear() === thisYear;
  return `${short ? dateShort(value.from) : dateMedium(value.from)} – ${short ? dateShort(value.to) : dateMedium(value.to)}`;
}

export const resolveRange = (value: RangeValue): DateRange =>
  'preset' in value ? rangeFor(value.preset) : { from: value.from, to: value.to };

export function DateRangePicker({
  value,
  onChange,
  presets = PRESETS,
  align = 'left',
}: {
  value: RangeValue;
  onChange: (v: RangeValue) => void;
  presets?: { id: string; label: string }[];
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const r = resolveRange(value);
    setFrom(toInputDate(r.from));
    setTo(toInputDate(r.to));
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
    // Solo al abrir: toma el rango actual como punto de partida
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (v: RangeValue) => {
    onChange(v);
    setOpen(false);
  };
  const selected = 'preset' in value ? value.preset : null;
  const fromDate = fromInputDate(from);
  const toDate = fromInputDate(to, true);

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className="btn btn--secondary"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <CalendarRange aria-hidden="true" />
        {rangeLabel(value)}
        <ChevronDown aria-hidden="true" style={{ width: '16px', height: '16px', opacity: 0.6 }} />
      </button>
      {open && (
        <div
          className={cx('menu', 'range-menu', align === 'left' && 'menu--left')}
          role="dialog"
          aria-label="Elegir periodo"
        >
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              className="menu__item"
              aria-pressed={selected === p.id}
              onClick={() => choose({ preset: p.id })}
            >
              {selected === p.id ? (
                <Check className="range-menu__check" aria-hidden="true" />
              ) : (
                <span className="range-menu__blank" aria-hidden="true" />
              )}
              <span className="grow">{p.label}</span>
            </button>
          ))}
          <div className="menu__sep" role="separator" />
          <p className="menu__label">Rango personalizado</p>
          <div className="range-custom">
            <div className="row" style={{ '--gap': '6px' }}>
              <input
                className="input input--sm"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.currentTarget.value)}
                aria-label="Desde"
              />
              <span className="muted small">a</span>
              <input
                className="input input--sm"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.currentTarget.value)}
                aria-label="Hasta"
              />
            </div>
            <Button
              size="sm"
              variant="primary"
              block
              disabled={!fromDate || !toDate || from > to}
              onClick={() => fromDate && toDate && choose({ from: fromDate, to: toDate })}
            >
              Aplicar rango
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
