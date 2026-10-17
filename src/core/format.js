import { SITE, CATALOG } from '../config/site.config.js';

const makeFormat = (locale, cur) => [0, 2].map((d) => new Intl.NumberFormat(locale, { style: 'currency', currency: cur, minimumFractionDigits: d, maximumFractionDigits: d }));
let formats = makeFormat(SITE.locale, SITE.currency);

/** Cambia el formato de los precios (lo llama la región configurada en el panel). */
export function setMoneyFormat(locale, cur) {
  try { formats = makeFormat(locale, cur); } catch { /* código de moneda inválido: se queda el anterior */ }
}

/** $1,250 · con centavos solo cuando el precio los tiene ($89.50). */
export const money = (n) => {
  const v = Number(n) || 0;
  return formats[Math.round(v * 100) % 100 ? 1 : 0].format(v);
};

export const discountPct = (p) =>
  p?.compareAtPrice && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0;

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const normalize = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const totalStock = (p) => (p?.sizes || []).reduce((a, s) => a + (s.stock || 0), 0);

export function isNew(p) {
  if (p.isNew) return true;
  if (!p.createdAt) return false;
  return Date.now() - new Date(p.createdAt).getTime() < CATALOG.newDays * 864e5;
}

/** Etiquetas visibles de un producto, en orden de prioridad. */
export function badgesOf(p) {
  const out = [];
  const stock = totalStock(p);
  if (stock === 0) out.push({ id: 'agotado', label: 'Agotado' });
  const pct = discountPct(p);
  if (pct) out.push({ id: 'oferta', label: `−${pct}%` });
  if (p.isNew) out.push({ id: 'nuevo', label: 'Nuevo' });
  if (stock > 0 && stock <= CATALOG.lowStock) out.push({ id: 'ultimas', label: 'Últimas piezas' });
  return out.slice(0, 2);
}
