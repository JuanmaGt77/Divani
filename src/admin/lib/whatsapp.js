/** Mensajes de WhatsApp para escribirle a la clienta desde el panel. */
import { money, dateShort } from './format.js';
import { methodLabel } from '../../backend/model.js';

/** Teléfono con lada internacional (si viene local, se agrega la de la región). */
export function waNumber(raw, prefix = '52') {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (prefix === '52' && d.length === 10) d = `52${d}`;
  else if (prefix === '502' && d.length === 8) d = `502${d}`;
  else if (prefix === '1' && d.length === 10) d = `1${d}`;
  return d;
}

export const waLink = (phone, text = '', prefix) => {
  const n = waNumber(phone, prefix);
  return n ? `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}` : '';
};

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';
const lines = (order) => order.items.map((i) => `• ${i.qty} × ${i.name}${[i.color, i.size && `talla ${i.size}`].filter(Boolean).length ? ` (${[i.color, i.size && `talla ${i.size}`].filter(Boolean).join(', ')})` : ''} — ${money(i.total)}`);

export function orderTemplates(order, store = {}) {
  const hi = `¡Hola${firstName(order.customer?.name) ? ` ${firstName(order.customer.name)}` : ''}!`;
  const name = store.name || 'Divani';
  const totals = [
    `Subtotal: ${money(order.subtotal)}`,
    order.discount ? `Descuento: −${money(order.discount)}` : null,
    order.shipping ? `Envío: ${money(order.shipping)}` : null,
    `*Total: ${money(order.total)}*`,
  ].filter(Boolean);
  return [
    {
      id: 'confirmar',
      label: 'Confirmar disponibilidad',
      text: [`${hi} Te escribimos de ${name} por tu pedido *${order.number}*. ¡Todo está disponible! 🎉`, '', ...lines(order), '', ...totals, '', '¿Te compartimos los datos para el pago?'].join('\n'),
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
export function ticketMessage(order, store = {}) {
  const pays = (order.payments || []).map((p) => `${methodLabel(p.method)}: ${money(p.amount)}${p.change ? ` (cambio ${money(p.change)})` : ''}`);
  return [
    `*${store.name || 'Divani'}* · Ticket ${order.number}`,
    dateShort(order.createdAt),
    '',
    ...lines(order),
    '',
    order.discount || order.items.some((i) => i.discount) ? `Descuentos: −${money(order.items.reduce((a, i) => a + (i.discount || 0), 0) + (order.discount || 0))}` : null,
    `*Total: ${money(order.total)}*`,
    ...pays,
    '',
    store.ticketFooter || '¡Gracias por tu compra!',
  ].filter((l) => l !== null).join('\n');
}
