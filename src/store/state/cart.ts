/**
 * Bolsa de compras (se guarda en el navegador y se sincroniza entre pestañas).
 * Línea: { key, slug, sku, name, price, color, size, image, qty, max }
 */
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import type { StoreProduct } from '@/lib/types';
import { useHydrated } from '../lib/hydration';
import { sizesOf } from '../lib/product';
import { STORAGE_KEYS, load, save } from '../lib/storage';

export interface CartLine {
  key: string;
  slug: string;
  sku: string;
  name: string;
  price: number;
  color: string;
  size: string;
  image: string;
  qty: number;
  max: number;
}

const sanitize = (state: unknown): CartLine[] => {
  const items = (state as { items?: unknown })?.items;
  return Array.isArray(items) ? (items as CartLine[]).filter((i) => i && i.slug && i.qty > 0) : [];
};

const browser = typeof window !== 'undefined';

export const $cart = atom<CartLine[]>(browser ? sanitize(load(STORAGE_KEYS.cart, { items: [] })) : []);

const keyOf = (slug: string, color: string, size: string) => `${slug}|${color || ''}|${size || ''}`;

function commit(items: CartLine[]) {
  $cart.set(items);
  save(STORAGE_KEYS.cart, { items });
}

export const cartCount = (items: CartLine[]): number => items.reduce((a, i) => a + i.qty, 0);
export const cartSubtotal = (items: CartLine[]): number => items.reduce((a, i) => a + i.price * i.qty, 0);

export const cart = {
  /** Agrega un producto. Devuelve la línea resultante (o null si esa talla se agotó). */
  add(
    product: StoreProduct,
    { color, size, qty = 1 }: { color?: string; size?: string; qty?: number } = {},
  ): CartLine | null {
    const variant = product.colors?.find((c) => c.name === color) || product.colors?.[0];
    const sizeInfo = sizesOf(product, variant?.name).find((s) => s.label === size);
    const max = sizeInfo ? sizeInfo.stock : 99;
    if (max <= 0) return null;
    const key = keyOf(product.slug, variant?.name || '', size || '');
    const items = [...$cart.get()];
    const idx = items.findIndex((i) => i.key === key);
    if (idx >= 0) {
      const cur = items[idx]!;
      items[idx] = { ...cur, qty: Math.min(max, cur.qty + qty), max };
    } else {
      items.unshift({
        key,
        slug: product.slug,
        sku: sizeInfo?.sku || product.sku,
        name: product.name,
        price: product.price,
        color: variant?.name || '',
        size: size || '',
        image: variant?.images?.[0] || '',
        qty: Math.min(max, qty),
        max,
      });
    }
    commit(items);
    return items.find((i) => i.key === key) || null;
  },

  setQty(key: string, qty: number) {
    commit(
      $cart
        .get()
        .map((i) => (i.key === key ? { ...i, qty: Math.max(0, Math.min(i.max ?? 99, qty)) } : i))
        .filter((i) => i.qty > 0),
    );
  },

  remove(key: string) {
    commit($cart.get().filter((i) => i.key !== key));
  },

  clear() {
    commit([]);
  },
};

/** La bolsa en una isla (vacía durante la hidratación, igual que el HTML generado). */
export function useCart(): CartLine[] {
  const hydrated = useHydrated();
  const items = useStore($cart);
  return hydrated ? items : [];
}

// Sincroniza la bolsa entre pestañas abiertas
if (browser) {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEYS.cart) $cart.set(sanitize(load(STORAGE_KEYS.cart, { items: [] })));
  });
}
