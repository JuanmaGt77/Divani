/**
 * Filtros, orden y paginación del catálogo de la tienda. Función pura: recibe los productos
 * que devuelve storefront() y responde la página pedida con sus facetas (opciones de filtro).
 */
import { normalize } from './model';
import type { StoreCategory, StoreProduct } from './types';

export type SortKey = 'destacados' | 'nuevo' | 'precio-asc' | 'precio-desc' | 'populares';

export interface ProductQuery {
  department?: string;
  category?: string | string[];
  size?: string | string[];
  color?: string | string[];
  minPrice?: string | number;
  maxPrice?: string | number;
  onSale?: boolean;
  isNew?: boolean;
  isBestseller?: boolean;
  inStock?: boolean;
  q?: string;
  sort?: SortKey | string;
  page?: number;
  pageSize?: number;
  ids?: string[];
}

export interface Facets {
  categories: Record<string, number>;
  sizes: Record<string, number>;
  colors: Record<string, number>;
  price: { min: number; max: number };
}

export interface ProductPage {
  data: StoreProduct[];
  meta: { total: number; page: number; pageSize: number; pages: number };
  facets: Facets;
}

const list = (v: string | string[] | undefined): string[] =>
  (Array.isArray(v) ? v : String(v ?? '').split(',')).map((s) => String(s).trim()).filter(Boolean);
const stockOf = (p: StoreProduct): number => (p.sizes || []).reduce((a, s) => a + (s.stock || 0), 0);
const cmpDate = (a: StoreProduct, b: StoreProduct): number => String(b.createdAt).localeCompare(String(a.createdAt));

export const SORTS: Record<SortKey, (a: StoreProduct, b: StoreProduct) => number> = {
  destacados: (a, b) => +b.isFeatured - +a.isFeatured || +b.isBestseller - +a.isBestseller || cmpDate(a, b),
  nuevo: (a, b) => cmpDate(a, b),
  'precio-asc': (a, b) => a.price - b.price,
  'precio-desc': (a, b) => b.price - a.price,
  populares: (a, b) => +b.isBestseller - +a.isBestseller || cmpDate(a, b),
};

function matchesText(p: StoreProduct, q: string, categoriesBySlug: Record<string, StoreCategory>): boolean {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = normalize(
    [
      p.name,
      p.description,
      p.material,
      (p.tags || []).join(' '),
      (p.colors || []).map((c) => c.name).join(' '),
      p.category ? categoriesBySlug[p.category]?.name : '',
      p.department,
    ].join(' '),
  );
  // «vestidos» también encuentra «vestido»
  return words.every((w) => hay.includes(w) || (w.length > 4 && hay.includes(w.slice(0, -1))));
}

/** Opciones disponibles para los filtros (con conteos). */
export function facetsOf(items: StoreProduct[]): Facets {
  const categories: Record<string, number> = {};
  const sizes: Record<string, number> = {};
  const colors: Record<string, number> = {};
  let minPrice = Infinity;
  let maxPrice = 0;
  for (const p of items) {
    if (p.category) categories[p.category] = (categories[p.category] || 0) + 1;
    for (const s of p.sizes || []) if (s.stock > 0) sizes[s.label] = (sizes[s.label] || 0) + 1;
    for (const fam of new Set((p.colors || []).map((c) => c.family))) colors[fam] = (colors[fam] || 0) + 1;
    minPrice = Math.min(minPrice, p.price);
    maxPrice = Math.max(maxPrice, p.price);
  }
  return { categories, sizes, colors, price: { min: Number.isFinite(minPrice) ? minPrice : 0, max: maxPrice } };
}

export function queryProducts(
  products: StoreProduct[],
  q: ProductQuery = {},
  ctx: { categories?: StoreCategory[] } = {},
): ProductPage {
  const categoriesBySlug = Object.fromEntries((ctx.categories || []).map((c) => [c.slug, c]));
  const cats = list(q.category);
  const sizes = list(q.size);
  const colors = list(q.color);
  const ids = q.ids || [];
  const min = q.minPrice !== undefined && q.minPrice !== '' ? Number(q.minPrice) : null;
  const max = q.maxPrice !== undefined && q.maxPrice !== '' ? Number(q.maxPrice) : null;

  // Base: departamento + texto (las facetas se calculan sobre esta base)
  const base = products.filter(
    (p) =>
      (!q.department || p.department === q.department) &&
      (!q.q || matchesText(p, q.q, categoriesBySlug)) &&
      (!ids.length || ids.includes(p.slug) || ids.includes(p.id)),
  );

  const filtered = base.filter(
    (p) =>
      (!cats.length || (p.category !== null && cats.includes(p.category))) &&
      (!sizes.length || (p.sizes || []).some((s) => sizes.includes(s.label) && s.stock > 0)) &&
      (!colors.length || (p.colors || []).some((c) => colors.includes(c.family))) &&
      (min === null || p.price >= min) &&
      (max === null || p.price <= max) &&
      (!q.onSale || (p.compareAtPrice !== null && p.compareAtPrice > p.price)) &&
      (!q.isNew || p.isNew) &&
      (!q.isBestseller || p.isBestseller) &&
      (!q.inStock || stockOf(p) > 0),
  );

  const sorter = SORTS[q.sort as SortKey] || SORTS.destacados;
  const sorted = [...filtered].sort(sorter);
  const pageSize = Math.max(1, Math.min(100, Number(q.pageSize) || 12));
  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pages, Math.max(1, Number(q.page) || 1));
  const data = sorted.slice((page - 1) * pageSize, page * pageSize);

  return { data, meta: { total, page, pageSize, pages }, facets: facetsOf(base) };
}
