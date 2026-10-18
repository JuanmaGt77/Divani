/** Reglas de la tienda para mostrar productos: existencias por color y talla, etiquetas y ofertas. */
import type { StoreColor, StoreProduct, StoreSize } from '@/lib/types';

export const CATALOG = {
  pageSize: 12,
  /** A partir de cuántas piezas se muestra «Últimas piezas». */
  lowStock: 2,
};

/** Tallas de un color (cada color trae sus propias existencias). */
export const sizesOf = (p: StoreProduct | null | undefined, colorName: string | undefined): StoreSize[] => {
  const c = p?.colors?.find((x) => x.name === colorName);
  return c?.sizes?.length ? c.sizes : p?.sizes || [];
};

export const colorStock = (p: StoreProduct, colorName: string): number =>
  sizesOf(p, colorName).reduce((a, s) => a + (s.stock || 0), 0);

/** El primer color que tiene existencias (o el primero si ninguno tiene). */
export const firstAvailableColor = (p: StoreProduct | null | undefined): StoreColor | undefined =>
  p?.colors?.find((c) => !c.sizes?.length || c.sizes.some((s) => s.stock > 0)) || p?.colors?.[0];

export const totalStock = (p: Pick<StoreProduct, 'sizes'> | null | undefined): number =>
  (p?.sizes || []).reduce((a, s) => a + (s.stock || 0), 0);

export const discountPct = (p: Pick<StoreProduct, 'price' | 'compareAtPrice'> | null | undefined): number =>
  p?.compareAtPrice && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0;

export interface ProductBadge {
  id: 'agotado' | 'oferta' | 'nuevo' | 'ultimas';
  label: string;
}

/** Etiquetas visibles de un producto, en orden de prioridad (máximo dos). */
export function badgesOf(p: StoreProduct): ProductBadge[] {
  const out: ProductBadge[] = [];
  const stock = totalStock(p);
  if (stock === 0) out.push({ id: 'agotado', label: 'Agotado' });
  const pct = discountPct(p);
  if (pct) out.push({ id: 'oferta', label: `−${pct}%` });
  if (p.isNew) out.push({ id: 'nuevo', label: 'Nuevo' });
  if (stock > 0 && stock <= CATALOG.lowStock) out.push({ id: 'ultimas', label: 'Últimas piezas' });
  return out.slice(0, 2);
}
