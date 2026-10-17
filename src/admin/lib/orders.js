/** Ayudas para pedidos: nombres de métodos, siguiente paso del flujo y textos. */
import { Check, Package, Truck, CircleCheckBig } from 'lucide-preact';
import { methodLabel, STOCK_STATUSES } from '../../backend/model.js';

export function paymentName(id, settings) {
  const m = settings?.public?.checkout?.paymentMethods?.find((x) => x.id === id);
  return m?.label || methodLabel(id);
}

export function deliveryName(id, settings) {
  if (!id) return '—';
  const m = settings?.public?.checkout?.deliveryMethods?.find((x) => x.id === id);
  return m?.label || id;
}

export const FLOW = ['nuevo', 'confirmado', 'preparando', 'enviado', 'entregado'];

/** El siguiente paso natural del pedido (botón principal del detalle). */
export function nextStep(order) {
  switch (order.status) {
    case 'nuevo': return { status: 'confirmado', label: 'Confirmar pedido', icon: Check, hint: 'Aparta las piezas del inventario.' };
    case 'confirmado': return { status: 'preparando', label: 'Pasar a preparación', icon: Package };
    case 'preparando': return { status: 'enviado', label: order.deliveryMethod === 'entrega' ? 'Listo para entregar' : 'Marcar como enviado', icon: Truck };
    case 'enviado': return { status: 'entregado', label: 'Marcar como entregado', icon: CircleCheckBig };
    default: return null;
  }
}

export const appliesStock = (status) => STOCK_STATUSES.includes(status);

export const orderLabel = (o) => (o.channel === 'tienda' ? `Venta ${o.number}` : `Pedido ${o.number}`);

/** Descuento total (líneas + general). */
export const discountTotal = (o) => (o.items || []).reduce((a, i) => a + (i.discount || 0), 0) + (o.discount || 0);
