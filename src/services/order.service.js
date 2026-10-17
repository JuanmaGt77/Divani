/**
 * Pedidos. Con base de datos (Supabase, backend propio o la demostración del panel), primero
 * se registra el pedido —se validan existencias y precios— y el número oficial viaja en el
 * mensaje de WhatsApp. Con el catálogo de muestra solo se arma el mensaje.
 */
import { api, registersOrders } from './api/index.js';
import { localOrderNumber } from './api/mock.adapter.js';
import { orderMessage, waLink } from './whatsapp.service.js';

export const OrderService = {
  /** Número de referencia local (se usa mientras no hay base de datos). */
  newReference: () => localOrderNumber(),

  /** ¿Este pedido se guardará en la base de datos? */
  registers: registersOrders,

  /** Construye mensaje y enlace sin llamar a la API (síncrono, para enlaces <a>). */
  preview(order) {
    const message = orderMessage(order);
    return { message, url: waLink(message) };
  },

  /** Registra el pedido (si hay base de datos) y devuelve el enlace de WhatsApp con el número oficial. */
  async submit(order) {
    if (!(await registersOrders())) return { ...this.preview(order), orderNumber: order.orderNumber, registered: false };
    const payload = {
      items: order.items.map(({ slug, sku, name, color, size, qty, price }) => ({ slug, sku, name, color, size, qty, price })),
      customer: order.customer,
      delivery: order.delivery?.id || '',
      payment: order.payment?.id || '',
      notes: order.notes,
      subtotal: order.subtotal,
      channel: 'web',
    };
    const res = await api.createOrder(payload);
    const final = { ...order, orderNumber: res?.orderNumber || res?.number || order.orderNumber };
    return { ...this.preview(final), orderNumber: final.orderNumber, registered: true };
  },
};
