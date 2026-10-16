/**
 * Adaptador REST: implementa la misma interfaz que mock.adapter.js pero contra tu backend.
 * Los endpoints y formatos están documentados en docs/API.md.
 */
import { http } from './http.js';

export const restAdapter = {
  name: 'rest',

  getSettings: () => http('/settings'),

  getBanners: ({ placement } = {}) => http('/banners', { params: { placement } }),

  getFaq: () => http('/faq'),

  getLookbooks: () => http('/lookbooks'),

  getCategories: ({ department } = {}) => http('/categories', { params: { department } }),

  listProducts: (query = {}) => http('/products', { params: query }),

  async getProduct(slug) {
    try {
      return await http(`/products/${encodeURIComponent(slug)}`);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  createOrder: (order) => http('/orders', { method: 'POST', body: order }),

  subscribe: (data) => http('/subscribers', { method: 'POST', body: data }),
};
