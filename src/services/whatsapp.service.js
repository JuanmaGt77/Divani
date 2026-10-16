/**
 * Mensajes y enlaces de WhatsApp (wa.me). Todo el flujo de compra termina aquí.
 * WhatsApp interpreta *negritas* y _cursivas_.
 */
import { SITE } from '../config/site.config.js';
import { money } from '../core/format.js';
import { productUrl } from '../core/url.js';

export const waLink = (text = '', number = SITE.whatsapp.number) =>
  `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

const shareBase = () => SITE.url || undefined;

export function greetingMessage() {
  return `Hola ${SITE.name}, me gustaría recibir asesoría para mi compra.`;
}

export function productMessage(p, { color, size, qty = 1 } = {}) {
  const lines = [
    `Hola ${SITE.name}, me interesa esta prenda:`,
    '',
    `*${p.name}*${p.sku ? ` (${p.sku})` : ''}`,
    [color && `Color: ${color}`, size && `Talla: ${size}`, qty > 1 && `Cantidad: ${qty}`].filter(Boolean).join(' · '),
    `Precio: ${money(p.price)}`,
    '',
    size ? '¿Está disponible?' : '¿Me ayudan con la talla y disponibilidad?',
    productUrl(p.slug, shareBase()),
  ];
  return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n');
}

export function orderMessage({ orderNumber, items, subtotal, customer = {}, delivery, payment, notes }) {
  const L = [`Hola ${SITE.name}, quiero hacer este pedido:`, ''];
  if (orderNumber) L.push(`*Pedido ${orderNumber}*`, '');
  items.forEach((it, i) => {
    L.push(`${i + 1}. ${it.name}${it.sku ? ` (${it.sku})` : ''}`);
    L.push(`   ${[it.color && `Color: ${it.color}`, it.size && `Talla: ${it.size}`, `Cant.: ${it.qty}`].filter(Boolean).join(' · ')}`);
    L.push(`   ${money(it.price * it.qty)}`);
  });
  L.push('', `*Total: ${money(subtotal)} ${SITE.currency}* (sin envío)`);
  const data = [
    customer.name && `Nombre: ${customer.name}`,
    customer.phone && `Teléfono: ${customer.phone}`,
    customer.city && `Ciudad: ${customer.city}`,
    delivery?.label && `Entrega: ${delivery.label}`,
    customer.address && `Dirección: ${customer.address}`,
    payment?.label && `Pago: ${payment.label}`,
    notes && `Notas: ${notes}`,
  ].filter(Boolean);
  if (data.length) L.push('', '*Mis datos*', ...data);
  L.push('', '¿Me confirman disponibilidad y costo de envío? ¡Gracias!');
  return L.join('\n');
}

export function lookMessage(title, items) {
  return [
    `Hola ${SITE.name}, me encantó el look «${title.replace(/\*/g, '')}». Me interesan estas piezas:`,
    '',
    ...items.map((p) => `• ${p.name}${p.color ? ` — ${p.color}` : ''} (${money(p.price)})`),
    '',
    '¿Me ayudan con tallas y disponibilidad?',
  ].join('\n');
}

export function favoritesMessage(items) {
  return [
    `Hola ${SITE.name}, estas son mis prendas favoritas:`,
    '',
    ...items.map((p) => `• ${p.name} (${money(p.price)})\n  ${productUrl(p.slug, shareBase())}`),
    '',
    '¿Me ayudan con tallas y disponibilidad?',
  ].join('\n');
}

export function vipMessage() {
  return `Hola ${SITE.name}, quiero unirme a la lista VIP para enterarme primero de los nuevos ingresos.`;
}

/** Abre WhatsApp desde código (cuando no se puede usar un <a> directo). */
export function openWhatsApp(url) {
  const w = window.open(url, '_blank', 'noopener');
  if (!w) location.href = url;
}
