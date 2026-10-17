/** Piezas comunes de la sección Sitio web: texto con énfasis, enlaces de la tienda y reordenar listas. */
import { useEffect, useId, useState } from 'preact/hooks';
import { ChevronUp, ChevronDown } from 'lucide-preact';
import { invalidate } from '../../lib/query.js';
import { dateMedium } from '../../lib/format.js';
import { Field, TextField, IconButton } from '../../ui/controls.jsx';
import { toastError } from '../../ui/overlays.jsx';

export const EMPH = 'Escribe entre *asteriscos* la parte que va en cursiva elegante.';

/** Texto con *énfasis*: la parte entre asteriscos va en cursiva, igual que en la tienda. */
export function Emph({ text }) {
  return String(text || '').split(/(\*[^*]+\*)/).map((part) => (/^\*[^*]+\*$/.test(part) ? <em>{part.slice(1, -1)}</em> : part));
}

const GENERAL = [
  { value: 'tienda.html', label: 'Toda la tienda' },
  { value: 'tienda.html?orden=nuevo', label: 'Novedades' },
  { value: 'tienda.html?oferta=1', label: 'Ofertas' },
  { value: 'index.html#look', label: 'Arma tu look' },
];

/** Selector de «a dónde lleva el botón»: secciones de la tienda, una búsqueda u otro enlace. */
export function LinkField({ label = 'A dónde lleva el botón', value, onValue, tax }) {
  const id = useId();
  const deps = tax?.departments || [];
  const cats = tax?.categories || [];
  const presets = [
    ...GENERAL,
    ...deps.map((d) => ({ value: `tienda.html?depto=${d.slug}` })),
    ...cats.map((c) => ({ value: `tienda.html?cat=${c.slug}` })),
  ];
  // El tipo de enlace se deduce del valor: así siempre coincide con lo guardado
  const mode = presets.some((o) => o.value === value) ? 'preset' : /^tienda\.html\?q=/.test(value || '') ? 'search' : 'custom';
  const term = mode === 'search' ? decodeURIComponent(String(value).replace(/^tienda\.html\?q=/, '').replace(/\+/g, ' ')) : '';
  const depName = Object.fromEntries(deps.map((d) => [d.slug, d.name]));

  return (
    <>
      <Field label={label} htmlFor={id}>
        <select
          id={id}
          class="input"
          value={mode === 'preset' ? value : `__${mode}`}
          onChange={(e) => {
            const v = e.currentTarget.value;
            onValue(v === '__search' ? 'tienda.html?q=' : v === '__custom' ? '' : v);
          }}
        >
          <optgroup label="General">{GENERAL.map((o) => <option value={o.value}>{o.label}</option>)}</optgroup>
          {deps.length > 0 && <optgroup label="Departamentos">{deps.map((d) => <option value={`tienda.html?depto=${d.slug}`}>{d.name}</option>)}</optgroup>}
          {cats.length > 0 && <optgroup label="Categorías">{cats.map((c) => <option value={`tienda.html?cat=${c.slug}`}>{c.name} · {depName[c.department] || c.department}</option>)}</optgroup>}
          <optgroup label="Otro">
            <option value="__search">Resultados de una búsqueda…</option>
            <option value="__custom">Otro enlace…</option>
          </optgroup>
        </select>
      </Field>
      {mode === 'search' && (
        <TextField label="Palabra a buscar" value={term} placeholder="Ej. satín, mezclilla, blazer" onValue={(t) => onValue(`tienda.html?q=${encodeURIComponent(t.replace(/^\s+/, ''))}`)} />
      )}
      {mode === 'custom' && (
        <TextField label="Enlace" value={value} placeholder="https://… o tienda.html?…" onValue={(t) => onValue(t.trim())} hint="Puede ser una página de tu tienda o un sitio externo (https://)." />
      )}
    </>
  );
}

/** Nombre legible de un enlace de la tienda (para mostrarlo en las tarjetas). */
export function linkLabel(value, tax) {
  const v = String(value || '');
  const g = GENERAL.find((o) => o.value === v);
  if (g) return g.label;
  let m = /^tienda\.html\?depto=([\w-]+)$/.exec(v);
  if (m) return tax?.departments?.find((d) => d.slug === m[1])?.name || m[1];
  m = /^tienda\.html\?cat=([\w-]+)$/.exec(v);
  if (m) return tax?.categories?.find((c) => c.slug === m[1])?.name || m[1];
  m = /^tienda\.html\?q=(.*)$/.exec(v);
  if (m) return `Búsqueda «${decodeURIComponent(m[1].replace(/\+/g, ' '))}»`;
  return v.replace(/^https?:\/\//, '') || 'Toda la tienda';
}

/**
 * Lista que se reordena al instante (y se guarda en segundo plano).
 *   const [list, move] = useOrdered(items, (x) => x.id, (ids) => api.content.reorderFaq(ids));
 */
export function useOrdered(items, key, persist, topic = 'content') {
  const [local, setLocal] = useState(null);
  useEffect(() => setLocal(null), [items]);
  const list = local || items || [];
  const move = async (from, to) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
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

export function MoveButtons({ i, n, onMove, label = 'elemento' }) {
  return (
    <span class="move-btns">
      <IconButton size="sm" icon={ChevronUp} label={`Subir ${label}`} disabled={i === 0} onClick={(e) => { e.stopPropagation(); onMove(i, i - 1); }} />
      <IconButton size="sm" icon={ChevronDown} label={`Bajar ${label}`} disabled={i === n - 1} onClick={(e) => { e.stopPropagation(); onMove(i, i + 1); }} />
    </span>
  );
}

/** Estado de algo con fechas: publicado, programado, terminado u oculto. */
export function scheduleState(x, now = Date.now()) {
  if (x.active === false) return { id: 'oculto', label: 'Oculto', tone: undefined };
  if (x.startsAt && new Date(x.startsAt).getTime() > now) return { id: 'programado', label: `Desde ${dateMedium(x.startsAt)}`, tone: 'blue' };
  if (x.endsAt && new Date(x.endsAt).getTime() < now) return { id: 'terminado', label: `Terminó ${dateMedium(x.endsAt)}`, tone: undefined };
  return { id: 'publicado', label: x.endsAt ? `Hasta ${dateMedium(x.endsAt)}` : 'Publicado', tone: 'green' };
}

/** <input type="datetime-local"> ⇄ ISO */
export const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
