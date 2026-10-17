/** Rangos de fechas para filtros y reportes (hora local del navegador). */

export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const startOfMonth = (d) => { const x = startOfDay(d); x.setDate(1); return x; };
export const endOfMonth = (d) => { const x = startOfMonth(d); x.setMonth(x.getMonth() + 1); x.setMilliseconds(-1); return x; };
export const startOfWeek = (d) => { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; };

/** Clave del día en hora local: 2026-10-17 */
export function dayKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export const monthKey = (d) => dayKey(d).slice(0, 7);
export const weekKey = (d) => dayKey(startOfWeek(d));

export const toInputDate = (d) => (d ? dayKey(d) : '');
export function fromInputDate(s, end = false) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return end ? endOfDay(d) : d;
}

export const PRESETS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'ayer', label: 'Ayer' },
  { id: '7d', label: 'Últimos 7 días' },
  { id: '30d', label: 'Últimos 30 días' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mes-pasado', label: 'Mes pasado' },
  { id: '90d', label: 'Últimos 90 días' },
  { id: 'anio', label: 'Este año' },
];

export function rangeFor(id, now = new Date()) {
  const today = startOfDay(now);
  switch (id) {
    case 'hoy': return { from: today, to: endOfDay(now) };
    case 'ayer': return { from: addDays(today, -1), to: endOfDay(addDays(today, -1)) };
    case '7d': return { from: addDays(today, -6), to: endOfDay(now) };
    case 'mes': return { from: startOfMonth(now), to: endOfDay(now) };
    case 'mes-pasado': { const m = startOfMonth(addDays(startOfMonth(now), -1)); return { from: m, to: endOfMonth(m) }; }
    case '90d': return { from: addDays(today, -89), to: endOfDay(now) };
    case 'anio': return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    case '30d':
    default: return { from: addDays(today, -29), to: endOfDay(now) };
  }
}

/** Periodo anterior de la misma duración (para comparar). */
export function previousRange({ from, to }) {
  const len = to - from;
  const prevTo = new Date(from.getTime() - 1);
  return { from: new Date(prevTo.getTime() - len), to: prevTo };
}

export function eachDay(from, to) {
  const out = [];
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Agrupación conveniente para una gráfica según la duración del rango. */
export function granularity({ from, to }) {
  const days = (to - from) / 864e5;
  if (days <= 45) return 'day';
  if (days <= 200) return 'week';
  return 'month';
}

export function buckets({ from, to }, unit = granularity({ from, to })) {
  const out = [];
  if (unit === 'day') for (const d of eachDay(from, to)) out.push({ key: dayKey(d), date: d });
  else if (unit === 'week') for (let d = startOfWeek(from); d <= to; d = addDays(d, 7)) out.push({ key: dayKey(d), date: d });
  else for (let d = startOfMonth(from); d <= to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) out.push({ key: monthKey(d), date: d });
  return out;
}

export const bucketKey = (d, unit) => (unit === 'day' ? dayKey(d) : unit === 'week' ? weekKey(d) : monthKey(d));

export const inRange = (iso, { from, to }) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
};
