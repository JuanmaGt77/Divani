/** Filas de Supabase (snake_case) ↔ objetos del panel (camelCase). */
import { bySort, readBannerTheme, writeBannerTheme } from '@/lib/model';
import type {
  Banner,
  CashMovement,
  CashSession,
  Faq,
  InventoryMovement,
  Lookbook,
  Order,
  OrderEvent,
  OrderItem,
  Product,
  ProductColor,
  ProductVariant,
} from '@/lib/types';
import type {
  BannerRow,
  CashMovementRow,
  CashSessionRow,
  ColorRow,
  FaqRow,
  LookbookRow,
  MovementRow,
  OrderEventRow,
  OrderItemRow,
  OrderRow,
  ProductRow,
  VariantRow,
} from './rows';

const n = (v: number | string | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));
const nn = (v: number | string | null | undefined): number | null => (v === null || v === undefined ? null : Number(v));

export const colorFromRow = (c: ColorRow): ProductColor => ({
  id: c.id,
  name: c.name,
  hex: c.hex,
  family: c.family,
  images: c.images || [],
  sort: c.sort,
});

export const variantFromRow = (v: VariantRow): ProductVariant => ({
  id: v.id,
  colorId: v.color_id,
  size: v.size,
  sku: v.sku,
  stock: v.stock,
  minStock: v.min_stock,
  active: v.active,
  sort: v.sort,
});

export const productFromRow = (r: ProductRow): Product => ({
  id: r.id,
  slug: r.slug,
  code: r.code,
  name: r.name,
  department: r.department,
  category: r.category,
  description: r.description,
  details: r.details || [],
  material: r.material,
  care: r.care,
  origin: r.origin,
  price: n(r.price),
  compareAtPrice: nn(r.compare_at_price),
  cost: n(r.cost),
  tags: r.tags || [],
  isNew: r.is_new,
  isBestseller: r.is_bestseller,
  isFeatured: r.is_featured,
  status: r.status,
  sort: r.sort,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  colors: (r.colors || []).map(colorFromRow).sort(bySort),
  variants: (r.variants || []).map(variantFromRow).sort(bySort),
});

export const itemFromRow = (i: OrderItemRow): OrderItem => ({
  id: i.id,
  productId: i.product_id,
  variantId: i.variant_id,
  sku: i.sku,
  name: i.name,
  color: i.color,
  size: i.size,
  image: i.image,
  unitPrice: n(i.unit_price),
  unitCost: n(i.unit_cost),
  qty: i.qty,
  discount: n(i.discount),
  total: n(i.total),
  sort: i.sort,
});

export const eventFromRow = (e: OrderEventRow): OrderEvent => ({
  id: String(e.id),
  type: e.type,
  from: e.from_status,
  to: e.to_status,
  note: e.note,
  createdAt: e.created_at,
  createdByName: e.created_by_name,
});

export const orderFromRow = (o: OrderRow): Order => ({
  id: o.id,
  number: o.number,
  channel: o.channel,
  status: o.status,
  paymentStatus: o.payment_status,
  paymentMethod: o.payment_method,
  payments: (o.payments || []).map((p) => ({
    method: p.method,
    amount: n(p.amount),
    ...(p.received != null ? { received: n(p.received) } : {}),
    ...(p.change != null ? { change: n(p.change) } : {}),
  })),
  deliveryMethod: o.delivery_method,
  customer: { name: o.customer_name, phone: o.customer_phone, city: o.customer_city, address: o.customer_address },
  notes: o.notes,
  internalNotes: o.internal_notes,
  itemsCount: o.items_count,
  subtotal: n(o.subtotal),
  discount: n(o.discount),
  shipping: n(o.shipping),
  total: n(o.total),
  costTotal: n(o.cost_total),
  stockApplied: o.stock_applied,
  cashSessionId: o.cash_session_id,
  createdBy: o.created_by,
  createdByName: o.created_by_name,
  createdAt: o.created_at,
  updatedAt: o.updated_at,
  confirmedAt: o.confirmed_at,
  paidAt: o.paid_at,
  deliveredAt: o.delivered_at,
  cancelledAt: o.cancelled_at,
  cancelReason: o.cancel_reason,
  items: (o.items || []).map(itemFromRow).sort(bySort),
  events: (o.events || [])
    .map(eventFromRow)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
});

export const movementFromRow = (m: MovementRow): InventoryMovement => ({
  id: String(m.id),
  variantId: m.variant_id,
  productId: m.product_id,
  sku: m.sku,
  productName: m.product_name,
  variantLabel: m.variant_label,
  type: m.type,
  qty: m.qty,
  stockAfter: m.stock_after,
  unitCost: n(m.unit_cost),
  reason: m.reason,
  reference: m.reference,
  orderId: m.order_id,
  createdAt: m.created_at,
  createdByName: m.created_by_name,
});

export const sessionFromRow = (s: CashSessionRow): CashSession => ({
  id: s.id,
  number: s.number,
  status: s.status,
  openedAt: s.opened_at,
  openedByName: s.opened_by_name,
  openingAmount: n(s.opening_amount),
  notes: s.notes,
  closedAt: s.closed_at,
  closedByName: s.closed_by_name,
  expectedCash: nn(s.expected_cash),
  countedCash: nn(s.counted_cash),
  difference: nn(s.difference),
  breakdown: s.breakdown,
  summary: s.summary,
  closeNotes: s.close_notes,
});

export const cashMovementFromRow = (m: CashMovementRow): CashMovement => ({
  id: m.id,
  sessionId: m.session_id,
  type: m.type,
  amount: n(m.amount),
  reason: m.reason,
  createdAt: m.created_at,
  createdByName: m.created_by_name,
});

export const bannerFromRow = (b: BannerRow): Banner => ({
  id: b.id,
  placement: b.placement,
  eyebrow: b.eyebrow,
  title: b.title,
  text: b.text,
  ctaLabel: b.cta_label,
  ctaHref: b.cta_href,
  image: b.image,
  imageMobile: b.image_mobile,
  ...readBannerTheme(b.theme),
  sort: b.sort,
  active: b.active,
  startsAt: b.starts_at,
  endsAt: b.ends_at,
});

export const bannerToRow = (b: Banner): Omit<BannerRow, 'id' | 'sort'> => ({
  placement: b.placement,
  eyebrow: b.eyebrow,
  title: b.title,
  text: b.text,
  cta_label: b.ctaLabel,
  cta_href: b.ctaHref,
  image: b.image,
  image_mobile: b.imageMobile,
  theme: writeBannerTheme(b.theme, b.showcase),
  active: b.active,
  starts_at: b.startsAt,
  ends_at: b.endsAt,
});

export const lookbookFromRow = (l: LookbookRow): Lookbook => ({
  id: l.id,
  eyebrow: l.eyebrow,
  title: l.title,
  text: l.text,
  image: l.image,
  hotspots: l.hotspots || [],
  sort: l.sort,
  active: l.active,
});

export const lookbookToRow = (l: Lookbook): Omit<LookbookRow, 'id' | 'sort'> => ({
  eyebrow: l.eyebrow,
  title: l.title,
  text: l.text,
  image: l.image,
  hotspots: l.hotspots,
  active: l.active,
});

export const faqFromRow = (f: FaqRow): Faq => ({
  id: f.id,
  question: f.question,
  answer: f.answer,
  sort: f.sort,
  active: f.active,
});

export const faqToRow = (f: Faq): Omit<FaqRow, 'id' | 'sort'> => ({
  question: f.question,
  answer: f.answer,
  active: f.active,
});
