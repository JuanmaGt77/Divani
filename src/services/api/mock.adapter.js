/**
 * Adaptador de PRUEBA: lee los JSON de public/data/ y responde con la misma forma
 * que tendrá el backend real (ver docs/API.md). Cuando conectes tu API, la app usa
 * rest.adapter.js automáticamente (definiendo VITE_API_URL).
 */
import { API } from '../../config/site.config.js';
import { ApiError } from './http.js';
import { queryProducts } from './query.js';

const cache = new Map();

function load(name) {
  if (!cache.has(name)) {
    const url = new URL(`${API.mockPath}/${name}.json`, document.baseURI);
    cache.set(name, fetch(url).then((r) => {
      if (!r.ok) throw new ApiError(`No se pudo cargar ${name}.json`, { status: r.status });
      return r.json();
    }).catch((err) => {
      cache.delete(name);
      throw err instanceof ApiError ? err : new ApiError('No pudimos cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.');
    }));
  }
  return cache.get(name);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function orderNumber() {
  const d = new Date();
  const stamp = `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DV-${stamp}-${rand}`;
}

export const mockAdapter = {
  name: 'mock',

  getSettings: () => load('settings'),

  async getBanners({ placement } = {}) {
    const all = await load('banners');
    return placement ? all.filter((b) => b.placement === placement) : all;
  },

  getFaq: () => load('faq'),

  async getLookbooks() {
    return load('lookbooks');
  },

  async getCategories({ department } = {}) {
    const data = await load('categories');
    return {
      ...data,
      categories: department ? data.categories.filter((c) => c.department === department) : data.categories,
    };
  },

  async listProducts(query = {}) {
    const [products, cats] = await Promise.all([load('products'), load('categories')]);
    return queryProducts(products, query, { categories: cats.categories });
  },

  async getProduct(slug) {
    const products = await load('products');
    return products.find((p) => p.slug === slug || p.id === slug) || null;
  },

  async createOrder(order) {
    await wait(150);
    return { orderNumber: orderNumber(), status: 'pendiente', createdAt: new Date().toISOString(), total: order.total };
  },

  async subscribe() {
    return { ok: true };
  },
};

export const localOrderNumber = orderNumber;
