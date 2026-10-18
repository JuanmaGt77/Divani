/**
 * Mensajes y enlaces de WhatsApp (wa.me). Todo el flujo de compra termina aquí.
 * WhatsApp interpreta *negritas* y _cursivas_.
 */
import { money } from '@/lib/format';
import type { PublicSettings, StoreProduct } from '@/lib/types';
import { productUrl } from './url';

/** Número de ventas (solo dígitos). Sin número, WhatsApp deja elegir el chat. */
export const waNumber = (settings: PublicSettings): string => String(settings.whatsapp || '').replace(/\D/g, '');

export const waLink = (settings: PublicSettings, text = ''): string =>
  `https://wa.me/${waNumber(settings)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

const storeName = (s: PublicSettings): string => s.store?.name || 'Divani';

export const greetingMessage = (s: PublicSettings): string =>
  `Hola ${storeName(s)}, me gustaría recibir asesoría para mi compra.`;

export const vipMessage = (s: PublicSettings): string =>
  `Hola ${storeName(s)}, quiero unirme a la lista VIP para enterarme primero de los nuevos ingresos.`;

export function productMessage(
  s: PublicSettings,
  p: StoreProduct,
  { color, size, qty = 1 }: { color?: string; size?: string | null; qty?: number } = {},
): string {
  const lines = [
    `Hola ${storeName(s)}, me interesa esta prenda:`,
    '',
    `*${p.name}*${p.sku ? ` (${p.sku})` : ''}`,
    [color && `Color: ${color}`, size && `Talla: ${size}`, qty > 1 && `Cantidad: ${qty}`].filter(Boolean).join(' · '),
    `Precio: ${money(p.price)}`,
    '',
    size ? '¿Está disponible?' : '¿Me ayudan con la talla y disponibilidad?',
    productUrl(p.slug),
  ];
  return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n');
}

export interface OrderLine {
  name: string;
  sku?: string;
  color?: string;
  size?: string;
  qty: number;
  price: number;
}

export interface OrderDraft {
  orderNumber?: string;
  items: OrderLine[];
  subtotal: number;
  customer: { name?: string; phone?: string; city?: string; address?: string };
  delivery?: { label: string } | null;
  payment?: { label: string } | null;
  notes?: string;
}

export function orderMessage(
  s: PublicSettings,
  { orderNumber, items, subtotal, customer, delivery, payment, notes }: OrderDraft,
): string {
  const L = [`Hola ${storeName(s)}, quiero hacer este pedido:`, ''];
  if (orderNumber) L.push(`*Pedido ${orderNumber}*`, '');
  items.forEach((it, i) => {
    L.push(`${i + 1}. ${it.name}${it.sku ? ` (${it.sku})` : ''}`);
    L.push(
      `   ${[it.color && `Color: ${it.color}`, it.size && `Talla: ${it.size}`, `Cant.: ${it.qty}`].filter(Boolean).join(' · ')}`,
    );
    L.push(`   ${money(it.price * it.qty)}`);
  });
  L.push('', `*Total: ${money(subtotal)} ${s.region.currency}* (sin envío)`);
  const data = [
    customer.name && `Nombre: ${customer.name}`,
    customer.phone && `Teléfono: ${customer.phone}`,
    customer.city && `Ciudad: ${customer.city}`,
    delivery?.label && `Entrega: ${delivery.label}`,
    customer.address && `Dirección: ${customer.address}`,
    payment?.label && `Pago: ${payment.label}`,
    notes && `Notas: ${notes}`,
  ].filter(Boolean) as string[];
  if (data.length) L.push('', '*Mis datos*', ...data);
  L.push('', '¿Me confirman disponibilidad y costo de envío? ¡Gracias!');
  return L.join('\n');
}

export function lookMessage(
  s: PublicSettings,
  title: string,
  items: { name: string; color?: string; price: number }[],
): string {
  return [
    `Hola ${storeName(s)}, me encantó el look «${title.replace(/\*/g, '')}». Me interesan estas piezas:`,
    '',
    ...items.map((p) => `• ${p.name}${p.color ? ` — ${p.color}` : ''} (${money(p.price)})`),
    '',
    '¿Me ayudan con tallas y disponibilidad?',
  ].join('\n');
}

export function favoritesMessage(s: PublicSettings, items: StoreProduct[]): string {
  return [
    `Hola ${storeName(s)}, estas son mis prendas favoritas:`,
    '',
    ...items.map((p) => `• ${p.name} (${money(p.price)})\n  ${productUrl(p.slug)}`),
    '',
    '¿Me ayudan con tallas y disponibilidad?',
  ].join('\n');
}

/**
 * Abre una pestaña en el mismo toque del botón (si se abre después de esperar al servidor,
 * el navegador la bloquea) y la manda a WhatsApp cuando ya está listo el enlace.
 */
export function prepareWhatsAppWindow(): { go: (url: string) => boolean; close: () => void } {
  let w: Window | null = null;
  try {
    w = window.open('', '_blank');
    if (w) {
      w.opener = null;
      w.document.title = 'Abriendo WhatsApp…';
      w.document.body.innerHTML =
        '<p style="font:16px/1.5 system-ui,sans-serif;color:#5f554b;padding:28px">Abriendo WhatsApp…</p>';
    }
  } catch {
    w = null;
  }
  return {
    /** Devuelve false si no se pudo (ventana bloqueada): entonces se muestra un botón para abrirlo. */
    go(url: string) {
      if (!w || w.closed) return false;
      try {
        w.location.href = url;
        return true;
      } catch {
        return false;
      }
    },
    close() {
      try {
        w?.close();
      } catch {
        /* ya estaba cerrada */
      }
    },
  };
}
