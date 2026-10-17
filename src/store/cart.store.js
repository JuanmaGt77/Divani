/**
 * Bolsa de compras (persistida en el navegador).
 * Línea: { key, slug, sku, name, price, color, size, image, qty, max }
 */
import { createStore } from '../core/emitter.js';
import { load, save } from '../core/storage.js';
import { sizesOf } from '../core/product.js';
import { STORAGE_KEYS } from '../config/site.config.js';

const store = createStore(sanitize(load(STORAGE_KEYS.cart, { items: [] })));

function sanitize(state) {
  const items = Array.isArray(state?.items) ? state.items.filter((i) => i && i.slug && i.qty > 0) : [];
  return { items };
}

const keyOf = (slug, color, size) => `${slug}|${color || ''}|${size || ''}`;

function commit(items) {
  store.set({ items });
  save(STORAGE_KEYS.cart, { items });
}

export const cart = {
  subscribe: store.subscribe,
  get items() { return store.get().items; },
  get count() { return store.get().items.reduce((a, i) => a + i.qty, 0); },
  get subtotal() { return store.get().items.reduce((a, i) => a + i.price * i.qty, 0); },

  /** Agrega un producto. Devuelve la línea resultante (o null si esa talla se agotó). */
  add(product, { color, size, qty = 1 } = {}) {
    const variant = product.colors?.find((c) => c.name === color) || product.colors?.[0];
    const sizeInfo = sizesOf(product, variant?.name).find((s) => s.label === size);
    const max = sizeInfo ? sizeInfo.stock : 99;
    if (max <= 0) return null;
    const key = keyOf(product.slug, variant?.name, size);
    const items = [...store.get().items];
    const idx = items.findIndex((i) => i.key === key);
    if (idx >= 0) {
      items[idx] = { ...items[idx], qty: Math.min(max, items[idx].qty + qty), max };
    } else {
      items.unshift({
        key, slug: product.slug, sku: sizeInfo?.sku || product.sku, name: product.name, price: product.price,
        color: variant?.name || '', size: size || '', image: variant?.images?.[0] || '', qty: Math.min(max, qty), max,
      });
    }
    commit(items);
    return items.find((i) => i.key === key);
  },

  setQty(key, qty) {
    const items = store.get().items
      .map((i) => (i.key === key ? { ...i, qty: Math.max(0, Math.min(i.max ?? 99, qty)) } : i))
      .filter((i) => i.qty > 0);
    commit(items);
  },

  remove(key) {
    commit(store.get().items.filter((i) => i.key !== key));
  },

  clear() {
    commit([]);
  },
};

// Sincroniza la bolsa entre pestañas abiertas
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEYS.cart) store.set(sanitize(load(STORAGE_KEYS.cart, { items: [] })));
});
