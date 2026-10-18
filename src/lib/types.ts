/**
 * Tipos del negocio compartidos por la tienda, el panel y los scripts.
 * Reflejan las tablas y funciones de supabase/schema.sql (en camelCase).
 */

/* ---------- catálogo (panel) ---------- */
export type ProductStatus = 'activo' | 'borrador' | 'archivado';

export interface ProductColor {
  id: string;
  name: string;
  hex: string;
  family: string;
  images: string[];
  sort: number;
}

export interface ProductVariant {
  id: string;
  colorId: string;
  size: string;
  sku: string;
  stock: number;
  minStock: number | null;
  active: boolean;
  sort: number;
}

export interface Product {
  id: string;
  slug: string;
  code: string;
  name: string;
  department: string;
  category: string | null;
  description: string;
  details: string[];
  material: string;
  care: string;
  origin: string;
  price: number;
  compareAtPrice: number | null;
  cost: number;
  tags: string[];
  isNew: boolean;
  isBestseller: boolean;
  isFeatured: boolean;
  status: ProductStatus;
  sort: number;
  createdAt: string;
  updatedAt: string;
  colors: ProductColor[];
  variants: ProductVariant[];
}

export interface Department {
  slug: string;
  name: string;
  description: string;
  image: string;
  sort: number;
  active: boolean;
}

export interface Category {
  slug: string;
  department: string;
  name: string;
  description: string;
  image: string;
  sort: number;
  active: boolean;
}

export interface Taxonomy {
  departments: Department[];
  categories: Category[];
}

/* ---------- pedidos ---------- */
export type OrderStatus = 'nuevo' | 'confirmado' | 'preparando' | 'enviado' | 'entregado' | 'cancelado';
export type PaymentStatus = 'pendiente' | 'pagado' | 'reembolsado';
export type Channel = 'web' | 'tienda' | 'whatsapp' | 'otro';
export type Tone = 'blue' | 'amber' | 'plum' | 'teal' | 'green' | 'red' | 'gray';

export interface Payment {
  method: string;
  amount: number;
  received?: number;
  change?: number;
}

export interface Customer {
  name: string;
  phone: string;
  city: string;
  address: string;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  variantId: string | null;
  sku: string;
  name: string;
  color: string;
  size: string;
  image: string;
  unitPrice: number;
  unitCost: number;
  qty: number;
  discount: number;
  total: number;
  sort: number;
}

export interface OrderEvent {
  id: string;
  type: string;
  from: string | null;
  to: string | null;
  note: string;
  createdAt: string;
  createdByName: string;
}

export interface Order {
  id: string;
  number: string;
  channel: Channel;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  payments: Payment[];
  deliveryMethod: string;
  customer: Customer;
  notes: string;
  internalNotes: string;
  itemsCount: number;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  costTotal: number;
  stockApplied: boolean;
  cashSessionId: string | null;
  createdBy: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  paidAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string;
  items: OrderItem[];
  events: OrderEvent[];
}

/* ---------- inventario ---------- */
export type MovementType = 'inicial' | 'entrada' | 'venta' | 'ajuste' | 'devolucion' | 'cancelacion';

export interface InventoryMovement {
  id: string;
  variantId: string | null;
  productId: string | null;
  sku: string;
  productName: string;
  variantLabel: string;
  type: MovementType;
  qty: number;
  stockAfter: number | null;
  unitCost: number;
  reason: string;
  reference: string;
  orderId: string | null;
  createdAt: string;
  createdByName: string;
}

/* ---------- caja ---------- */
export type CashMovementType = 'ingreso' | 'retiro' | 'gasto';

export interface CashSummary {
  salesCount: number;
  salesTotal: number;
  items: number;
  cancelled: number;
  byMethod: Record<string, number>;
  cashSales: number;
  movements: Record<CashMovementType, number>;
  expected: number;
}

export interface CashSession {
  id: string;
  number: number;
  status: 'abierta' | 'cerrada';
  openedAt: string;
  openedByName: string;
  openingAmount: number;
  notes: string;
  closedAt: string | null;
  closedByName: string;
  expectedCash: number | null;
  countedCash: number | null;
  difference: number | null;
  breakdown: Record<string, number> | null;
  summary: CashSummary | null;
  closeNotes: string;
}

export interface CashMovement {
  id: string;
  sessionId: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  createdAt: string;
  createdByName: string;
}

export interface CashView {
  session: CashSession;
  summary: CashSummary;
  movements: CashMovement[];
  orders: Order[];
}

/* ---------- contenido del sitio ---------- */
export interface Banner {
  id?: string;
  placement: string;
  eyebrow: string;
  title: string;
  text: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
  imageMobile: string;
  theme: string;
  sort?: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export interface Hotspot {
  product: string;
  color: string;
  x: number;
  y: number;
}

export interface Lookbook {
  id?: string;
  eyebrow: string;
  title: string;
  text: string;
  image: string;
  hotspots: Hotspot[];
  sort?: number;
  active: boolean;
}

export interface Faq {
  id?: string;
  question: string;
  answer: string;
  sort?: number;
  active: boolean;
}

export interface HeroContent {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  video?: string;
  videoPortrait?: string;
  poster?: string;
  posterPortrait?: string;
}

/** Fotos y textos de la portada (tabla site_content: una llave por sección). */
export interface SiteContent {
  hero?: HeroContent;
  ribbons?: { primary?: string[]; secondary?: string[] };
  editorial?: { image?: string; eyebrow?: string; title?: string };
  kids?: { title?: string; lead?: string; girlsImage?: string; boysImage?: string };
  about?: { title?: string; image?: string; paragraphs?: string[] };
  men?: { title?: string; bannerTitle?: string; image?: string };
  vip?: { title?: string; text?: string; image?: string };
}

export type SiteContentKey = keyof SiteContent;

/* ---------- ajustes ---------- */
export interface RegionSettings {
  preset: string;
  locale: string;
  currency: string;
  currencyName: string;
  phonePrefix: string;
  shippingArea: string;
  cityLabel: string;
  cityPlaceholder: string;
}

export interface Denominations {
  bills: number[];
  coins: number[];
}

export interface RegionPreset extends Omit<RegionSettings, 'preset'> {
  id: string;
  name: string;
  denominations: Denominations;
}

export interface DeliveryMethod {
  id: string;
  label: string;
  requiresAddress: boolean;
}

export interface PaymentOption {
  id: string;
  label: string;
}

export interface CheckoutSettings {
  deliveryMethods: DeliveryMethod[];
  paymentMethods: PaymentOption[];
  freeShippingFrom: number | null;
  note: string;
}

export interface StoreInfo {
  name: string;
  hours: string;
  address: string;
  email: string;
  social: { instagram?: string; facebook?: string; tiktok?: string };
}

export interface PublicSettings {
  whatsapp: string;
  announcements: string[];
  checkout: CheckoutSettings;
  popularSearches: string[];
  store: StoreInfo;
  region: RegionSettings;
}

export interface PrivateSettings {
  pos: { paymentMethods: string[]; ticketFooter: string; ticketWidth: number };
  cash: { suggestedFloat: number; denominations: Denominations };
  inventory: { lowStock: number; lastPieces: number; skuPrefix: string };
  cloudinary: { cloudName: string; apiKey: string; folder: string };
}

export interface Settings {
  public: PublicSettings;
  private: PrivateSettings;
}

/* ---------- lo que recibe la tienda (función storefront de Supabase) ---------- */
export interface StoreSize {
  label: string;
  stock: number;
  sku?: string;
}

export interface StoreColor {
  name: string;
  hex: string;
  family: string;
  images: string[];
  sizes: StoreSize[];
}

export interface StoreProduct {
  id: string;
  /** Código del producto (DV-MUJ-001). */
  sku: string;
  slug: string;
  name: string;
  department: string;
  category: string | null;
  price: number;
  compareAtPrice: number | null;
  description: string;
  details: string[];
  material: string;
  care: string;
  origin: string;
  colors: StoreColor[];
  sizes: StoreSize[];
  isNew: boolean;
  isBestseller: boolean;
  isFeatured: boolean;
  tags: string[];
  createdAt: string;
}

export interface StoreDepartment {
  slug: string;
  name: string;
  description: string;
  image: string;
}

export interface StoreCategory {
  slug: string;
  department: string;
  name: string;
  description: string;
  order: number;
  image: string;
  productCount: number;
}

export interface ColorFamily {
  id: string;
  name: string;
  hex: string;
}

export interface StoreBanner {
  id: string;
  placement: string;
  eyebrow: string;
  title: string;
  text: string;
  cta: { label: string; href: string };
  image: string;
  imageMobile: string;
  theme: string;
}

export interface StoreLookbook {
  id: string;
  eyebrow: string;
  title: string;
  text: string;
  image: string;
  hotspots: Hotspot[];
}

export interface StoreFaq {
  q: string;
  a: string;
}

export interface StorefrontPayload {
  settings: PublicSettings;
  departments: StoreDepartment[];
  categories: StoreCategory[];
  colorFamilies: ColorFamily[];
  banners: StoreBanner[];
  lookbooks: StoreLookbook[];
  faq: StoreFaq[];
  content: SiteContent;
  products: StoreProduct[];
}

/** Lo que devuelve product_page(): una prenda con sus datos para la página de producto. */
export interface ProductPagePayload {
  settings: PublicSettings;
  product: StoreProduct;
  category: StoreCategory | null;
  department: StoreDepartment | null;
  related: StoreProduct[];
}
