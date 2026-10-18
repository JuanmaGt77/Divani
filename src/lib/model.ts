/**
 * Modelo del negocio compartido por la tienda, el panel y los scripts de Node:
 * catálogos fijos (estados, métodos de pago, tallas, regiones), SKU, totales, ajustes
 * por defecto y utilidades de imágenes. Es TypeScript puro, sin DOM.
 * Las operaciones que cambian datos (pedidos, caja, inventario, productos) viven en
 * supabase/schema.sql: este archivo solo calcula lo que se muestra antes de guardar.
 */
import type {
  Banner,
  CashMovementType,
  Channel,
  ColorFamily,
  Faq,
  Lookbook,
  MovementType,
  Order,
  OrderStatus,
  PaymentStatus,
  Product,
  ProductVariant,
  RegionPreset,
  RegionSettings,
  Settings,
  Tone,
} from './types';

/* ---------- errores del negocio ---------- */
export class DomainError extends Error {
  code: string;
  constructor(message: string, code = 'invalid') {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export const fail = (message: string, code?: string): never => {
  throw new DomainError(message, code);
};

/* ---------- utilidades ---------- */
export const round2 = (n: unknown): number => Math.round((Number(n) || 0) * 100) / 100;

export const toInt = (n: unknown, min = 0, max = 1e9): number =>
  Math.min(max, Math.max(min, Math.trunc(Number(n) || 0)));

/** Minúsculas y sin acentos, para buscar: «Niñas» → «ninas». */
export const normalize = (s: unknown): string =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Texto de una línea: sin espacios repetidos y con largo máximo. */
export const clean = (s: unknown, max = 500): string =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/** Texto de varias líneas (respeta los saltos de línea). */
export const cleanText = (s: unknown, max = 2000): string =>
  String(s ?? '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, max);

export const bySort = <T extends { sort?: number }>(a: T, b: T): number => (a.sort ?? 0) - (b.sort ?? 0);

export function slugify(s: unknown): string {
  return normalize(s)
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/* ---------- catálogo ---------- */
export const COLOR_FAMILIES: ColorFamily[] = [
  { id: 'negro', name: 'Negro', hex: '#1B1A19' },
  { id: 'blanco', name: 'Blanco y marfil', hex: '#F6F2EA' },
  { id: 'beige', name: 'Beige y arena', hex: '#D9C6A6' },
  { id: 'cafe', name: 'Café y camel', hex: '#8A6547' },
  { id: 'azul', name: 'Azul', hex: '#5F7FA3' },
  { id: 'rosa', name: 'Rosa', hex: '#E7C6BD' },
  { id: 'verde', name: 'Verde', hex: '#7D8A6A' },
  { id: 'gris', name: 'Gris', hex: '#A3A19C' },
  { id: 'rojo', name: 'Rojo', hex: '#9E3B32' },
  { id: 'estampado', name: 'Estampados', hex: 'pattern' },
];

/** Sugiere la familia de color (para el filtro de la tienda) a partir del hex. */
export function guessFamily(hex: unknown): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m?.[1]) return 'beige';
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  if (l < 0.17) return 'negro';
  if (l > 0.9 && s < 0.45) return 'blanco';
  if (s < 0.12) return l > 0.82 ? 'blanco' : 'gris';
  if (h < 15 || h >= 345) return l > 0.68 ? 'rosa' : 'rojo';
  if (h < 48) return l > 0.62 ? 'beige' : 'cafe';
  if (h < 68) return l > 0.5 ? 'beige' : 'verde';
  if (h < 170) return 'verde';
  if (h < 265) return 'azul';
  return l > 0.55 ? 'rosa' : 'rojo';
}

export const SIZE_PRESETS = [
  { id: 'letras', name: 'Letras', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { id: 'letras-plus', name: 'Letras extendidas', sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
  { id: 'dama', name: 'Números de dama', sizes: ['0', '2', '4', '6', '8', '10', '12', '14', '16'] },
  {
    id: 'cintura',
    name: 'Cintura (jeans y pantalón)',
    sizes: ['24', '25', '26', '27', '28', '29', '30', '31', '32', '34', '36'],
  },
  { id: 'infantil', name: 'Niñas y niños', sizes: ['2T', '3T', '4T', '5', '6', '7', '8', '10', '12', '14'] },
  { id: 'unica', name: 'Talla única', sizes: ['Única'] },
];

const LETTER_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL'];

/** Orden natural de tallas: 2T < 3T < 5 < 12 < 24 < XS < S < … < Única. */
export function sizeRank(label: unknown): number {
  const s = String(label ?? '')
    .toUpperCase()
    .trim();
  const li = LETTER_SIZES.indexOf(s);
  if (li >= 0) return 200 + li;
  const t = /^(\d+)T$/.exec(s);
  if (t) return Number(t[1]);
  const n = /^(\d+(?:\.\d+)?)/.exec(s);
  if (n) return 20 + Number(n[1]);
  if (/^(UNICA|ÚNICA|UNITALLA|OS|U)$/.test(s)) return 900;
  return 500;
}

export const bySize = (a: { size: string }, b: { size: string }): number => sizeRank(a.size) - sizeRank(b.size);

/** Código corto del color para el SKU: «Champagne» → CHA, «Azul claro» → AZC. */
export function colorCode(name: unknown): string {
  const words = normalize(name)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const [first = '', second = ''] = words;
  if (!first) return 'COL';
  const code = words.length === 1 ? first.slice(0, 3) : first.slice(0, 2) + second.slice(0, 1);
  return code.toUpperCase().padEnd(3, 'X');
}

export function sizeCode(size: unknown): string {
  const s = normalize(size)
    .replace(/[^a-z0-9.]/g, '')
    .toUpperCase();
  if (!s) return 'U';
  if (/^(UNICA|UNITALLA)/.test(s)) return 'UNI';
  return s.slice(0, 5);
}

/** SKU de una variante: código del producto + color + talla (DV-MUJ-001-NEG-M). */
export const makeSku = (code: string, colorName: string, size: string): string =>
  [code, colorCode(colorName), sizeCode(size)].filter(Boolean).join('-');

/** Piezas en existencia de un producto (solo variantes activas). */
export const productStock = (p: Pick<Product, 'variants'>): number =>
  (p.variants || []).reduce((a, v) => a + (v.active === false ? 0 : Math.max(0, v.stock || 0)), 0);

export function variantLabel(
  product: Pick<Product, 'colors'> | null | undefined,
  variant: ProductVariant | null | undefined,
): string {
  const color = product?.colors?.find((c) => c.id === variant?.colorId);
  return [color?.name, variant?.size].filter(Boolean).join(' · ');
}

/** Umbral de «stock bajo» de una variante (el suyo o el general de la tienda). */
export const lowStockOf = (variant: Pick<ProductVariant, 'minStock'> | null | undefined, fallback = 1): number =>
  variant?.minStock != null ? Number(variant.minStock) : fallback;

/* ---------- pedidos y ventas ---------- */
export interface StatusInfo {
  id: string;
  label: string;
  tone: Tone;
  hint?: string;
}

export const ORDER_STATUSES: (StatusInfo & { id: OrderStatus })[] = [
  { id: 'nuevo', label: 'Nuevo', tone: 'blue', hint: 'Recibido, falta confirmar disponibilidad' },
  { id: 'confirmado', label: 'Confirmado', tone: 'amber', hint: 'Las piezas se apartan del inventario' },
  { id: 'preparando', label: 'En preparación', tone: 'plum', hint: 'Se está empacando' },
  { id: 'enviado', label: 'Enviado', tone: 'teal', hint: 'Va en camino' },
  { id: 'entregado', label: 'Entregado', tone: 'green', hint: 'La clienta ya lo tiene' },
  { id: 'cancelado', label: 'Cancelado', tone: 'red', hint: 'Las piezas regresan al inventario' },
];

/** Estados en los que las piezas del pedido ya salieron del inventario. */
export const STOCK_STATUSES: OrderStatus[] = ['confirmado', 'preparando', 'enviado', 'entregado'];

export const statusInfo = (id: string | null | undefined): StatusInfo =>
  ORDER_STATUSES.find((s) => s.id === id) || { id: String(id ?? ''), label: String(id ?? ''), tone: 'gray' };

export const PAYMENT_STATUSES: { id: PaymentStatus; label: string; short: string; tone: Tone }[] = [
  { id: 'pendiente', label: 'Pago pendiente', short: 'Pendiente', tone: 'amber' },
  { id: 'pagado', label: 'Pagado', short: 'Pagado', tone: 'green' },
  { id: 'reembolsado', label: 'Reembolsado', short: 'Reembolsado', tone: 'gray' },
];

export const paymentInfo = (id: string | null | undefined): { id: string; label: string; short: string; tone: Tone } =>
  PAYMENT_STATUSES.find((s) => s.id === id) || {
    id: String(id ?? ''),
    label: String(id ?? ''),
    short: String(id ?? ''),
    tone: 'gray',
  };

export const CHANNELS: { id: Channel; label: string; short: string }[] = [
  { id: 'web', label: 'Tienda en línea', short: 'En línea' },
  { id: 'tienda', label: 'Tienda física', short: 'Mostrador' },
  { id: 'whatsapp', label: 'WhatsApp', short: 'WhatsApp' },
  { id: 'otro', label: 'Otro', short: 'Otro' },
];

export const channelInfo = (id: string): { id: string; label: string; short: string } =>
  CHANNELS.find((c) => c.id === id) || { id, label: id, short: id };

export const PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'deposito', label: 'Depósito' },
  { id: 'otro', label: 'Otro' },
];

export const methodLabel = (id: string | null | undefined): string =>
  id === 'mixto' ? 'Mixto' : PAYMENT_METHODS.find((m) => m.id === id)?.label || id || '—';

export const CASH_MOVEMENT_TYPES: { id: CashMovementType; label: string; sign: 1 | -1; hint: string }[] = [
  { id: 'ingreso', label: 'Ingreso', sign: 1, hint: 'Cambio extra o dinero que entra a la caja' },
  { id: 'retiro', label: 'Retiro', sign: -1, hint: 'Efectivo que sale: depósito al banco, resguardo…' },
  { id: 'gasto', label: 'Gasto', sign: -1, hint: 'Pagos con dinero de la caja: envíos, papelería…' },
];

export const MOVEMENT_TYPES: Record<MovementType, string> = {
  inicial: 'Inventario inicial',
  entrada: 'Entrada',
  venta: 'Venta',
  ajuste: 'Ajuste',
  devolucion: 'Devolución',
  cancelacion: 'Cancelación',
};

export const ADJUST_REASONS = [
  'Conteo físico',
  'Prenda dañada',
  'Pérdida o robo',
  'Regalo o promoción',
  'Uso interno',
  'Corrección de captura',
  'Otro',
];

export interface TotalsLine {
  qty: unknown;
  unitPrice: unknown;
  discount?: unknown;
  unitCost?: unknown;
}

export interface OrderTotals {
  subtotal: number;
  lineDiscount: number;
  orderDiscount: number;
  discountTotal: number;
  shipping: number;
  net: number;
  total: number;
  itemsCount: number;
  costTotal: number;
}

/**
 * Totales de un pedido (lo mismo que calcula recalc_order en SQL). Los descuentos por línea
 * viven en cada prenda; `discount` es el descuento adicional sobre todo el pedido.
 */
export function orderTotals({
  items = [],
  discount = 0,
  shipping = 0,
}: { items?: TotalsLine[]; discount?: unknown; shipping?: unknown } = {}): OrderTotals {
  let subtotal = 0;
  let lineDiscount = 0;
  let itemsCount = 0;
  let costTotal = 0;
  for (const it of items) {
    const qty = toInt(it.qty, 0, 1e6);
    subtotal += (Number(it.unitPrice) || 0) * qty;
    lineDiscount += Math.max(0, Number(it.discount) || 0);
    costTotal += (Number(it.unitCost) || 0) * qty;
    itemsCount += qty;
  }
  subtotal = round2(subtotal);
  lineDiscount = round2(Math.min(lineDiscount, subtotal));
  const orderDiscount = round2(Math.min(Math.max(0, Number(discount) || 0), subtotal - lineDiscount));
  const ship = round2(Math.max(0, Number(shipping) || 0));
  return {
    subtotal,
    lineDiscount,
    orderDiscount,
    discountTotal: round2(lineDiscount + orderDiscount),
    shipping: ship,
    net: round2(subtotal - lineDiscount - orderDiscount),
    total: round2(subtotal - lineDiscount - orderDiscount + ship),
    itemsCount,
    costTotal: round2(costTotal),
  };
}

/** Una orden cuenta como venta cuando está pagada y no se canceló. */
export const isSale = (o: Pick<Order, 'paymentStatus' | 'status'>): boolean =>
  o.paymentStatus === 'pagado' && o.status !== 'cancelado';

/** Fecha en la que la venta cuenta para reportes. */
export const saleDate = (o: Pick<Order, 'paidAt' | 'createdAt'>): string => o.paidAt || o.createdAt;

/* ---------- región, moneda y caja ---------- */
export const REGION_PRESETS: Record<'gt' | 'mx' | 'us', RegionPreset> = {
  gt: {
    id: 'gt',
    name: 'Guatemala',
    locale: 'es-GT',
    currency: 'GTQ',
    currencyName: 'quetzales',
    phonePrefix: '502',
    shippingArea: 'toda Guatemala',
    cityLabel: 'Municipio y departamento',
    cityPlaceholder: 'Ej. Mixco, Guatemala',
    denominations: { bills: [200, 100, 50, 20, 10, 5, 1], coins: [1, 0.5, 0.25, 0.1, 0.05, 0.01] },
  },
  mx: {
    id: 'mx',
    name: 'México',
    locale: 'es-MX',
    currency: 'MXN',
    currencyName: 'pesos mexicanos',
    phonePrefix: '52',
    shippingArea: 'todo México',
    cityLabel: 'Ciudad y estado',
    cityPlaceholder: 'Ej. Guadalajara, Jalisco',
    denominations: { bills: [1000, 500, 200, 100, 50, 20], coins: [20, 10, 5, 2, 1, 0.5] },
  },
  us: {
    id: 'us',
    name: 'Estados Unidos',
    locale: 'es-US',
    currency: 'USD',
    currencyName: 'dólares',
    phonePrefix: '1',
    shippingArea: 'todo Estados Unidos',
    cityLabel: 'Ciudad y estado',
    cityPlaceholder: 'Ej. Houston, TX',
    denominations: { bills: [100, 50, 20, 10, 5, 1], coins: [0.25, 0.1, 0.05, 0.01] },
  },
};

export type RegionId = keyof typeof REGION_PRESETS;

export const isRegionId = (id: unknown): id is RegionId => typeof id === 'string' && id in REGION_PRESETS;

/** La tienda es de Guatemala: es la región que se usa mientras no se configure otra. */
export const DEFAULT_REGION: RegionId = 'gt';

export function pickRegion(p: RegionPreset): Omit<RegionSettings, 'preset'> {
  return {
    locale: p.locale,
    currency: p.currency,
    currencyName: p.currencyName,
    phonePrefix: p.phonePrefix,
    shippingArea: p.shippingArea,
    cityLabel: p.cityLabel,
    cityPlaceholder: p.cityPlaceholder,
  };
}

const DEFAULT_PRESET = REGION_PRESETS[DEFAULT_REGION];

export const DEFAULT_SETTINGS: Settings = {
  public: {
    whatsapp: '',
    announcements: [
      'Ropa americana premium',
      'Compra fácil por WhatsApp',
      `Envíos a ${DEFAULT_PRESET.shippingArea}`,
      'Piezas limitadas por modelo',
      'Atención personalizada',
    ],
    checkout: {
      deliveryMethods: [
        { id: 'envio', label: 'Envío a domicilio', requiresAddress: true },
        { id: 'entrega', label: 'Entrega en punto acordado', requiresAddress: false },
      ],
      paymentMethods: [
        { id: 'transferencia', label: 'Transferencia' },
        { id: 'deposito', label: 'Depósito' },
        { id: 'efectivo', label: 'Efectivo al entregar' },
      ],
      freeShippingFrom: null,
      note: 'El costo y tiempo de envío te los confirmamos por WhatsApp según tu ciudad.',
    },
    popularSearches: ['Vestidos', 'Mezclilla', 'Satín', 'Blazer', 'Niñas', 'Bolsas'],
    store: {
      name: 'Divani',
      hours: 'Lunes a sábado · 10:00 a 19:00 h',
      address: '',
      email: '',
      social: {
        instagram: 'https://www.instagram.com/',
        facebook: 'https://www.facebook.com/',
        tiktok: 'https://www.tiktok.com/',
      },
    },
    region: { preset: DEFAULT_REGION, ...pickRegion(DEFAULT_PRESET) },
  },
  private: {
    pos: {
      paymentMethods: ['efectivo', 'tarjeta', 'transferencia'],
      ticketFooter: '¡Gracias por tu compra! Cambios con ticket dentro de los primeros 7 días.',
      ticketWidth: 80,
    },
    cash: { suggestedFloat: 500, denominations: DEFAULT_PRESET.denominations },
    inventory: { lowStock: 0, lastPieces: 2, skuPrefix: 'DV' },
    cloudinary: { cloudName: '', apiKey: '', folder: 'divani' },
  },
};

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Une los valores guardados con los de base, recursivamente (las listas se reemplazan completas). */
function deepMerge<T>(base: T, over: unknown): T {
  if (over === undefined || over === null) return base;
  if (!isPlain(base) || !isPlain(over)) return over as T;
  const out: Plain = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = k in base ? deepMerge(base[k], v) : v;
  return out as T;
}

export interface SavedSettings {
  public?: unknown;
  private?: unknown;
}

/** Une ajustes guardados con los valores por defecto (sin perder llaves nuevas). */
export function mergeSettings(saved: SavedSettings | null | undefined = {}): Settings {
  return {
    public: deepMerge(structuredClone(DEFAULT_SETTINGS.public), saved?.public),
    private: deepMerge(structuredClone(DEFAULT_SETTINGS.private), saved?.private),
  };
}

/* ---------- imágenes ---------- */
export const PLACEHOLDER_IMAGE = '/images/placeholder-product.svg';

/** Ruta absoluta para archivos de la carpeta public (images/…, media/…, brand/…). */
export const localUrl = (u: string): string =>
  /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(u) ? u : `/${u.replace(/^\.\//, '')}`;

export interface CdnOptions {
  w?: number;
  h?: number;
  crop?: string;
  ar?: string;
}

/**
 * Inserta transformaciones en una URL de Cloudinary (formato y calidad automáticos y ancho).
 * Las rutas locales (images/…) se devuelven como ruta absoluta.
 */
export function cdn(url: string | null | undefined, { w, h, crop = 'limit', ar }: CdnOptions = {}): string {
  const u = String(url || '');
  if (!u) return '';
  const i = u.indexOf('/upload/');
  if (!/^https:\/\/res\.cloudinary\.com\//.test(u) || i < 0) return localUrl(u);
  const rest = u.slice(i + 8);
  if (/^(?:[a-z]{1,3}_[^/]+,?)+\//.test(rest) && !/^v\d+\//.test(rest)) return u; // ya trae transformaciones
  const isVideo = u.includes('/video/upload/');
  const t = [
    'f_auto',
    'q_auto',
    ar && `ar_${ar}`,
    (w || h) && `c_${ar ? 'fill' : crop}`,
    ar && 'g_auto',
    w && `w_${w}`,
    h && `h_${h}`,
  ].filter(Boolean) as string[];
  if (isVideo) t.splice(t.indexOf('q_auto') + 1, 0, 'vc_auto');
  return `${u.slice(0, i + 8)}${t.join(',')}/${rest}`;
}

/* ---------- contenido: validación antes de guardar ---------- */
export function normalizeBanner(b: Partial<Banner> = {}): Banner {
  if (!b.image) fail('Sube la imagen del banner.');
  return {
    ...(b.id ? { id: b.id } : {}),
    placement: b.placement || 'home-carousel',
    eyebrow: clean(b.eyebrow, 60),
    title: clean(b.title, 120) || fail('Escribe el título del banner.'),
    text: clean(b.text, 240),
    ctaLabel: clean(b.ctaLabel, 40),
    ctaHref: clean(b.ctaHref, 300) || '/tienda',
    image: String(b.image),
    imageMobile: b.imageMobile || '',
    theme: b.theme || 'light',
    active: b.active !== false,
    startsAt: b.startsAt || null,
    endsAt: b.endsAt || null,
  };
}

export function normalizeLookbook(l: Partial<Lookbook> = {}): Lookbook {
  if (!l.image) fail('Sube la foto del look.');
  return {
    ...(l.id ? { id: l.id } : {}),
    eyebrow: clean(l.eyebrow, 60),
    title: clean(l.title, 120) || fail('Escribe el título del look.'),
    text: clean(l.text, 400),
    image: String(l.image),
    active: l.active !== false,
    hotspots: (l.hotspots || [])
      .filter((h) => h.product)
      .map((h) => ({
        product: h.product,
        color: h.color || '',
        x: round2(Math.min(97, Math.max(3, Number(h.x) || 50))),
        y: round2(Math.min(97, Math.max(3, Number(h.y) || 50))),
      }))
      .slice(0, 8),
  };
}

export function normalizeFaq(f: Partial<Faq> = {}): Faq {
  return {
    ...(f.id ? { id: f.id } : {}),
    question: clean(f.question, 200) || fail('Escribe la pregunta.'),
    answer: cleanText(f.answer, 1500) || fail('Escribe la respuesta.'),
    active: f.active !== false,
  };
}

/* ---------- enlaces de la tienda ---------- */
/**
 * Convierte enlaces guardados con el formato anterior (tienda.html?…, index.html#…) a las
 * direcciones actuales (/tienda?…, /#…). Los enlaces externos (https://…) no cambian.
 */
export function storeHref(href: string | null | undefined): string {
  const h = String(href || '').trim();
  if (!h) return '/tienda';
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(h)) return h;
  const m = /^\.?\/?(index|tienda|aviso-de-privacidad|404)\.html(.*)$/.exec(h);
  if (m) return `${m[1] === 'index' ? '/' : `/${m[1]}`}${m[2] ?? ''}`;
  return h.startsWith('/') ? h : `/${h}`;
}
