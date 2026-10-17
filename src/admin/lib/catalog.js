/** Utilidades del catálogo para el panel: índice de variantes para buscar/escaner y etiquetas. */
import { normalize, variantLabel, sizeRank } from '../../backend/model.js';
import { code128Svg } from './barcode.js';
import { escHtml } from './print.js';
import { money } from './format.js';

/** Lista plana de variantes (una por color + talla) con lo necesario para buscarlas. */
export function variantIndex(products = [], { includeArchived = false } = {}) {
  const out = [];
  for (const p of products) {
    if (!includeArchived && p.status === 'archivado') continue;
    for (const v of p.variants || []) {
      const color = p.colors.find((c) => c.id === v.colorId);
      out.push({
        key: v.id,
        product: p,
        variant: v,
        color,
        label: variantLabel(p, v),
        image: color?.images?.[0] || p.colors[0]?.images?.[0] || '',
        hay: normalize(`${p.name} ${p.code} ${v.sku} ${color?.name || ''} ${v.size} ${(p.tags || []).join(' ')}`),
      });
    }
  }
  return out.sort((a, b) => a.product.name.localeCompare(b.product.name, 'es') || (a.color?.sort ?? 0) - (b.color?.sort ?? 0) || sizeRank(a.variant.size) - sizeRank(b.variant.size));
}

export function searchVariants(index, q, limit = 40) {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  if (!words.length) return index.slice(0, limit);
  const exact = index.filter((x) => x.variant.sku.toLowerCase() === String(q).trim().toLowerCase());
  if (exact.length) return exact;
  return index.filter((x) => words.every((w) => x.hay.includes(w))).slice(0, limit);
}

export const findBySku = (index, sku) => index.find((x) => x.variant.sku.toLowerCase() === String(sku || '').trim().toLowerCase()) || null;

/* ---------- Etiquetas ---------- */
export const LABEL_FORMATS = [
  { id: 'termica', name: 'Etiquetadora térmica 50 × 25 mm', page: '@page{size:50mm 25mm;margin:0}', perPage: 1 },
  { id: 'hoja', name: 'Hoja carta/A4 · 3 × 8 etiquetas', page: '@page{size:A4;margin:10mm 8mm}', perPage: 24 },
];

export function labelsDocument(items, { format = 'termica', showPrice = true, storeName = 'Divani' } = {}) {
  const labels = [];
  for (const it of items) for (let i = 0; i < Math.max(1, it.copies || 1); i++) labels.push(it);
  const one = (it) => `
    <div class="lbl">
      <div class="lbl__top"><span class="lbl__store">${escHtml(storeName)}</span>${showPrice ? `<span class="lbl__price">${escHtml(money(it.product.price))}</span>` : ''}</div>
      <div class="lbl__name">${escHtml(it.product.name)}</div>
      <div class="lbl__meta">${escHtml(it.label)}</div>
      <div class="lbl__code">${code128Svg(it.variant.sku, { height: 40 })}</div>
      <div class="lbl__sku">${escHtml(it.variant.sku)}</div>
    </div>`;
  const fmt = LABEL_FORMATS.find((f) => f.id === format) || LABEL_FORMATS[0];
  const css = `${fmt.page}
    body{width:auto;font-size:8pt}
    .lbl{display:flex;flex-direction:column;justify-content:center;gap:.6mm;overflow:hidden;padding:1.6mm 2.4mm;box-sizing:border-box}
    .lbl__top{display:flex;justify-content:space-between;align-items:baseline;gap:2mm}
    .lbl__store{font-family:"Bodoni Moda",serif;font-size:7.5pt;letter-spacing:.06em}
    .lbl__price{font-weight:600;font-size:9.5pt}
    .lbl__name{font-weight:500;font-size:7.5pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .lbl__meta{font-size:6.8pt;color:#444}
    .lbl__code svg{width:100%;height:7mm;display:block}
    .lbl__sku{font-family:ui-monospace,Menlo,monospace;font-size:6.5pt;text-align:center;letter-spacing:.04em}
    ${format === 'termica'
    ? '.lbl{width:50mm;height:25mm;page-break-after:always;break-after:page}.lbl:last-child{page-break-after:auto;break-after:auto}'
    : '.sheet{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:34.5mm;gap:0 3mm}.lbl{border:0.2mm dashed #ccc;border-radius:1.5mm;height:34.5mm}.lbl__code svg{height:9mm}.lbl__name{font-size:8.5pt}.lbl__price{font-size:11pt}'}`;
  const body = format === 'termica' ? labels.map(one).join('') : `<div class="sheet">${labels.map(one).join('')}</div>`;
  return { body, css, count: labels.length };
}
