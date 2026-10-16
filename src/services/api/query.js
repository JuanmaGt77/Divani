/**
 * Filtros, orden y paginación del catálogo.
 * Función pura: la usa el adaptador de prueba y puedes reutilizarla tal cual en un
 * backend en Node para responder GET /products con exactamente la misma lógica.
 */

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const list = (v) => (Array.isArray(v) ? v : String(v ?? '').split(',')).map((s) => String(s).trim()).filter(Boolean);
const bool = (v) => v === true || v === 'true' || v === '1' || v === 1;
const stockOf = (p) => (p.sizes || []).reduce((a, s) => a + (s.stock || 0), 0);

export const SORTS = {
  destacados: (a, b) => (b.isFeatured - a.isFeatured) || (b.isBestseller - a.isBestseller) || cmpDate(a, b),
  nuevo: (a, b) => cmpDate(a, b),
  'precio-asc': (a, b) => a.price - b.price,
  'precio-desc': (a, b) => b.price - a.price,
  populares: (a, b) => (b.isBestseller - a.isBestseller) || cmpDate(a, b),
};
function cmpDate(a, b) {
  return String(b.createdAt).localeCompare(String(a.createdAt));
}

function matchesText(p, q, categoriesBySlug) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = norm([
    p.name, p.description, p.material, (p.tags || []).join(' '),
    (p.colors || []).map((c) => c.name).join(' '),
    categoriesBySlug?.[p.category]?.name, p.department,
  ].join(' '));
  return words.every((w) => hay.includes(w) || (w.length > 4 && hay.includes(w.slice(0, -1))));
}

/**
 * @param {Array} products
 * @param {Object} q { department, category, size, color, minPrice, maxPrice, onSale, isNew, isBestseller, inStock, q, sort, page, pageSize, ids }
 * @param {Object} [ctx] { categories } para buscar por nombre de categoría
 * @returns {{ data: Array, meta: { total, page, pageSize, pages }, facets }}
 */
export function queryProducts(products, q = {}, ctx = {}) {
  const categoriesBySlug = Object.fromEntries((ctx.categories || []).map((c) => [c.slug, c]));
  const cats = list(q.category);
  const sizes = list(q.size);
  const colors = list(q.color);
  const ids = list(q.ids);
  const min = q.minPrice !== undefined && q.minPrice !== '' ? Number(q.minPrice) : null;
  const max = q.maxPrice !== undefined && q.maxPrice !== '' ? Number(q.maxPrice) : null;

  // Base: departamento + texto (las facetas se calculan sobre esta base)
  const base = products.filter((p) =>
    (!q.department || p.department === q.department) &&
    (!q.q || matchesText(p, q.q, categoriesBySlug)) &&
    (!ids.length || ids.includes(p.slug) || ids.includes(p.id)));

  const filtered = base.filter((p) =>
    (!cats.length || cats.includes(p.category)) &&
    (!sizes.length || (p.sizes || []).some((s) => sizes.includes(s.label) && s.stock > 0)) &&
    (!colors.length || (p.colors || []).some((c) => colors.includes(c.family))) &&
    (min === null || p.price >= min) &&
    (max === null || p.price <= max) &&
    (!bool(q.onSale) || (p.compareAtPrice && p.compareAtPrice > p.price)) &&
    (!bool(q.isNew) || p.isNew) &&
    (!bool(q.isBestseller) || p.isBestseller) &&
    (!bool(q.inStock) || stockOf(p) > 0));

  const sorter = SORTS[q.sort] || SORTS.destacados;
  const sorted = [...filtered].sort(sorter);
  const pageSize = Math.max(1, Math.min(100, Number(q.pageSize) || 12));
  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pages, Math.max(1, Number(q.page) || 1));
  const data = sorted.slice((page - 1) * pageSize, page * pageSize);

  return { data, meta: { total, page, pageSize, pages }, facets: facetsOf(base) };
}

/** Opciones disponibles para los filtros (con conteos). */
export function facetsOf(items) {
  const categories = {}, sizes = {}, colors = {};
  let minPrice = Infinity, maxPrice = 0;
  for (const p of items) {
    categories[p.category] = (categories[p.category] || 0) + 1;
    for (const s of p.sizes || []) if (s.stock > 0) sizes[s.label] = (sizes[s.label] || 0) + 1;
    for (const fam of new Set((p.colors || []).map((c) => c.family))) colors[fam] = (colors[fam] || 0) + 1;
    minPrice = Math.min(minPrice, p.price);
    maxPrice = Math.max(maxPrice, p.price);
  }
  return { categories, sizes, colors, price: { min: Number.isFinite(minPrice) ? minPrice : 0, max: maxPrice } };
}
