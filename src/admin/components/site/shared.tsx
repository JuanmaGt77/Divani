/**
 * Piezas comunes de la sección Sitio web: texto con énfasis, enlaces de la tienda, reordenar listas
 * y el selector de prendas.
 */
import { useEffect, useId, useState, type MouseEvent } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { dateMedium, money } from '@/lib/format';
import { storeHref } from '@/lib/model';
import type { Product, Taxonomy, Tone } from '@/lib/types';
import { matches } from '../../lib/hooks';
import { invalidate, type Topic } from '../../lib/query';
import { Field, IconButton, SearchField, TextField } from '../../ui/controls';
import { Sheet, toastError } from '../../ui/overlays';
import { Thumb } from '../../ui/surfaces';

export const EMPH = 'Escribe entre *asteriscos* la parte que va en cursiva elegante.';

/** Texto con *énfasis*: la parte entre asteriscos va en cursiva, igual que en la tienda. */
export function Emph({ text }: { text: string | null | undefined }) {
  return (
    <>
      {String(text || '')
        .split(/(\*[^*]+\*)/)
        .map((part, i) => (/^\*[^*]+\*$/.test(part) ? <em key={i}>{part.slice(1, -1)}</em> : part))}
    </>
  );
}

const GENERAL = [
  { value: '/tienda', label: 'Toda la tienda' },
  { value: '/tienda?orden=nuevo', label: 'Novedades' },
  { value: '/tienda?oferta=1', label: 'Ofertas' },
  { value: '/#look', label: 'Arma tu look' },
];

/** Selector de «a dónde lleva el botón»: secciones de la tienda, una búsqueda u otro enlace. */
export function LinkField({
  label = 'A dónde lleva el botón',
  value,
  onValue,
  tax,
}: {
  label?: string;
  value: string;
  onValue: (v: string) => void;
  tax: Taxonomy | undefined;
}) {
  const id = useId();
  const deps = tax?.departments || [];
  const cats = tax?.categories || [];
  // Los enlaces guardados con el formato anterior (tienda.html?…) se leen con el actual
  const current = storeHref(value);
  const presets = [
    ...GENERAL.map((o) => o.value),
    ...deps.map((d) => `/tienda?depto=${d.slug}`),
    ...cats.map((c) => `/tienda?cat=${c.slug}`),
  ];
  // El tipo de enlace se deduce del valor: así siempre coincide con lo guardado
  const mode = presets.includes(current) ? 'preset' : /^\/tienda\?q=/.test(current) ? 'search' : 'custom';
  const term = mode === 'search' ? decodeURIComponent(current.replace(/^\/tienda\?q=/, '').replace(/\+/g, ' ')) : '';
  const depName = Object.fromEntries(deps.map((d) => [d.slug, d.name]));

  return (
    <>
      <Field label={label} htmlFor={id}>
        <select
          id={id}
          className="input"
          value={mode === 'preset' ? current : `__${mode}`}
          onChange={(e) => {
            const v = e.currentTarget.value;
            onValue(v === '__search' ? '/tienda?q=' : v === '__custom' ? '' : v);
          }}
        >
          <optgroup label="General">
            {GENERAL.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
          {deps.length > 0 && (
            <optgroup label="Departamentos">
              {deps.map((d) => (
                <option key={d.slug} value={`/tienda?depto=${d.slug}`}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          )}
          {cats.length > 0 && (
            <optgroup label="Categorías">
              {cats.map((c) => (
                <option key={c.slug} value={`/tienda?cat=${c.slug}`}>
                  {c.name} · {depName[c.department] || c.department}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Otro">
            <option value="__search">Resultados de una búsqueda…</option>
            <option value="__custom">Otro enlace…</option>
          </optgroup>
        </select>
      </Field>
      {mode === 'search' && (
        <TextField
          label="Palabra a buscar"
          value={term}
          placeholder="Ej. satín, mezclilla, blazer"
          onValue={(t) => onValue(`/tienda?q=${encodeURIComponent(t.replace(/^\s+/, ''))}`)}
        />
      )}
      {mode === 'custom' && (
        <TextField
          label="Enlace"
          value={value}
          placeholder="https://… o /tienda?…"
          onValue={(t) => onValue(t.trim())}
          hint="Puede ser una página de tu tienda o un sitio externo (https://)."
        />
      )}
    </>
  );
}

/** Nombre legible de un enlace de la tienda (para mostrarlo en las tarjetas). */
export function linkLabel(value: string | null | undefined, tax: Taxonomy | undefined): string {
  const v = storeHref(value);
  const g = GENERAL.find((o) => o.value === v);
  if (g) return g.label;
  let m = /^\/tienda\?depto=([\w-]+)$/.exec(v);
  if (m?.[1]) return tax?.departments?.find((d) => d.slug === m?.[1])?.name || m[1];
  m = /^\/tienda\?cat=([\w-]+)$/.exec(v);
  if (m?.[1]) return tax?.categories?.find((c) => c.slug === m?.[1])?.name || m[1];
  m = /^\/tienda\?q=(.*)$/.exec(v);
  if (m) return `Búsqueda «${decodeURIComponent((m[1] || '').replace(/\+/g, ' '))}»`;
  return v.replace(/^https?:\/\//, '') || 'Toda la tienda';
}

/**
 * Lista que se reordena al instante (y se guarda en segundo plano).
 *   const [list, move] = useOrdered(items, (x) => x.id, (ids) => api.content.reorderFaq(ids));
 */
export function useOrdered<T>(
  items: T[] | undefined,
  key: (x: T) => string,
  persist: (keys: string[]) => Promise<unknown>,
  topic: Topic = 'content',
): [T[], (from: number, to: number) => Promise<void>] {
  const [local, setLocal] = useState<T[] | null>(null);
  useEffect(() => setLocal(null), [items]);
  const list = local || items || [];
  const move = async (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [x] = next.splice(from, 1);
    if (x !== undefined) next.splice(to, 0, x);
    setLocal(next);
    try {
      await persist(next.map(key));
      invalidate(topic);
    } catch (err) {
      setLocal(null);
      toastError(err, 'No se pudo cambiar el orden');
    }
  };
  return [list, move];
}

export function MoveButtons({
  i,
  n,
  onMove,
  label = 'elemento',
}: {
  i: number;
  n: number;
  onMove: (from: number, to: number) => void;
  label?: string;
}) {
  const go = (e: MouseEvent, to: number) => {
    e.stopPropagation();
    onMove(i, to);
  };
  return (
    <span className="move-btns">
      <IconButton
        size="sm"
        icon={ChevronUp}
        label={`Subir ${label}`}
        disabled={i === 0}
        onClick={(e) => go(e, i - 1)}
      />
      <IconButton
        size="sm"
        icon={ChevronDown}
        label={`Bajar ${label}`}
        disabled={i === n - 1}
        onClick={(e) => go(e, i + 1)}
      />
    </span>
  );
}

/** Estado de algo con fechas: publicado, programado, terminado u oculto. */
export function scheduleState(
  x: { active?: boolean; startsAt?: string | null; endsAt?: string | null },
  now = Date.now(),
): { id: string; label: string; tone: Tone | undefined } {
  if (x.active === false) return { id: 'oculto', label: 'Oculto', tone: undefined };
  if (x.startsAt && new Date(x.startsAt).getTime() > now) {
    return { id: 'programado', label: `Desde ${dateMedium(x.startsAt)}`, tone: 'blue' };
  }
  if (x.endsAt && new Date(x.endsAt).getTime() < now)
    return { id: 'terminado', label: `Terminó ${dateMedium(x.endsAt)}`, tone: undefined };
  return { id: 'publicado', label: x.endsAt ? `Hasta ${dateMedium(x.endsAt)}` : 'Publicado', tone: 'green' };
}

/** <input type="datetime-local"> ⇄ ISO */
export const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

/** Hoja para elegir una prenda publicada (con buscador). */
export function ProductPicker({
  open,
  products,
  onPick,
  onClose,
  exclude,
}: {
  open: boolean;
  products: Product[] | undefined;
  onPick: (p: Product) => void;
  onClose: () => void;
  /** Slugs que ya están elegidos (no se muestran). */
  exclude?: string[];
}) {
  const [q, setQ] = useState('');
  useEffect(() => {
    if (open) setQ('');
  }, [open]);
  const list = (products || [])
    .filter(
      (p) =>
        p.status === 'activo' &&
        !exclude?.includes(p.slug) &&
        matches(
          q,
          p.name,
          p.code,
          p.tags,
          p.colors.map((c) => c.name),
        ),
    )
    .slice(0, 60);
  return (
    <Sheet open={open} onClose={onClose} title="Elige la prenda" sub="Solo aparecen productos activos">
      <div className="stack" style={{ '--gap': '12px' }}>
        <SearchField value={q} onValue={setQ} placeholder="Buscar por nombre, color o código" />
        <div className="pick-list" style={{ maxHeight: 'min(56vh, 520px)' }}>
          {list.map((p) => (
            <button key={p.id} type="button" className="pick-row" onClick={() => onPick(p)}>
              <Thumb src={p.colors[0]?.images?.[0]} size={36} />
              <span className="grow">
                <strong>{p.name}</strong>
                <small>{p.colors.map((c) => c.name).join(' · ')}</small>
              </span>
              <span className="num strong">{money(p.price)}</span>
            </button>
          ))}
          {!list.length && (
            <p className="small muted" style={{ padding: '18px', textAlign: 'center' }}>
              No hay productos con esa búsqueda.
            </p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
