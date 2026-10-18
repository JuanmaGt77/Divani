/**
 * Pedidos de la tienda en línea. Primero se registra el pedido en Supabase (place_order valida
 * existencias y usa los precios de la base de datos) y después se abre WhatsApp con el número
 * oficial del pedido.
 */
import { rpc } from '@/lib/rpc';
import type { CartLine } from '../state/cart';

export interface CustomerData {
  name: string;
  phone: string;
  city: string;
  address: string;
  delivery: string;
  payment: string;
}

export interface PlacedOrder {
  id: string;
  number: string;
  total: number;
  status: string;
}

export function placeOrder({
  items,
  customer,
  notes,
  subtotal,
}: {
  items: CartLine[];
  customer: CustomerData;
  notes: string;
  subtotal: number;
}): Promise<PlacedOrder> {
  return rpc<PlacedOrder>('place_order', {
    payload: {
      items: items.map(({ slug, sku, name, color, size, qty, price }) => ({
        slug,
        sku,
        name,
        color,
        size,
        qty,
        price,
      })),
      customer: { name: customer.name, phone: customer.phone, city: customer.city, address: customer.address },
      delivery: customer.delivery,
      payment: customer.payment,
      notes,
      subtotal,
      channel: 'web',
    },
  });
}
