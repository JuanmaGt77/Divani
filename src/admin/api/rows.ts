/** Filas tal como llegan de Supabase (snake_case). Reflejan las tablas de supabase/schema.sql. */
import type { CashSummary } from '@/lib/types';

type Num = number | string;

export interface ColorRow {
  id: string;
  product_id: string;
  name: string;
  hex: string;
  family: string;
  images: string[] | null;
  sort: number;
}

export interface VariantRow {
  id: string;
  product_id: string;
  color_id: string;
  size: string;
  sku: string;
  stock: number;
  min_stock: number | null;
  active: boolean;
  sort: number;
}

export interface ProductRow {
  id: string;
  slug: string;
  code: string;
  name: string;
  department: string;
  category: string | null;
  description: string;
  details: string[] | null;
  material: string;
  care: string;
  origin: string;
  price: Num;
  compare_at_price: Num | null;
  cost: Num;
  tags: string[] | null;
  is_new: boolean;
  is_bestseller: boolean;
  is_featured: boolean;
  status: 'activo' | 'borrador' | 'archivado';
  sort: number;
  created_at: string;
  updated_at: string;
  colors?: ColorRow[];
  variants?: VariantRow[];
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  sku: string;
  name: string;
  color: string;
  size: string;
  image: string;
  unit_price: Num;
  unit_cost: Num;
  qty: number;
  discount: Num;
  total: Num;
  sort: number;
}

export interface OrderEventRow {
  id: number | string;
  order_id: string;
  type: string;
  from_status: string | null;
  to_status: string | null;
  note: string;
  created_at: string;
  created_by_name: string;
}

export interface PaymentRow {
  method: string;
  amount: Num;
  received?: Num | null;
  change?: Num | null;
}

export interface OrderRow {
  id: string;
  number: string;
  channel: 'web' | 'tienda' | 'whatsapp' | 'otro';
  status: 'nuevo' | 'confirmado' | 'preparando' | 'enviado' | 'entregado' | 'cancelado';
  payment_status: 'pendiente' | 'pagado' | 'reembolsado';
  payment_method: string;
  payments: PaymentRow[] | null;
  delivery_method: string;
  customer_name: string;
  customer_phone: string;
  customer_city: string;
  customer_address: string;
  notes: string;
  internal_notes: string;
  items_count: number;
  subtotal: Num;
  discount: Num;
  shipping: Num;
  total: Num;
  cost_total: Num;
  stock_applied: boolean;
  cash_session_id: string | null;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  paid_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string;
  items?: OrderItemRow[];
  events?: OrderEventRow[];
}

export interface MovementRow {
  id: number | string;
  variant_id: string | null;
  product_id: string | null;
  sku: string;
  product_name: string;
  variant_label: string;
  type: 'inicial' | 'entrada' | 'venta' | 'ajuste' | 'devolucion' | 'cancelacion';
  qty: number;
  stock_after: number | null;
  unit_cost: Num;
  reason: string;
  reference: string;
  order_id: string | null;
  created_at: string;
  created_by_name: string;
}

export interface CashSessionRow {
  id: string;
  number: number;
  status: 'abierta' | 'cerrada';
  opened_at: string;
  opened_by_name: string;
  opening_amount: Num;
  notes: string;
  closed_at: string | null;
  closed_by_name: string;
  expected_cash: Num | null;
  counted_cash: Num | null;
  difference: Num | null;
  breakdown: Record<string, number> | null;
  summary: CashSummary | null;
  close_notes: string;
}

export interface CashMovementRow {
  id: string;
  session_id: string;
  type: 'ingreso' | 'retiro' | 'gasto';
  amount: Num;
  reason: string;
  created_at: string;
  created_by_name: string;
}

export interface BannerRow {
  id: string;
  placement: string;
  eyebrow: string;
  title: string;
  text: string;
  cta_label: string;
  cta_href: string;
  image: string;
  image_mobile: string;
  theme: string;
  sort: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export interface LookbookRow {
  id: string;
  eyebrow: string;
  title: string;
  text: string;
  image: string;
  hotspots: { product: string; color: string; x: number; y: number }[] | null;
  sort: number;
  active: boolean;
}

export interface FaqRow {
  id: string;
  question: string;
  answer: string;
  sort: number;
  active: boolean;
}
