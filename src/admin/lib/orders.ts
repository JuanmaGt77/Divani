/** Ayudas para pedidos: nombres de métodos, siguiente paso del flujo y textos. */
import { Check, CircleCheckBig, Package, Truck, type LucideIcon } from 'lucide-react';
import { STOCK_STATUSES, methodLabel } from '@/lib/model';
import type { Order, OrderStatus, Settings } from '@/lib/types';

export function paymentName(id: string, settings: Settings | null | undefined): string {
  const m = settings?.public?.checkout?.paymentMethods?.find((x) => x.id === id);
  return m?.label || methodLabel(id);
}

export function deliveryName(id: string, settings: Settings | null | undefined): string {
  if (!id) return '—';
  const m = settings?.public?.checkout?.deliveryMethods?.find((x) => x.id === id);
  return m?.label || id;
}

export const FLOW: OrderStatus[] = ['nuevo', 'confirmado', 'preparando', 'enviado', 'entregado'];

export interface NextStep {
  status: OrderStatus;
  label: string;
  icon: LucideIcon;
  hint?: string;
}

/** El siguiente paso natural del pedido (botón principal del detalle). */
export function nextStep(order: Pick<Order, 'status' | 'deliveryMethod'>): NextStep | null {
  switch (order.status) {
    case 'nuevo':
      return {
        status: 'confirmado',
        label: 'Confirmar pedido',
        icon: Check,
        hint: 'Aparta las piezas del inventario.',
      };
    case 'confirmado':
      return { status: 'preparando', label: 'Pasar a preparación', icon: Package };
    case 'preparando':
      return {
        status: 'enviado',
        label: order.deliveryMethod === 'entrega' ? 'Listo para entregar' : 'Marcar como enviado',
        icon: Truck,
      };
    case 'enviado':
      return { status: 'entregado', label: 'Marcar como entregado', icon: CircleCheckBig };
    default:
      return null;
  }
}

export const appliesStock = (status: OrderStatus): boolean => STOCK_STATUSES.includes(status);

export const orderLabel = (o: Pick<Order, 'channel' | 'number'>): string =>
  o.channel === 'tienda' ? `Venta ${o.number}` : `Pedido ${o.number}`;

/** Descuento total (líneas + general). */
export const discountTotal = (o: Pick<Order, 'items' | 'discount'>): number =>
  (o.items || []).reduce((a, i) => a + (i.discount || 0), 0) + (o.discount || 0);
