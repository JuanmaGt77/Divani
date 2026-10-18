/** Mensajes de WhatsApp para escribirle a la clienta desde el panel. */
import { dateShort, money } from '@/lib/format';
import { methodLabel } from '@/lib/model';
import type { Order } from '@/lib/types';

/** Teléfono con lada internacional (si viene local, se agrega la de la región). */
export function waNumber(raw: unknown, prefix = '502'): string {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (prefix === '502' && d.length === 8) d = `502${d}`;
  else if (prefix === '52' && d.length === 10) d = `52${d}`;
  else if (prefix === '1' && d.length === 10) d = `1${d}`;
  return d;
}

export const waLink = (phone: unknown, text = '', prefix?: string): string => {
  const n = waNumber(phone, prefix);
  return n ? `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}` : '';
};

export interface StoreForMessages {
  name?: string;
  ticketFooter?: string;
}

const firstName = (name: unknown): string =>
  String(name || '')
    .trim()
    .split(/\s+/)[0] || '';

const lines = (order: Pick<Order, 'items'>): string[] =>
  order.items.map((i) => {
    const extra = [i.color, i.size && `talla ${i.size}`].filter(Boolean);
    return `• ${i.qty} × ${i.name}${extra.length ? ` (${extra.join(', ')})` : ''} — ${money(i.total)}`;
  });

export function orderTemplates(
  order: Order,
  store: StoreForMessages = {},
): { id: string; label: string; text: string }[] {
  const hi = `¡Hola${firstName(order.customer?.name) ? ` ${firstName(order.customer.name)}` : ''}!`;
  const name = store.name || 'Divani';
  const totals = [
    `Subtotal: ${money(order.subtotal)}`,
    order.discount ? `Descuento: −${money(order.discount)}` : null,
    order.shipping ? `Envío: ${money(order.shipping)}` : null,
    `*Total: ${money(order.total)}*`,
  ].filter(Boolean) as string[];
  return [
    {
      id: 'confirmar',
      label: 'Confirmar disponibilidad',
      text: [
        `${hi} Te escribimos de ${name} por tu pedido *${order.number}*. ¡Todo está disponible! 🎉`,
        '',
        ...lines(order),
        '',
        ...totals,
        '',
        '¿Te compartimos los datos para el pago?',
      ].join('\n'),
    },
    {
      id: 'pago',
      label: 'Recordar el pago',
      text: `${hi} Te recordamos que tu pedido *${order.number}* por *${money(order.total)}* está apartado. En cuanto recibamos tu pago lo preparamos. ¿Te ayudo con algo?`,
    },
    {
      id: 'pagado',
      label: 'Pago recibido',
      text: `${hi} Recibimos tu pago del pedido *${order.number}*. Ya lo estamos preparando con mucho cariño ✨`,
    },
    {
      id: 'enviado',
      label: 'Pedido enviado',
      text: `${hi} Tu pedido *${order.number}* ya va en camino 🚚. Te avisamos cualquier novedad.`,
    },
    {
      id: 'gracias',
      label: 'Agradecer la compra',
      text: `${hi} Gracias por comprar en ${name}. Esperamos que disfrutes mucho tus prendas. Si algo no te queda, escríbenos y lo resolvemos 💛`,
    },
  ];
}

/** Ticket de mostrador resumido para enviarlo por WhatsApp. */
export function ticketMessage(order: Order, store: StoreForMessages = {}): string {
  const pays = (order.payments || []).map(
    (p) => `${methodLabel(p.method)}: ${money(p.amount)}${p.change ? ` (cambio ${money(p.change)})` : ''}`,
  );
  const discounts = order.items.reduce((a, i) => a + (i.discount || 0), 0) + (order.discount || 0);
  return [
    `*${store.name || 'Divani'}* · Ticket ${order.number}`,
    dateShort(order.createdAt),
    '',
    ...lines(order),
    '',
    discounts ? `Descuentos: −${money(discounts)}` : null,
    `*Total: ${money(order.total)}*`,
    ...pays,
    '',
    store.ticketFooter || '¡Gracias por tu compra!',
  ]
    .filter((l) => l !== null)
    .join('\n');
}
