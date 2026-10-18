/**
 * Estado de la interfaz compartido entre islas: qué hoja está abierta (menú, búsqueda, bolsa,
 * favoritos, producto, guía de tallas, filtros) y el aviso tipo Dynamic Island.
 * Cualquier isla puede abrir una hoja; la isla de hojas (StoreOverlays) la muestra.
 */
import { atom } from 'nanostores';

export type SheetId = 'menu' | 'search' | 'cart' | 'favorites' | 'product' | 'sizes' | 'filters';

export const $sheet = atom<SheetId | null>(null);

/** Producto de la vista rápida (y el color con el que se abrió). */
export const $quickView = atom<{ slug: string; color?: string; seq: number } | null>(null);

/** Departamento con el que se abre la guía de tallas. */
export const $sizeGuide = atom<'mujer' | 'kids' | 'hombre'>('mujer');

export const openSheet = (id: SheetId): void => $sheet.set(id);
export const closeSheet = (id?: SheetId): void => {
  if (!id || $sheet.get() === id) $sheet.set(null);
};

let seq = 0;
export function openProduct(slug: string, { color }: { color?: string } = {}): void {
  $quickView.set({ slug, ...(color ? { color } : {}), seq: ++seq });
  $sheet.set('product');
}

export function openSizeGuide(department = 'mujer'): void {
  $sizeGuide.set(
    department === 'ninas' || department === 'ninos' || department === 'kids'
      ? 'kids'
      : department === 'hombre'
        ? 'hombre'
        : 'mujer',
  );
  $sheet.set('sizes');
}

/* ---------- Aviso tipo Dynamic Island ---------- */
export interface Notice {
  id: number;
  title: string;
  sub?: string;
  image?: string;
  icon?: string;
  action?: { label: string; onClick: () => void };
}

export const $notice = atom<Notice | null>(null);
let noticeSeq = 0;

/** notify({ title, sub, image, icon, action: { label, onClick } }) */
export function notify(n: Omit<Notice, 'id'>): void {
  $notice.set({ icon: 'check', ...n, id: ++noticeSeq });
}
