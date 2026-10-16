import { SITE, CATALOG } from '../config/site.config.js';

const currency = new Intl.NumberFormat(SITE.locale, { style: 'currency', currency: SITE.currency, maximumFractionDigits: 0 });

export const money = (n) => currency.format(Number(n) || 0);

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
