/**
 * Formato de dinero, números y fechas según la región configurada en el panel
 * (Configuración → Región y moneda).
 */
let region = { locale: 'es-MX', currency: 'MXN' };
let cache = {};

export function setRegion(next = {}) {
  region = { ...region, ...Object.fromEntries(Object.entries(next).filter(([, v]) => v)) };
  cache = {};
}
export const getRegion = () => region;

const nf = (key, opts) => {
  if (!cache[key]) {
    try { cache[key] = new Intl.NumberFormat(region.locale, opts); } catch { cache[key] = new Intl.NumberFormat('es-MX', opts); }
  }
  return cache[key];
};
const df = (key, opts) => {
  if (!cache[key]) {
    try { cache[key] = new Intl.DateTimeFormat(region.locale, opts); } catch { cache[key] = new Intl.DateTimeFormat('es-MX', opts); }
  }
  return cache[key];
};

/** $1,250 · con centavos solo cuando hacen falta (o siempre con cents: true). */
export function money(n, { cents = 'auto' } = {}) {
  const v = Number(n) || 0;
  const withCents = cents === true || (cents === 'auto' && Math.round(v * 100) % 100 !== 0);
  return withCents
    ? nf(`m2${region.currency}`, { style: 'currency', currency: region.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
    : nf(`m0${region.currency}`, { style: 'currency', currency: region.currency, maximumFractionDigits: 0 }).format(v);
}

/** Importe redondeado a enteros (para totales y gráficas). */
export const moneyR = (n) => money(Math.round(Number(n) || 0), { cents: false });

/** Símbolo de la moneda ($, Q…). */
export function currencySymbol() {
  const parts = nf(`m0${region.currency}`, { style: 'currency', currency: region.currency, maximumFractionDigits: 0 }).formatToParts(0);
  return parts.find((p) => p.type === 'currency')?.value || '$';
}

/** $12.5k · para ejes de gráficas y espacios chicos. */
export function moneyCompact(n) {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  const s = currencySymbol();
  if (a >= 1e6) return `${v < 0 ? '−' : ''}${s}${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (a >= 1e3) return `${v < 0 ? '−' : ''}${s}${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '')}k`;
  return money(v, { cents: false });
}

export const number = (n, digits = 0) => nf(`n${digits}`, { maximumFractionDigits: digits }).format(Number(n) || 0);
export const percent = (n, digits = 0) => nf(`p${digits}`, { style: 'percent', maximumFractionDigits: digits }).format(Number(n) || 0);

/** Variación entre dos valores como texto: +12 %, −3 %. */
export function delta(curr, prev) {
  if (!prev) return curr ? { text: 'nuevo', dir: 'up' } : { text: '—', dir: 'flat' };
  const d = (curr - prev) / Math.abs(prev);
  if (Math.abs(d) < 0.005) return { text: '0 %', dir: 'flat', value: 0 };
  return { text: `${d > 0 ? '+' : '−'}${percent(Math.abs(d), Math.abs(d) < 0.1 ? 1 : 0)}`, dir: d > 0 ? 'up' : 'down', value: d };
}

/* ---------- fechas ---------- */
const toDate = (d) => (d instanceof Date ? d : new Date(d));
export const time = (d) => df('t', { hour: 'numeric', minute: '2-digit' }).format(toDate(d));
export const dateShort = (d) => df('ds', { day: 'numeric', month: 'short' }).format(toDate(d)).replace('.', '');
export const dateMedium = (d) => df('dm', { day: 'numeric', month: 'short', year: 'numeric' }).format(toDate(d)).replace('.', '');
export const dateLong = (d) => df('dl', { weekday: 'long', day: 'numeric', month: 'long' }).format(toDate(d));
export const monthYear = (d) => df('my', { month: 'long', year: 'numeric' }).format(toDate(d));
export const weekday = (d) => df('wd', { weekday: 'short' }).format(toDate(d)).replace('.', '');
export const dateTime = (d) => `${dateShort(d)} · ${time(d)}`;

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** «hace 5 min», «hoy 10:32», «ayer 18:05», «12 oct». */
export function relative(d) {
  if (!d) return '—';
  const t = toDate(d);
  const now = new Date();
  const diff = (now - t) / 1000;
  if (diff < 60 && diff > -60) return 'justo ahora';
  if (diff > 0 && diff < 3600) return `hace ${Math.round(diff / 60)} min`;
  if (sameDay(t, now)) return `hoy ${time(t)}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(t, y)) return `ayer ${time(t)}`;
  return t.getFullYear() === now.getFullYear() ? dateShort(t) : dateMedium(t);
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

/** Teléfono legible: 523312345678 → +52 33 1234 5678. */
export function phone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  let m = /^(52)1?(\d{2})(\d{4})(\d{4})$/.exec(d);
  if (m) return `+${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  m = /^(502)(\d{4})(\d{4})$/.exec(d);
  if (m) return `+${m[1]} ${m[2]} ${m[3]}`;
  m = /^(1)(\d{3})(\d{3})(\d{4})$/.exec(d);
  if (m) return `+${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  m = /^(\d{2})(\d{4})(\d{4})$/.exec(d);
  if (m) return `${m[1]} ${m[2]} ${m[3]}`;
  return d.length > 10 ? `+${d}` : d;
}

export const plural = (n, one, many) => `${number(n)} ${n === 1 ? one : many}`;

export const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
