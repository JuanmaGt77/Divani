/**
 * Operaciones del negocio sobre la base de datos en memoria (modo demostración).
 * Cada función replica una función RPC de supabase/schema.sql con las mismas reglas y
 * mensajes: si cambias una, cambia la otra.
 */
import {
  round2, toInt, clean, cleanText, slugify, makeSku, nextProductCode, orderTotals, lineTotal,
  ORDER_STATUS_IDS, STOCK_STATUSES, statusInfo, variantLabel, cashSummary, cashOf, guessFamily,
  mergeSettings, bySize, DomainError, fail, normalizeBanner, normalizeLookbook, normalizeFaq,
} from './model.js';

export { DomainError };

let counter = 0;
export const newId = () => globalThis.crypto?.randomUUID?.()
  || `${Date.now().toString(16)}-${(counter++).toString(16)}-${Math.random().toString(16).slice(2, 10)}`;

const iso = (at) => (at ? new Date(at) : new Date()).toISOString();
const who = (user) => ({ createdBy: user?.id || null, createdByName: user?.name || '' });

/* ---------- búsquedas ---------- */
export function findVariant(db, ref = {}) {
  for (const product of db.products) {
    for (const variant of product.variants) {
      const hit = (ref.variantId && variant.id === ref.variantId)
        || (ref.sku && variant.sku.toLowerCase() === String(ref.sku).toLowerCase())
        || (ref.slug && product.slug === ref.slug && variant.size === ref.size
          && product.colors.find((c) => c.id === variant.colorId)?.name === ref.color);
      if (hit) return { product, variant, color: product.colors.find((c) => c.id === variant.colorId) };
    }
  }
  return null;
}

const getOrder = (db, id) => db.orders.find((o) => o.id === id || o.number === id) || fail('No encontramos ese pedido.', 'not_found');
const openSession = (db) => db.cashSessions.find((s) => s.status === 'abierta') || null;

/* ---------- inventario ---------- */
function pushMovement(db, { product, variant, type, qty, reason, reference, orderId, unitCost, user, at }) {
  db.movements.unshift({
    id: newId(), variantId: variant.id, productId: product.id, sku: variant.sku,
    productName: product.name, variantLabel: variantLabel(product, variant),
    type, qty, stockAfter: variant.stock, unitCost: round2(unitCost ?? product.cost ?? 0),
    reason: reason || '', reference: reference || '', orderId: orderId || null,
    createdAt: iso(at), ...who(user),
  });
}

function changeStock(db, product, variant, delta, meta = {}) {
  if (!delta) return;
  const next = variant.stock + delta;
  if (next < 0) {
    fail(`No hay existencias suficientes de ${product.name} (${variantLabel(product, variant)}). Disponibles: ${variant.stock}.`, 'stock');
  }
  variant.stock = next;
  product.updatedAt = iso(meta.at);
  pushMovement(db, { product, variant, qty: delta, ...meta });
}

export function inventoryAdjust(db, { variantId, mode = 'delta', qty, reason, note, reference, user, at } = {}) {
  const found = findVariant(db, { variantId }) || fail('No encontramos esa variante.', 'not_found');
  const { product, variant } = found;
  const target = mode === 'set' ? toInt(qty, 0, 1e6) : variant.stock + Math.trunc(Number(qty) || 0);
  if (target < 0) fail(`No puedes dejar el inventario en negativo. Disponibles: ${variant.stock}.`, 'stock');
  changeStock(db, product, variant, target - variant.stock, {
    type: 'ajuste', reason: [clean(reason, 80) || 'Ajuste', clean(note, 200)].filter(Boolean).join(' · '),
    reference: clean(reference, 80), user, at,
  });
  return { variantId: variant.id, stock: variant.stock };
}

export function inventoryReceive(db, { items = [], reference, note, updateCost = true, user, at } = {}) {
  const list = items.filter((i) => toInt(i.qty) > 0);
  if (!list.length) fail('Agrega al menos una prenda con cantidad.');
  const resolved = list.map((i) => ({ ...i, found: findVariant(db, { variantId: i.variantId }) || fail('Una de las variantes ya no existe.', 'not_found') }));
  let units = 0;
  for (const { found: { product, variant }, qty, unitCost } of resolved) {
    const cost = Number(unitCost) > 0 ? round2(unitCost) : null;
    changeStock(db, product, variant, toInt(qty, 1, 1e6), {
      type: 'entrada', reason: clean(note, 200) || 'Entrada de mercancía', reference: clean(reference, 80),
      unitCost: cost ?? product.cost, user, at,
    });
    if (updateCost && cost !== null) product.cost = cost;
    units += toInt(qty);
  }
  return { units, lines: resolved.length };
}

/* ---------- pedidos ---------- */
function itemFrom(product, color, variant, qty, discount = 0) {
  const it = {
    id: newId(), productId: product.id, variantId: variant.id, sku: variant.sku,
    name: product.name, color: color?.name || '', size: variant.size, image: color?.images?.[0] || '',
    unitPrice: round2(product.price), unitCost: round2(product.cost || 0), qty, discount: round2(Math.max(0, discount)),
  };
  it.discount = Math.min(it.discount, round2(it.unitPrice * qty));
  it.total = lineTotal(it);
  return it;
}

function recalc(order) {
  const t = orderTotals(order);
  order.subtotal = t.subtotal;
  order.discount = t.orderDiscount;
  order.shipping = t.shipping;
  order.total = t.total;
  order.itemsCount = t.itemsCount;
  order.costTotal = t.costTotal;
  return order;
}

function addEvent(order, { type, from = null, to = null, note = '', user, at }) {
  order.events = order.events || [];
  order.events.push({ id: newId(), type, from, to, note, createdAt: iso(at), ...who(user) });
}

function newOrder(db, fields, at) {
  const stamp = iso(at);
  const order = {
    id: newId(), number: `DV-${db.seq.order++}`,
    channel: 'web', status: 'nuevo', paymentStatus: 'pendiente', paymentMethod: '', payments: [],
    deliveryMethod: '', customer: { name: '', phone: '', city: '', address: '' },
    notes: '', internalNotes: '', items: [], subtotal: 0, discount: 0, shipping: 0, total: 0,
    itemsCount: 0, costTotal: 0, stockApplied: false, cashSessionId: null,
    createdBy: null, createdByName: '', createdAt: stamp, updatedAt: stamp,
    confirmedAt: null, paidAt: null, deliveredAt: null, cancelledAt: null, cancelReason: '', events: [],
    ...fields,
  };
  return recalc(order);
}

/** Pedido desde la tienda en línea (anónimo). */
export function placeOrder(db, payload = {}, { at } = {}) {
  const c = payload.customer || {};
  const name = clean(c.name, 120) || fail('Escribe tu nombre.', 'invalid');
  const raw = Array.isArray(payload.items) ? payload.items : [];
  if (!raw.length) fail('Tu bolsa está vacía.');
  if (raw.length > 40) fail('El pedido tiene demasiadas prendas distintas.');
  const items = [];
  const problems = [];
  for (const it of raw) {
    const qty = toInt(it.qty, 1, 20);
    const found = findVariant(db, it);
    if (!found || found.product.status !== 'activo') { problems.push(`${clean(it.name, 80) || 'Una prenda'} ya no está disponible.`); continue; }
    const { product, color, variant } = found;
    if (variant.stock < qty) {
      problems.push(variant.stock
        ? `De ${product.name} (${variantLabel(product, variant)}) solo queda${variant.stock === 1 ? '' : 'n'} ${variant.stock}.`
        : `${product.name} (${variantLabel(product, variant)}) se agotó.`);
      continue;
    }
    const same = items.find((x) => x.variantId === variant.id);
    if (same) { same.qty = Math.min(variant.stock, same.qty + qty); same.total = lineTotal(same); } else items.push(itemFrom(product, color, variant, qty));
  }
  if (problems.length) fail(problems.join(' '), 'availability');
  const phone = String(c.phone || '').replace(/[^\d+]/g, '').slice(0, 20);
  if (phone) {
    const since = Date.now() - 10 * 60e3;
    const recent = db.orders.filter((o) => o.customer.phone === phone && new Date(o.createdAt).getTime() > since).length;
    if (recent >= 5) fail('Recibimos varios pedidos seguidos desde este teléfono. Escríbenos por WhatsApp para ayudarte.', 'rate_limit');
  }
  const order = newOrder(db, {
    channel: 'web',
    paymentMethod: clean(payload.payment, 40),
    deliveryMethod: clean(payload.delivery, 40),
    customer: { name, phone, city: clean(c.city, 120), address: cleanText(c.address, 300) },
    notes: cleanText(payload.notes, 500),
    items,
  }, at);
  addEvent(order, { type: 'creado', note: 'Pedido recibido desde la tienda en línea', at });
  db.orders.unshift(order);
  return { id: order.id, number: order.number, total: order.total, status: order.status };
}

function applyStock(db, order, sign, meta) {
  const lines = order.items.map((it) => ({ it, found: findVariant(db, { variantId: it.variantId }) || findVariant(db, { sku: it.sku }) }));
  if (sign < 0) {
    for (const { it, found } of lines) {
      if (!found) fail(`${it.name} (${it.sku}) ya no existe en el inventario. Quítalo del pedido para continuar.`, 'not_found');
      if (found.variant.stock < it.qty) {
        fail(`No hay existencias suficientes de ${it.name} (${[it.color, it.size].filter(Boolean).join(' · ')}). Disponibles: ${found.variant.stock}, se necesitan ${it.qty}.`, 'stock');
      }
    }
  }
  for (const { it, found } of lines) {
    if (!found) continue;
    changeStock(db, found.product, found.variant, sign * it.qty, {
      ...meta, reason: meta.reason || `Pedido ${order.number}`, reference: order.number, orderId: order.id, unitCost: it.unitCost,
    });
  }
  order.stockApplied = sign < 0;
}

/** Devuelve el efectivo de una venta ya incluida en un corte cerrado (retiro en la caja abierta). */
function refundCash(db, order, { user, at, reason }) {
  const cash = cashOf(order);
  if (!cash) return;
  const session = db.cashSessions.find((s) => s.id === order.cashSessionId);
  if (session && session.status === 'abierta') return; // la venta deja de contar en esta misma caja
  const open = openSession(db) || fail('Abre la caja para registrar la devolución del efectivo.', 'cash_closed');
  db.cashMovements.unshift({
    id: newId(), sessionId: open.id, type: 'retiro', amount: round2(cash),
    reason: reason || `Devolución del pedido ${order.number}`, createdAt: iso(at), ...who(user),
  });
}

export function orderSetStatus(db, id, status, { note, reason, user, at } = {}) {
  const order = getOrder(db, id);
  if (!ORDER_STATUS_IDS.includes(status)) fail('Estado no válido.');
  if (order.status === status) return order;
  const from = order.status;
  const wantsStock = STOCK_STATUSES.includes(status);
  if (wantsStock && !order.stockApplied) applyStock(db, order, -1, { type: 'venta', user, at });
  if (!wantsStock && order.stockApplied) {
    applyStock(db, order, +1, status === 'cancelado'
      ? { type: 'cancelacion', user, at }
      : { type: 'ajuste', reason: `Pedido ${order.number} regresó a «${statusInfo(status).label}»`, user, at });
  }
  const stamp = iso(at);
  if (status === 'cancelado') {
    if (order.paymentStatus === 'pagado') {
      refundCash(db, order, { user, at });
      order.paymentStatus = 'reembolsado';
    }
    order.cancelledAt = stamp;
    order.cancelReason = clean(reason || note, 300);
  } else if (from === 'cancelado') {
    order.cancelledAt = null;
    order.cancelReason = '';
  }
  if (wantsStock && !order.confirmedAt) order.confirmedAt = stamp;
  if (status === 'entregado') order.deliveredAt = stamp;
  order.status = status;
  order.updatedAt = stamp;
  addEvent(order, { type: 'estado', from, to: status, note: clean(reason || note, 300), user, at });
  return order;
}

export function orderSetPayment(db, id, { status, method, payments, note, user, at } = {}) {
  const order = getOrder(db, id);
  if (!['pendiente', 'pagado', 'reembolsado'].includes(status)) fail('Estado de pago no válido.');
  if (order.paymentStatus === status && status !== 'pagado') return order;
  if (status === 'pagado' && order.status === 'cancelado') fail('Este pedido está cancelado.');
  const from = order.paymentStatus;
  const stamp = iso(at);
  if (status === 'pagado') {
    const m = clean(method, 40) || order.paymentMethod || 'transferencia';
    order.payments = Array.isArray(payments) && payments.length
      ? payments.map((p) => ({ method: clean(p.method, 40), amount: round2(p.amount) }))
      : [{ method: m, amount: order.total }];
    const sum = round2(order.payments.reduce((a, p) => a + p.amount, 0));
    if (Math.abs(sum - order.total) > 0.01) fail('La suma de los pagos no coincide con el total del pedido.');
    order.paymentMethod = order.payments.length > 1 ? 'mixto' : order.payments[0].method;
    order.paidAt = order.paidAt && from === 'pagado' ? order.paidAt : stamp;
    const open = openSession(db);
    if (cashOf(order) > 0 && open && !order.cashSessionId) order.cashSessionId = open.id;
  } else if (status === 'pendiente') {
    const session = db.cashSessions.find((s) => s.id === order.cashSessionId);
    if (session?.status === 'cerrada') fail('Este pago ya forma parte de un corte de caja cerrado.');
    order.payments = [];
    order.paidAt = null;
    order.cashSessionId = null;
  } else {
    if (from === 'pagado') refundCash(db, order, { user, at });
  }
  order.paymentStatus = status;
  order.updatedAt = stamp;
  addEvent(order, { type: 'pago', from, to: status, note: clean(note, 300), user, at });
  return order;
}

/** Edición de datos del pedido: cliente, envío, descuento, notas y (si sigue «Nuevo») cantidades. */
export function orderUpdate(db, id, patch = {}, { user, at } = {}) {
  const order = getOrder(db, id);
  const money = ['shipping', 'discount'].some((k) => k in patch) || Array.isArray(patch.items);
  if (money && order.paymentStatus === 'pagado') fail('El pedido ya está pagado: no se pueden cambiar sus importes.');
  if (money && order.status === 'cancelado') fail('Este pedido está cancelado.');
  if (patch.customer) {
    const c = patch.customer;
    order.customer = {
      name: clean(c.name ?? order.customer.name, 120),
      phone: String(c.phone ?? order.customer.phone ?? '').replace(/[^\d+]/g, '').slice(0, 20),
      city: clean(c.city ?? order.customer.city, 120),
      address: cleanText(c.address ?? order.customer.address, 300),
    };
  }
  if ('shipping' in patch) order.shipping = round2(Math.max(0, Number(patch.shipping) || 0));
  if ('discount' in patch) order.discount = round2(Math.max(0, Number(patch.discount) || 0));
  if ('internalNotes' in patch) order.internalNotes = cleanText(patch.internalNotes, 1000);
  if ('deliveryMethod' in patch) order.deliveryMethod = clean(patch.deliveryMethod, 40);
  if ('paymentMethod' in patch && order.paymentStatus !== 'pagado') order.paymentMethod = clean(patch.paymentMethod, 40);
  if (Array.isArray(patch.items)) {
    if (order.stockApplied) fail('Regresa el pedido a «Nuevo» para cambiar sus prendas.');
    const next = [];
    for (const change of patch.items) {
      const it = order.items.find((x) => x.id === change.id);
      if (!it) continue;
      const qty = toInt(change.qty, 0, 99);
      if (qty > 0) next.push({ ...it, qty, total: lineTotal({ ...it, qty }) });
    }
    if (!next.length) fail('El pedido debe tener al menos una prenda. Si ya no va, cancélalo.');
    order.items = next;
  }
  recalc(order);
  order.updatedAt = iso(at);
  if (money) addEvent(order, { type: 'nota', note: 'Se actualizaron los importes del pedido', user, at });
  return order;
}

/* ---------- punto de venta ---------- */
export function posCheckout(db, payload = {}, { user, at, skipStock = false } = {}) {
  const session = openSession(db) || fail('Abre la caja para registrar ventas.', 'cash_closed');
  const raw = Array.isArray(payload.items) ? payload.items : [];
  if (!raw.length) fail('Agrega al menos una prenda al ticket.');
  const lines = raw.map((it) => {
    const found = findVariant(db, it) || fail('Una de las prendas ya no existe.', 'not_found');
    const qty = toInt(it.qty, 1, 999);
    if (!skipStock && found.variant.stock < qty) {
      fail(`No hay existencias suficientes de ${found.product.name} (${variantLabel(found.product, found.variant)}). Disponibles: ${found.variant.stock}.`, 'stock');
    }
    return { found, item: itemFrom(found.product, found.color, found.variant, qty, it.discount) };
  });
  const items = lines.map((l) => l.item);
  const totals = orderTotals({ items, discount: payload.discount });
  const pays = (Array.isArray(payload.payments) ? payload.payments : [])
    .map((p) => ({ method: clean(p.method, 40), amount: round2(p.amount), received: p.received != null ? round2(p.received) : null }))
    .filter((p) => p.method && p.amount > 0);
  if (!pays.length) fail('Indica cómo se pagó la venta.');
  const sum = round2(pays.reduce((a, p) => a + p.amount, 0));
  if (Math.abs(sum - totals.total) > 0.01) fail(`Los pagos suman ${sum} y el total es ${totals.total}.`);
  for (const p of pays) {
    if (p.method === 'efectivo') {
      const received = p.received ?? p.amount;
      if (received + 0.001 < p.amount) fail('El efectivo recibido es menor al importe a cobrar.');
      p.received = round2(received);
      p.change = round2(received - p.amount);
    } else {
      delete p.received;
    }
  }
  const stamp = iso(at);
  const c = payload.customer || {};
  const order = newOrder(db, {
    channel: 'tienda', status: 'entregado', paymentStatus: 'pagado',
    paymentMethod: pays.length > 1 ? 'mixto' : pays[0].method, payments: pays,
    customer: { name: clean(c.name, 120), phone: String(c.phone || '').replace(/[^\d+]/g, '').slice(0, 20), city: '', address: '' },
    notes: cleanText(payload.notes, 500), items, discount: totals.orderDiscount,
    cashSessionId: session.id, createdBy: user?.id || null, createdByName: user?.name || '',
    confirmedAt: stamp, paidAt: stamp, deliveredAt: stamp,
  }, at);
  if (!skipStock) {
    for (const { found, item } of lines) {
      changeStock(db, found.product, found.variant, -item.qty, { type: 'venta', reason: `Venta ${order.number}`, reference: order.number, orderId: order.id, unitCost: item.unitCost, user, at });
    }
  }
  order.stockApplied = true;
  addEvent(order, { type: 'creado', note: 'Venta en mostrador', user, at });
  db.orders.unshift(order);
  return order;
}

/* ---------- caja ---------- */
export function cashOpen(db, { amount, notes, user, at } = {}) {
  if (openSession(db)) fail('Ya hay una caja abierta.');
  const value = round2(amount);
  if (value < 0) fail('El fondo inicial no puede ser negativo.');
  const session = {
    id: newId(), number: db.seq.cash++, status: 'abierta',
    openedAt: iso(at), openedBy: user?.id || null, openedByName: user?.name || '',
    openingAmount: value, notes: cleanText(notes, 500),
    closedAt: null, closedBy: null, closedByName: '', expectedCash: null, countedCash: null, difference: null,
    breakdown: null, summary: null, closeNotes: '',
  };
  db.cashSessions.unshift(session);
  return session;
}

export function cashMovement(db, { type, amount, reason, user, at } = {}) {
  const session = openSession(db) || fail('La caja está cerrada.', 'cash_closed');
  if (!['ingreso', 'retiro', 'gasto'].includes(type)) fail('Tipo de movimiento no válido.');
  const value = round2(amount);
  if (!(value > 0)) fail('Escribe un importe mayor a cero.');
  if (type !== 'ingreso') {
    const { expected } = cashSummary(session, db.orders, db.cashMovements);
    if (value > expected + 0.001) fail(`En caja debería haber ${expected}; no puedes sacar más que eso.`);
  }
  const mv = { id: newId(), sessionId: session.id, type, amount: value, reason: clean(reason, 200), createdAt: iso(at), ...who(user) };
  db.cashMovements.unshift(mv);
  return mv;
}

export function cashClose(db, { counted, breakdown, notes, user, at } = {}) {
  const session = openSession(db) || fail('No hay una caja abierta.', 'cash_closed');
  const summary = cashSummary(session, db.orders, db.cashMovements);
  const value = round2(counted);
  if (value < 0) fail('El efectivo contado no puede ser negativo.');
  Object.assign(session, {
    status: 'cerrada', closedAt: iso(at), closedBy: user?.id || null, closedByName: user?.name || '',
    expectedCash: summary.expected, countedCash: value, difference: round2(value - summary.expected),
    breakdown: breakdown || null, summary, closeNotes: cleanText(notes, 500),
  });
  return session;
}

/* ---------- productos ---------- */
export function saveProduct(db, payload = {}, { user, at } = {}) {
  const stamp = iso(at);
  const existing = payload.id ? db.products.find((p) => p.id === payload.id) : null;
  if (payload.id && !existing) fail('Ese producto ya no existe.', 'not_found');
  const name = clean(payload.name, 140) || fail('Escribe el nombre del producto.');
  const department = payload.department;
  if (!db.departments.some((d) => d.slug === department)) fail('Elige un departamento.');
  const category = payload.category || null;
  if (category && !db.categories.some((c) => c.slug === category && c.department === department)) fail('La categoría no pertenece a ese departamento.');
  const price = round2(payload.price);
  if (!(price >= 0)) fail('Escribe un precio válido.');
  const compareAtPrice = payload.compareAtPrice ? round2(payload.compareAtPrice) : null;
  if (compareAtPrice !== null && compareAtPrice <= price) fail('El precio anterior debe ser mayor que el precio actual para mostrarse como oferta.');
  const status = ['activo', 'borrador', 'archivado'].includes(payload.status) ? payload.status : 'borrador';

  // Slug y código únicos
  let slug = slugify(payload.slug || name) || 'producto';
  const taken = (s) => db.products.some((p) => p.slug === s && p.id !== existing?.id);
  if (payload.slug && taken(slug)) fail(`Ya existe otro producto con la dirección «${slug}».`);
  for (let n = 2; taken(slug); n++) slug = `${slugify(payload.slug || name)}-${n}`;
  const prefix = mergeSettings(db.settings).private.inventory.skuPrefix || 'DV';
  let code = clean(payload.code, 40).toUpperCase() || existing?.code || nextProductCode(db.products, department, prefix);
  if (db.products.some((p) => p.code === code && p.id !== existing?.id)) fail(`El código ${code} ya lo usa otro producto.`);

  // Colores
  const colorIdByKey = new Map();
  const colors = (payload.colors || []).map((c, i) => {
    const id = existing?.colors.some((x) => x.id === c.id) ? c.id : newId();
    colorIdByKey.set(c.key ?? c.id, id);
    const hex = /^#[0-9a-f]{6}$/i.test(c.hex || '') ? c.hex.toUpperCase() : '#D9C6A6';
    return {
      id, name: clean(c.name, 60) || fail('Cada color necesita un nombre.'), hex,
      family: c.family || guessFamily(hex), images: (c.images || []).filter(Boolean).slice(0, 12), sort: i,
    };
  });
  const names = colors.map((c) => c.name.toLowerCase());
  if (new Set(names).size !== names.length) fail('Hay dos colores con el mismo nombre.');

  // Variantes y SKU
  const otherSkus = new Map();
  for (const p of db.products) if (p.id !== existing?.id) for (const v of p.variants) otherSkus.set(v.sku.toLowerCase(), p.name);
  const used = new Set();
  const variants = (payload.variants || []).map((v, i) => {
    const colorId = colorIdByKey.get(v.colorKey ?? v.colorId) || fail('Una talla quedó sin color.');
    const color = colors.find((c) => c.id === colorId);
    const size = clean(v.size, 20) || fail('Cada variante necesita una talla.');
    let sku = clean(v.sku, 60).toUpperCase();
    const auto = !sku;
    if (auto) sku = makeSku(code, color.name, size);
    for (let n = 2; auto && (used.has(sku.toLowerCase()) || otherSkus.has(sku.toLowerCase())); n++) sku = `${makeSku(code, color.name, size)}-${n}`;
    if (otherSkus.has(sku.toLowerCase())) fail(`El SKU ${sku} ya existe en «${otherSkus.get(sku.toLowerCase())}».`);
    if (used.has(sku.toLowerCase())) fail(`El SKU ${sku} está repetido.`);
    used.add(sku.toLowerCase());
    const prev = existing?.variants.find((x) => x.id === v.id);
    return {
      id: prev ? prev.id : newId(), colorId, size, sku,
      stock: toInt(v.stock, 0, 1e6), minStock: v.minStock === '' || v.minStock == null ? null : toInt(v.minStock, 0, 1e6),
      active: v.active !== false, sort: i, _prev: prev,
    };
  });
  const combos = variants.map((v) => `${v.colorId}|${v.size.toLowerCase()}`);
  if (new Set(combos).size !== combos.length) fail('Hay tallas repetidas dentro de un mismo color.');
  if (status === 'activo' && (!colors.length || !variants.length)) fail('Para publicar el producto agrega al menos un color y una talla.');

  const product = existing || { id: newId(), createdAt: stamp };
  const before = existing ? existing.variants.map((v) => ({ ...v })) : [];
  Object.assign(product, {
    slug, code, name, department, category,
    description: cleanText(payload.description, 2000),
    details: (payload.details || []).map((d) => clean(d, 160)).filter(Boolean).slice(0, 12),
    material: clean(payload.material, 160), care: clean(payload.care, 300), origin: clean(payload.origin, 80),
    price, compareAtPrice, cost: round2(Math.max(0, Number(payload.cost) || 0)),
    tags: [...new Set((payload.tags || []).map((t) => clean(t, 30).toLowerCase()).filter(Boolean))].slice(0, 15),
    isNew: !!payload.isNew, isBestseller: !!payload.isBestseller, isFeatured: !!payload.isFeatured,
    status, sort: existing?.sort ?? Math.max(0, ...db.products.map((p) => (p.sort ?? 0) + 1)),
    updatedAt: stamp, colors,
  });
  // Registra en el kardex los cambios de existencias hechos desde el editor
  product.variants = variants.map(({ _prev, ...v }) => {
    const delta = v.stock - (_prev?.stock ?? 0);
    if (delta) {
      const fake = { ...v, stock: v.stock };
      pushMovement(db, {
        product, variant: fake, type: _prev ? 'ajuste' : 'entrada', qty: delta,
        reason: _prev ? 'Edición del producto' : 'Alta de producto', user, at,
      });
    }
    return v;
  });
  for (const old of before) {
    if (!product.variants.some((v) => v.id === old.id) && old.stock > 0) {
      pushMovement(db, { product: { ...product, colors: existing.colors.concat(colors) }, variant: { ...old, stock: 0 }, type: 'ajuste', qty: -old.stock, reason: 'Variante eliminada', user, at });
    }
  }
  product.variants.sort((a, b) => {
    const ca = colors.findIndex((c) => c.id === a.colorId), cb = colors.findIndex((c) => c.id === b.colorId);
    return ca - cb || bySize(a, b);
  });
  product.variants.forEach((v, i) => { v.sort = i; });
  if (!existing) db.products.push(product);
  return product;
}

export function deleteProduct(db, id) {
  const i = db.products.findIndex((p) => p.id === id);
  if (i < 0) fail('Ese producto ya no existe.', 'not_found');
  db.products.splice(i, 1);
  for (const look of db.lookbooks) look.hotspots = (look.hotspots || []).filter((h) => db.products.some((p) => p.slug === h.product));
  return true;
}

/* ---------- departamentos y categorías ---------- */
export function saveDepartment(db, d = {}) {
  const dep = db.departments.find((x) => x.slug === d.slug) || fail('Departamento no encontrado.', 'not_found');
  Object.assign(dep, {
    name: clean(d.name, 60) || dep.name, description: clean(d.description, 200),
    image: d.image ?? dep.image, active: d.active !== false,
  });
  return dep;
}

export function saveCategory(db, c = {}) {
  const name = clean(c.name, 60) || fail('Escribe el nombre de la categoría.');
  if (!db.departments.some((d) => d.slug === c.department)) fail('Elige un departamento.');
  let cat = c.slug ? db.categories.find((x) => x.slug === c.slug) : null;
  if (!cat) {
    let slug = slugify(c.department === 'mujer' ? name : `${name}-${c.department}`);
    for (let n = 2; db.categories.some((x) => x.slug === slug); n++) slug = `${slugify(name)}-${c.department}-${n}`;
    cat = { slug, sort: Math.max(0, ...db.categories.map((x) => (x.sort ?? 0) + 1)) };
    db.categories.push(cat);
  } else if (cat.department !== c.department && db.products.some((p) => p.category === cat.slug)) {
    fail('Esta categoría tiene productos: muévelos antes de cambiarla de departamento.');
  }
  Object.assign(cat, { department: c.department, name, description: clean(c.description, 200), image: c.image || cat.image || '', active: c.active !== false });
  return cat;
}

export function deleteCategory(db, slug) {
  const used = db.products.filter((p) => p.category === slug).length;
  if (used) fail(`Esta categoría tiene ${used} producto${used === 1 ? '' : 's'}. Muévelos a otra categoría antes de eliminarla.`);
  db.categories = db.categories.filter((c) => c.slug !== slug);
  return true;
}

/* ---------- contenido ---------- */
function upsert(list, item, defaults = {}) {
  const found = item.id ? list.find((x) => x.id === item.id) : null;
  if (found) { Object.assign(found, item); return found; }
  const next = { ...defaults, ...item, id: newId(), sort: Math.max(-1, ...list.map((x) => x.sort ?? 0)) + 1 };
  list.push(next);
  return next;
}

export const saveBanner = (db, b = {}) => upsert(db.banners, normalizeBanner(b));

export const saveLookbook = (db, l = {}) => upsert(db.lookbooks, normalizeLookbook(l));

export const saveFaq = (db, f = {}) => upsert(db.faq, normalizeFaq(f));

export function removeFrom(db, table, id) {
  db[table] = db[table].filter((x) => x.id !== id);
  return true;
}

export function reorder(db, table, ids, key = 'id') {
  ids.forEach((id, i) => { const x = db[table].find((r) => r[key] === id); if (x) x.sort = i; });
  return true;
}

export function saveContent(db, key, value) {
  db.content = { ...(db.content || {}), [key]: value };
  return db.content[key];
}

export function saveSettings(db, next = {}) {
  db.settings = mergeSettings({
    public: { ...(db.settings?.public || {}), ...(next.public || {}) },
    private: { ...(db.settings?.private || {}), ...(next.private || {}) },
  });
  return db.settings;
}
