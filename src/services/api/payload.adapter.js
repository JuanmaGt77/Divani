/**
 * Adaptador a partir del «paquete de la tienda»: productos, categorías, banners, looks,
 * preguntas, contenido de la portada y ajustes en una sola carga. Es lo que devuelve
 * la función storefront() de Supabase y storefrontPayload() en modo demostración.
 */
import { COLOR_FAMILIES, mergeSettings } from '../../backend/model.js';
import { applySiteSettings } from '../../core/site-settings.js';
import { queryProducts } from './query.js';

function normalize(d = {}) {
  const settings = mergeSettings({ public: d.settings || {} }).public;
  applySiteSettings(settings);
  return {
    settings,
    departments: d.departments || [],
    categories: d.categories || [],
    colorFamilies: d.colorFamilies || COLOR_FAMILIES,
    banners: d.banners || [],
    lookbooks: d.lookbooks || [],
    faq: d.faq || [],
    content: d.content || {},
    products: d.products || [],
  };
}

/**
 * @param {{ name: string, load: () => Promise<object>, placeOrder: (payload) => Promise<{ number: string }> }} opts
 */
export function payloadAdapter({ name, load, placeOrder }) {
  let pending = null;
  const get = () => {
    pending ??= load().then(normalize).catch((err) => { pending = null; throw err; });
    return pending;
  };

  return {
    name,
    registersOrders: true,
    /** Vuelve a pedir los datos (por ejemplo, después de registrar un pedido). */
    refresh() { pending = null; },

    getSettings: async () => (await get()).settings,
    getContent: async () => (await get()).content,
    async getBanners({ placement } = {}) {
      const { banners } = await get();
      return placement ? banners.filter((b) => (b.placement || 'home-carousel') === placement) : banners;
    },
    getFaq: async () => (await get()).faq,
    getLookbooks: async () => (await get()).lookbooks,
    async getCategories({ department } = {}) {
      const d = await get();
      return {
        departments: d.departments,
        categories: department ? d.categories.filter((c) => c.department === department) : d.categories,
        colorFamilies: d.colorFamilies,
      };
    },
    async listProducts(query = {}) {
      const d = await get();
      return queryProducts(d.products, query, { categories: d.categories });
    },
    async getProduct(slug) {
      const d = await get();
      return d.products.find((p) => p.slug === slug || p.id === slug) || null;
    },
    async createOrder(payload) {
      const res = await placeOrder(payload);
      pending = null; // las existencias cambiaron
      return { ...res, orderNumber: res.number };
    },
    subscribe: async () => ({ ok: true }),
  };
}
