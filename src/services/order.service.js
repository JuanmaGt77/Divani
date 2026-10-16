/**
 * Pedidos. Hoy el pedido se envía por WhatsApp; cuando exista backend, primero se
 * registra con POST /orders y el número que devuelva la API viaja en el mensaje.
 */
import { api, usingMockData } from './api/index.js';
import { localOrderNumber } from './api/mock.adapter.js';
import { orderMessage, waLink } from './whatsapp.service.js';

export const OrderService = {
  /** Número de referencia local (se usa mientras no hay backend). */
  newReference: () => localOrderNumber(),

  /** Construye mensaje y enlace sin llamar a la API (síncrono, para enlaces <a>). */
  preview(order) {
    const message = orderMessage(order);
    return { message, url: waLink(message) };
  },

  /** Registra el pedido en el backend (si existe) y devuelve el enlace de WhatsApp. */
  async submit(order) {
    if (usingMockData) return { ...this.preview(order), orderNumber: order.orderNumber };
    const payload = {
      items: order.items.map(({ slug, sku, color, size, qty, price }) => ({ slug, sku, color, size, qty, price })),
      customer: order.customer,
      delivery: order.delivery?.id,
      payment: order.payment?.id,
      notes: order.notes,
      subtotal: order.subtotal,
      channel: 'whatsapp',
    };
    const res = await api.createOrder(payload);
    const final = { ...order, orderNumber: res.orderNumber || order.orderNumber };
    return { ...this.preview(final), orderNumber: final.orderNumber };
  },
};
