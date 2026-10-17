/**
 * Existencias por color y talla. Con el panel conectado cada color trae sus propias tallas
 * (colors[].sizes con existencias y SKU); el catálogo de muestra solo trae tallas generales.
 */
export const sizesOf = (p, colorName) => {
  const c = p?.colors?.find((x) => x.name === colorName);
  return c?.sizes?.length ? c.sizes : p?.sizes || [];
};

export const colorStock = (p, colorName) => sizesOf(p, colorName).reduce((a, s) => a + (s.stock || 0), 0);

/** El primer color que tiene existencias (o el primero si ninguno tiene). */
export const firstAvailableColor = (p) =>
  p?.colors?.find((c) => !c.sizes?.length || c.sizes.some((s) => s.stock > 0)) || p?.colors?.[0];
