/**
 * Modelo de dominio compartido por la tienda, el panel y los scripts de Node:
 * catálogos fijos (estados, métodos de pago, tallas, regiones), SKU, totales,
 * reglas de caja y la forma en que la tienda recibe los productos.
 * Es JavaScript puro, sin DOM: el SQL de Supabase replica estas mismas reglas.
 */

/* ---------- errores del negocio ---------- */
export class DomainError extends Error {
  constructor(message, code = 'invalid') {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
export const fail = (message, code) => { throw new DomainError(message, code); };

/* ---------- utilidades ---------- */
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const toInt = (n, min = 0, max = 1e9) => Math.min(max, Math.max(min, Math.trunc(Number(n) || 0)));
export const normalize = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const clean = (s, max = 500) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
export const cleanText = (s, max = 2000) => String(s ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
export const bySort = (a, b) => (a.sort ?? 0) - (b.sort ?? 0);

export function slugify(s) {
  return normalize(s).replace(/&/g, ' y ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

/* ---------- catálogo ---------- */
export const DEPARTMENT_CODES = { mujer: 'MUJ', ninas: 'NNA', ninos: 'NNO', hombre: 'HOM' };

export const COLOR_FAMILIES = [
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
export function guessFamily(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return 'beige';
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
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
  { id: 'cintura', name: 'Cintura (jeans y pantalón)', sizes: ['24', '25', '26', '27', '28', '29', '30', '31', '32', '34', '36'] },
  { id: 'infantil', name: 'Niñas y niños', sizes: ['2T', '3T', '4T', '5', '6', '7', '8', '10', '12', '14'] },
  { id: 'unica', name: 'Talla única', sizes: ['Única'] },
];

const LETTER_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL'];

/** Orden natural de tallas: 2T < 3T < 5 < 12 < 24 < XS < S < … < Única. */
export function sizeRank(label) {
  const s = String(label ?? '').toUpperCase().trim();
  const li = LETTER_SIZES.indexOf(s);
  if (li >= 0) return 200 + li;
  const t = /^(\d+)T$/.exec(s);
  if (t) return Number(t[1]);
  const n = /^(\d+(?:\.\d+)?)/.exec(s);
  if (n) return 20 + Number(n[1]);
  if (/^(UNICA|ÚNICA|UNITALLA|OS|U)$/.test(s)) return 900;
  return 500;
}
export const bySize = (a, b) => sizeRank(a.size ?? a.label ?? a) - sizeRank(b.size ?? b.label ?? b);

/** Código corto del color para el SKU: «Champagne» → CHA, «Azul claro» → AZC. */
export function colorCode(name) {
  const words = normalize(name).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return 'COL';
  const code = words.length === 1 ? words[0].slice(0, 3) : words[0].slice(0, 2) + words[1][0];
  return code.toUpperCase().padEnd(3, 'X');
}

export function sizeCode(size) {
  const s = normalize(size).replace(/[^a-z0-9.]/g, '').toUpperCase();
  if (!s) return 'U';
  if (/^(UNICA|UNITALLA)/.test(s)) return 'UNI';
  return s.slice(0, 5);
}

export const makeSku = (code, colorName, size) => [code, colorCode(colorName), sizeCode(size)].filter(Boolean).join('-');

/** Siguiente código de producto libre: DV-MUJ-028. */
export function nextProductCode(products, department, prefix = 'DV') {
  const dep = DEPARTMENT_CODES[department] || String(department || 'GEN').slice(0, 3).toUpperCase();
  const base = `${prefix}-${dep}-`;
  let max = 0;
  for (const p of products) {
    if (String(p.code || '').startsWith(base)) max = Math.max(max, Number(String(p.code).slice(base.length)) || 0);
  }
  return `${base}${String(max + 1).padStart(3, '0')}`;
}

export const productStock = (p) => (p.variants || []).reduce((a, v) => a + (v.active === false ? 0 : Math.max(0, v.stock || 0)), 0);

export function variantLabel(product, variant) {
  const color = product?.colors?.find((c) => c.id === variant?.colorId);
  return [color?.name, variant?.size].filter(Boolean).join(' · ');
}

/** Umbral de «stock bajo» de una variante (el suyo o el general de la tienda). */
export const lowStockOf = (variant, fallback = 1) => (variant?.minStock ?? null) !== null ? Number(variant.minStock) : fallback;

/* ---------- pedidos y ventas ---------- */
export const ORDER_STATUSES = [
  { id: 'nuevo', label: 'Nuevo', tone: 'blue', hint: 'Recibido, falta confirmar disponibilidad' },
  { id: 'confirmado', label: 'Confirmado', tone: 'amber', hint: 'Las piezas se apartan del inventario' },
  { id: 'preparando', label: 'En preparación', tone: 'plum', hint: 'Se está empacando' },
  { id: 'enviado', label: 'Enviado', tone: 'teal', hint: 'Va en camino' },
  { id: 'entregado', label: 'Entregado', tone: 'green', hint: 'La clienta ya lo tiene' },
  { id: 'cancelado', label: 'Cancelado', tone: 'red', hint: 'Las piezas regresan al inventario' },
];
export const ORDER_STATUS_IDS = ORDER_STATUSES.map((s) => s.id);
/** Estados en los que las piezas del pedido ya salieron del inventario. */
export const STOCK_STATUSES = ['confirmado', 'preparando', 'enviado', 'entregado'];
export const statusInfo = (id) => ORDER_STATUSES.find((s) => s.id === id) || { id, label: id, tone: 'gray' };

export const PAYMENT_STATUSES = [
  { id: 'pendiente', label: 'Pago pendiente', short: 'Pendiente', tone: 'amber' },
  { id: 'pagado', label: 'Pagado', short: 'Pagado', tone: 'green' },
  { id: 'reembolsado', label: 'Reembolsado', short: 'Reembolsado', tone: 'gray' },
];
export const paymentInfo = (id) => PAYMENT_STATUSES.find((s) => s.id === id) || { id, label: id, short: id, tone: 'gray' };

export const CHANNELS = [
  { id: 'web', label: 'Tienda en línea', short: 'En línea' },
  { id: 'tienda', label: 'Tienda física', short: 'Mostrador' },
  { id: 'whatsapp', label: 'WhatsApp', short: 'WhatsApp' },
  { id: 'otro', label: 'Otro', short: 'Otro' },
];
export const channelInfo = (id) => CHANNELS.find((c) => c.id === id) || { id, label: id, short: id };

export const PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'deposito', label: 'Depósito' },
  { id: 'otro', label: 'Otro' },
];
export const methodLabel = (id) => (id === 'mixto' ? 'Mixto' : PAYMENT_METHODS.find((m) => m.id === id)?.label || id || '—');

export const CASH_MOVEMENT_TYPES = [
  { id: 'ingreso', label: 'Ingreso', sign: 1, hint: 'Cambio extra o dinero que entra a la caja' },
  { id: 'retiro', label: 'Retiro', sign: -1, hint: 'Efectivo que sale: depósito al banco, resguardo…' },
  { id: 'gasto', label: 'Gasto', sign: -1, hint: 'Pagos con dinero de la caja: envíos, papelería…' },
];

export const MOVEMENT_TYPES = {
  inicial: 'Inventario inicial',
  entrada: 'Entrada',
  venta: 'Venta',
  ajuste: 'Ajuste',
  devolucion: 'Devolución',
  cancelacion: 'Cancelación',
};

export const ADJUST_REASONS = ['Conteo físico', 'Prenda dañada', 'Pérdida o robo', 'Regalo o promoción', 'Uso interno', 'Corrección de captura', 'Otro'];

/**
 * Totales de un pedido. Los descuentos por línea viven en cada prenda;
 * `discount` es el descuento adicional sobre todo el pedido.
 */
export function orderTotals({ items = [], discount = 0, shipping = 0 } = {}) {
  let subtotal = 0, lineDiscount = 0, itemsCount = 0, costTotal = 0;
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

export const lineTotal = (it) => round2((Number(it.unitPrice) || 0) * toInt(it.qty) - Math.max(0, Number(it.discount) || 0));

/** Una orden cuenta como venta cuando está pagada y no se canceló. */
export const isSale = (o) => o.paymentStatus === 'pagado' && o.status !== 'cancelado';

/** Fecha en la que la venta cuenta para reportes. */
export const saleDate = (o) => o.paidAt || o.createdAt;

export const cashOf = (o) => (o.payments || []).filter((p) => p.method === 'efectivo').reduce((a, p) => a + (Number(p.amount) || 0), 0);

/** Resumen de una sesión de caja (lo mismo que calcula cash_close en SQL). */
export function cashSummary(session, orders = [], movements = []) {
  const mine = orders.filter((o) => o.cashSessionId === session.id);
  const live = mine.filter(isSale);
  const byMethod = {};
  let salesTotal = 0, items = 0;
  for (const o of live) {
    salesTotal += o.total;
    items += o.itemsCount || 0;
    const pays = o.payments?.length ? o.payments : [{ method: o.paymentMethod || 'otro', amount: o.total }];
    for (const p of pays) byMethod[p.method] = round2((byMethod[p.method] || 0) + (Number(p.amount) || 0));
  }
  const mv = { ingreso: 0, retiro: 0, gasto: 0 };
  for (const m of movements) if (m.sessionId === session.id && m.type in mv) mv[m.type] = round2(mv[m.type] + Number(m.amount || 0));
  const cashSales = round2(byMethod.efectivo || 0);
  return {
    salesCount: live.length,
    salesTotal: round2(salesTotal),
    items,
    cancelled: mine.filter((o) => o.status === 'cancelado').length,
    byMethod,
    cashSales,
    movements: mv,
    expected: round2((Number(session.openingAmount) || 0) + cashSales + mv.ingreso - mv.retiro - mv.gasto),
  };
}

/* ---------- región, moneda y caja ---------- */
export const REGION_PRESETS = {
  mx: {
    id: 'mx', name: 'México', locale: 'es-MX', currency: 'MXN', currencyName: 'pesos mexicanos',
    phonePrefix: '52', shippingArea: 'todo México', cityLabel: 'Ciudad y estado', cityPlaceholder: 'Ej. Guadalajara, Jalisco',
    denominations: { bills: [1000, 500, 200, 100, 50, 20], coins: [20, 10, 5, 2, 1, 0.5] },
  },
  gt: {
    id: 'gt', name: 'Guatemala', locale: 'es-GT', currency: 'GTQ', currencyName: 'quetzales',
    phonePrefix: '502', shippingArea: 'toda Guatemala', cityLabel: 'Municipio y departamento', cityPlaceholder: 'Ej. Mixco, Guatemala',
    denominations: { bills: [200, 100, 50, 20, 10, 5, 1], coins: [1, 0.5, 0.25, 0.1, 0.05, 0.01] },
  },
  us: {
    id: 'us', name: 'Estados Unidos', locale: 'es-US', currency: 'USD', currencyName: 'dólares',
    phonePrefix: '1', shippingArea: 'todo Estados Unidos', cityLabel: 'Ciudad y estado', cityPlaceholder: 'Ej. Houston, TX',
    denominations: { bills: [100, 50, 20, 10, 5, 1], coins: [0.25, 0.1, 0.05, 0.01] },
  },
};

export const DEFAULT_SETTINGS = {
  public: {
    whatsapp: '',
    announcements: [
      'Ropa americana con etiqueta original',
      'Compra fácil por WhatsApp',
      'Envíos a todo México',
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
      social: { instagram: 'https://www.instagram.com/', facebook: 'https://www.facebook.com/', tiktok: 'https://www.tiktok.com/' },
    },
    region: { preset: 'mx', ...pickRegion(REGION_PRESETS.mx) },
  },
  private: {
    pos: { paymentMethods: ['efectivo', 'tarjeta', 'transferencia'], ticketFooter: '¡Gracias por tu compra! Cambios con ticket dentro de los primeros 7 días.', ticketWidth: 80 },
    cash: { suggestedFloat: 500, denominations: REGION_PRESETS.mx.denominations },
    inventory: { lowStock: 0, lastPieces: 2, skuPrefix: 'DV' },
    cloudinary: { cloudName: '', apiKey: '', folder: 'divani' },
  },
};

export function pickRegion(p) {
  return {
    locale: p.locale, currency: p.currency, currencyName: p.currencyName, phonePrefix: p.phonePrefix,
    shippingArea: p.shippingArea, cityLabel: p.cityLabel, cityPlaceholder: p.cityPlaceholder,
  };
}

/** Une ajustes guardados con los valores por defecto (sin perder llaves nuevas). */
export function mergeSettings(saved = {}) {
  const deep = (base, over) => {
    if (Array.isArray(base) || Array.isArray(over)) return over ?? base;
    if (typeof base !== 'object' || base === null) return over ?? base;
    const out = { ...base };
    for (const [k, v] of Object.entries(over || {})) out[k] = k in base ? deep(base[k], v) : v;
    return out;
  };
  return { public: deep(DEFAULT_SETTINGS.public, saved.public), private: deep(DEFAULT_SETTINGS.private, saved.private) };
}

/* ---------- lo que recibe la tienda ---------- */
export const PLACEHOLDER_IMAGE = 'images/placeholder-product.svg';

/** Producto del panel → forma que usa la tienda (colores con sus tallas y existencias). */
export function toStorefrontProduct(p) {
  const variants = (p.variants || []).filter((v) => v.active !== false);
  const colors = [...(p.colors || [])].sort(bySort).map((c) => {
    const vs = variants.filter((v) => v.colorId === c.id).sort(bySize);
    return {
      name: c.name,
      hex: c.hex,
      family: c.family,
      images: c.images?.length ? [...c.images] : [PLACEHOLDER_IMAGE],
      sizes: vs.map((v) => ({ label: v.size, stock: Math.max(0, v.stock || 0), sku: v.sku })),
    };
  }).filter((c) => c.sizes.length);
  const agg = new Map();
  for (const c of colors) for (const s of c.sizes) agg.set(s.label, (agg.get(s.label) || 0) + s.stock);
  const sizes = [...agg.keys()].sort((a, b) => sizeRank(a) - sizeRank(b)).map((label) => ({ label, stock: agg.get(label) }));
  return {
    id: p.id,
    sku: p.code,
    slug: p.slug,
    name: p.name,
    department: p.department,
    category: p.category,
    price: Number(p.price) || 0,
    compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
    description: p.description || '',
    details: p.details || [],
    material: p.material || '',
    care: p.care || '',
    origin: p.origin || '',
    colors,
    sizes,
    isNew: !!p.isNew,
    isBestseller: !!p.isBestseller,
    isFeatured: !!p.isFeatured,
    tags: p.tags || [],
    createdAt: p.createdAt,
  };
}

const inWindow = (b, now) =>
  (!b.startsAt || new Date(b.startsAt).getTime() <= now) && (!b.endsAt || new Date(b.endsAt).getTime() >= now);

/** Todo lo que la tienda necesita para pintarse (equivale a la función storefront() de Supabase). */
export function storefrontPayload(db, now = Date.now()) {
  const products = db.products
    .filter((p) => p.status === 'activo')
    .sort(bySort)
    .map(toStorefrontProduct)
    .filter((p) => p.colors.length);
  const counts = {};
  for (const p of products) counts[p.category] = (counts[p.category] || 0) + 1;
  const settings = mergeSettings(db.settings).public;
  return {
    settings,
    departments: db.departments.filter((d) => d.active !== false).sort(bySort)
      .map(({ slug, name, description, image }) => ({ slug, name, description, image })),
    categories: db.categories.filter((c) => c.active !== false).sort(bySort)
      .map((c) => ({ slug: c.slug, department: c.department, name: c.name, description: c.description, order: c.sort, image: c.image, productCount: counts[c.slug] || 0 })),
    colorFamilies: COLOR_FAMILIES,
    banners: db.banners.filter((b) => b.active !== false && inWindow(b, now)).sort(bySort).map(toStorefrontBanner),
    lookbooks: db.lookbooks.filter((l) => l.active !== false).sort(bySort)
      .map(({ id, eyebrow, title, text, image, hotspots }) => ({ id, eyebrow, title, text, image, hotspots: hotspots || [] })),
    faq: db.faq.filter((f) => f.active !== false).sort(bySort).map((f) => ({ q: f.question, a: f.answer })),
    content: db.content || {},
    products,
  };
}

export function toStorefrontBanner(b) {
  return {
    id: b.id,
    placement: b.placement || 'home-carousel',
    eyebrow: b.eyebrow || '',
    title: b.title || '',
    text: b.text || '',
    cta: { label: b.ctaLabel || 'Ver más', href: b.ctaHref || 'tienda.html' },
    image: b.image,
    imageMobile: b.imageMobile || '',
    theme: b.theme || 'light',
  };
}

/* ---------- imágenes de Cloudinary ---------- */
/**
 * Inserta transformaciones en una URL de Cloudinary (formato y calidad automáticos y ancho).
 * Las rutas locales (images/…) se devuelven igual.
 */
export function cdn(url, { w, h, crop = 'limit', ar } = {}) {
  const u = String(url || '');
  const i = u.indexOf('/upload/');
  if (!/^https:\/\/res\.cloudinary\.com\//.test(u) || i < 0) return u;
  const rest = u.slice(i + 8);
  if (/^(?:[a-z]{1,3}_[^/]+,?)+\//.test(rest) && !/^v\d+\//.test(rest)) return u; // ya trae transformaciones
  const isVideo = u.includes('/video/upload/');
  const t = ['f_auto', 'q_auto', ar && `ar_${ar}`, (w || h) && `c_${ar ? 'fill' : crop}`, ar && 'g_auto', w && `w_${w}`, h && `h_${h}`].filter(Boolean);
  if (isVideo) t.splice(t.indexOf('q_auto') + 1, 0, 'vc_auto');
  return `${u.slice(0, i + 8)}${t.join(',')}/${rest}`;
}

/* ---------- contenido: validación compartida (demo y Supabase) ---------- */
export function normalizeBanner(b = {}) {
  if (!b.image) fail('Sube la imagen del banner.');
  return {
    ...(b.id ? { id: b.id } : {}),
    placement: b.placement || 'home-carousel',
    eyebrow: clean(b.eyebrow, 60),
    title: clean(b.title, 120) || fail('Escribe el título del banner.'),
    text: clean(b.text, 240),
    ctaLabel: clean(b.ctaLabel, 40),
    ctaHref: clean(b.ctaHref, 300) || 'tienda.html',
    image: b.image,
    imageMobile: b.imageMobile || '',
    theme: b.theme || 'light',
    active: b.active !== false,
    startsAt: b.startsAt || null,
    endsAt: b.endsAt || null,
  };
}

export function normalizeLookbook(l = {}) {
  if (!l.image) fail('Sube la foto del look.');
  return {
    ...(l.id ? { id: l.id } : {}),
    eyebrow: clean(l.eyebrow, 60),
    title: clean(l.title, 120) || fail('Escribe el título del look.'),
    text: clean(l.text, 400),
    image: l.image,
    active: l.active !== false,
    hotspots: (l.hotspots || []).filter((h) => h.product).map((h) => ({
      product: h.product,
      color: h.color || '',
      x: round2(Math.min(97, Math.max(3, Number(h.x) || 50))),
      y: round2(Math.min(97, Math.max(3, Number(h.y) || 50))),
    })).slice(0, 8),
  };
}

export function normalizeFaq(f = {}) {
  return {
    ...(f.id ? { id: f.id } : {}),
    question: clean(f.question, 200) || fail('Escribe la pregunta.'),
    answer: cleanText(f.answer, 1500) || fail('Escribe la respuesta.'),
    active: f.active !== false,
  };
}
