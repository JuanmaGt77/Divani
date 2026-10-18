/**
 * Formato de dinero, números y fechas según la región configurada en el panel
 * (Configuración → Región y moneda). Lo usan la tienda y el panel.
 */
import { DEFAULT_SETTINGS } from './model';
import type { RegionSettings } from './types';

type Region = Pick<RegionSettings, 'locale' | 'currency'>;

let region: Region = {
  locale: DEFAULT_SETTINGS.public.region.locale,
  currency: DEFAULT_SETTINGS.public.region.currency,
};
let cache: Record<string, Intl.NumberFormat | Intl.DateTimeFormat> = {};

/** Cambia la región (moneda e idioma) de todos los formatos. */
export function setRegion(next: Partial<RegionSettings> = {}): void {
  const valid: Partial<Region> = {};
  if (next.locale) valid.locale = next.locale;
  if (next.currency) valid.currency = next.currency;
  try {
    // Un código de moneda inválido no debe romper la página: se conserva el anterior
    new Intl.NumberFormat(valid.locale ?? region.locale, {
      style: 'currency',
      currency: valid.currency ?? region.currency,
    });
    region = { ...region, ...valid };
  } catch {
    return;
  }
  cache = {};
}

export const getRegion = (): Region => region;

const nf = (key: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat => {
  if (!cache[key]) {
    try {
      cache[key] = new Intl.NumberFormat(region.locale, opts);
    } catch {
      cache[key] = new Intl.NumberFormat('es', opts);
    }
  }
  return cache[key] as Intl.NumberFormat;
};

const df = (key: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
  if (!cache[key]) {
    try {
      cache[key] = new Intl.DateTimeFormat(region.locale, opts);
    } catch {
      cache[key] = new Intl.DateTimeFormat('es', opts);
    }
  }
  return cache[key] as Intl.DateTimeFormat;
};

/** Q1,250 · con centavos solo cuando hacen falta (o siempre con cents: true). */
export function money(n: unknown, { cents = 'auto' }: { cents?: boolean | 'auto' } = {}): string {
  const v = Number(n) || 0;
  const withCents = cents === true || (cents === 'auto' && Math.round(v * 100) % 100 !== 0);
  return withCents
    ? nf(`m2${region.currency}`, {
        style: 'currency',
        currency: region.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(v)
    : nf(`m0${region.currency}`, { style: 'currency', currency: region.currency, maximumFractionDigits: 0 }).format(v);
}

/** Importe redondeado a enteros (para totales y gráficas). */
export const moneyR = (n: unknown): string => money(Math.round(Number(n) || 0), { cents: false });

/** Símbolo de la moneda (Q, $…). */
export function currencySymbol(): string {
  const parts = nf(`m0${region.currency}`, {
    style: 'currency',
    currency: region.currency,
    maximumFractionDigits: 0,
  }).formatToParts(0);
  return parts.find((p) => p.type === 'currency')?.value || '$';
}

/** Q12.5k · para ejes de gráficas y espacios chicos. */
export function moneyCompact(n: unknown): string {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  const s = currencySymbol();
  const sign = v < 0 ? '−' : '';
  if (a >= 1e6) return `${sign}${s}${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (a >= 1e3) return `${sign}${s}${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '')}k`;
  return money(v, { cents: false });
}

export const number = (n: unknown, digits = 0): string =>
  nf(`n${digits}`, { maximumFractionDigits: digits }).format(Number(n) || 0);

export const percent = (n: unknown, digits = 0): string =>
  nf(`p${digits}`, { style: 'percent', maximumFractionDigits: digits }).format(Number(n) || 0);

export interface Delta {
  text: string;
  dir: 'up' | 'down' | 'flat';
  value?: number;
}

/** Variación entre dos valores como texto: +12 %, −3 %. */
export function delta(curr: number, prev: number): Delta {
  if (!prev) return curr ? { text: 'nuevo', dir: 'up' } : { text: '—', dir: 'flat' };
  const d = (curr - prev) / Math.abs(prev);
  if (Math.abs(d) < 0.005) return { text: '0 %', dir: 'flat', value: 0 };
  return {
    text: `${d > 0 ? '+' : '−'}${percent(Math.abs(d), Math.abs(d) < 0.1 ? 1 : 0)}`,
    dir: d > 0 ? 'up' : 'down',
    value: d,
  };
}

/* ---------- fechas ---------- */
export type DateInput = Date | string | number;
const toDate = (d: DateInput): Date => (d instanceof Date ? d : new Date(d));

export const time = (d: DateInput): string => df('t', { hour: 'numeric', minute: '2-digit' }).format(toDate(d));
export const dateShort = (d: DateInput): string =>
  df('ds', { day: 'numeric', month: 'short' }).format(toDate(d)).replace('.', '');
export const dateMedium = (d: DateInput): string =>
  df('dm', { day: 'numeric', month: 'short', year: 'numeric' }).format(toDate(d)).replace('.', '');
export const dateLong = (d: DateInput): string =>
  df('dl', { weekday: 'long', day: 'numeric', month: 'long' }).format(toDate(d));
export const monthYear = (d: DateInput): string => df('my', { month: 'long', year: 'numeric' }).format(toDate(d));
export const weekday = (d: DateInput): string => df('wd', { weekday: 'short' }).format(toDate(d)).replace('.', '');
export const dateTime = (d: DateInput): string => `${dateShort(d)} · ${time(d)}`;

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** «hace 5 min», «hoy 10:32», «ayer 18:05», «12 oct». */
export function relative(d: DateInput | null | undefined): string {
  if (!d) return '—';
  const t = toDate(d);
  const now = new Date();
  const diff = (now.getTime() - t.getTime()) / 1000;
  if (diff < 60 && diff > -60) return 'justo ahora';
  if (diff > 0 && diff < 3600) return `hace ${Math.round(diff / 60)} min`;
  if (sameDay(t, now)) return `hoy ${time(t)}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(t, y)) return `ayer ${time(t)}`;
  return t.getFullYear() === now.getFullYear() ? dateShort(t) : dateMedium(t);
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

/** Teléfono legible: 50255551234 → +502 5555 1234. */
export function phone(raw: unknown): string {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  let m = /^(502)(\d{4})(\d{4})$/.exec(d);
  if (m) return `+${m[1]} ${m[2]} ${m[3]}`;
  m = /^(52)1?(\d{2})(\d{4})(\d{4})$/.exec(d);
  if (m) return `+${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  m = /^(1)(\d{3})(\d{3})(\d{4})$/.exec(d);
  if (m) return `+${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  m = /^(\d{4})(\d{4})$/.exec(d);
  if (m) return `${m[1]} ${m[2]}`;
  m = /^(\d{2})(\d{4})(\d{4})$/.exec(d);
  if (m) return `${m[1]} ${m[2]} ${m[3]}`;
  return d.length > 10 ? `+${d}` : d;
}

/** «1 pieza», «3 piezas». */
export const plural = (n: number, one: string, many: string): string => `${number(n)} ${n === 1 ? one : many}`;

export const initials = (name: unknown): string =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
