import { api } from './api/index.js';

let categoriesPromise;

export const CatalogService = {
  /** Lista paginada: { data, meta, facets } */
  listProducts: (query) => api.listProducts(query),

  getProduct: (slug) => api.getProduct(slug),

  /** Departamentos, categorías y familias de color (en caché durante la sesión). */
  getCategories() {
    categoriesPromise ??= api.getCategories().catch((err) => { categoriesPromise = null; throw err; });
    return categoriesPromise;
  },

  async search(q, { limit = 6 } = {}) {
    const res = await api.listProducts({ q, pageSize: limit, sort: 'destacados' });
    return res;
  },

  /** Productos por slug, conservando el orden pedido. */
  async getMany(slugs) {
    if (!slugs.length) return [];
    const res = await api.listProducts({ ids: slugs, pageSize: 100 });
    const bySlug = Object.fromEntries(res.data.map((p) => [p.slug, p]));
    return slugs.map((s) => bySlug[s]).filter(Boolean);
  },
};
