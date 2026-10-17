/**
 * Historial de ejemplo para la demostración: ~10 semanas de ventas de mostrador con sus
 * cortes de caja y pedidos de la tienda en línea en distintos estados. Sirve para que el
 * resumen, los reportes y la caja tengan datos que mirar. Es determinista (misma semilla,
 * mismos datos) y no descuenta inventario de las ventas antiguas.
 */
import { round2, toStorefrontProduct, cashSummary } from '../model.js';
import { placeOrder, posCheckout, cashOpen, cashMovement, cashClose, orderSetStatus, orderSetPayment } from '../ops.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Mariana', 'Fernanda', 'Daniela', 'Valeria', 'Sofía', 'Camila', 'Andrea', 'Paola', 'Gabriela', 'Lucía', 'Regina', 'Ximena', 'Ana Paula', 'Renata', 'Natalia', 'Karla', 'Jimena', 'Alejandra', 'Diana', 'Mónica', 'Laura', 'Patricia', 'Carmen', 'Jorge', 'Luis', 'Ricardo'];
const LAST = ['García', 'Hernández', 'López', 'Martínez', 'González', 'Rodríguez', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Morales', 'Ortiz', 'Castillo', 'Vargas'];
const CITIES = ['Guadalajara, Jalisco', 'Zapopan, Jalisco', 'Monterrey, Nuevo León', 'Ciudad de México', 'Puebla, Puebla', 'Querétaro, Querétaro', 'León, Guanajuato', 'Mérida, Yucatán', 'Tijuana, Baja California', 'Morelia, Michoacán'];
const STREETS = ['Av. Chapultepec 214, Col. Americana', 'Calle Morelos 88, Centro', 'Av. Vallarta 3012, Vallarta Poniente', 'Priv. Los Pinos 17, Jardines', 'Av. Juárez 540, Col. Moderna'];
const GASTOS = ['Bolsas de regalo', 'Envío por paquetería', 'Papelería', 'Artículos de limpieza', 'Café y agua'];

export function addDemoHistory(db, { days = 72, seed = 2077, now = new Date() } = {}) {
  const r = rng(seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const chance = (p) => r() < p;
  const user = { id: 'demo-admin', name: 'Administración' };

  // Clientas frecuentes (teléfonos de ejemplo con la secuencia 0000, no son reales)
  const customers = Array.from({ length: 34 }, (_, i) => ({
    name: `${FIRST[i % FIRST.length]} ${pick(LAST)}`,
    phone: `52${pick(['33', '55', '81', '22', '44'])}0000${String(1000 + i * 37).slice(-4)}`,
    city: pick(CITIES),
    address: pick(STREETS),
  }));

  // Popularidad: las favoritas y destacadas se venden más
  const sellable = [];
  for (const p of db.products) {
    const weight = 1 + (p.isBestseller ? 3 : 0) + (p.isFeatured ? 1.5 : 0) + (p.department === 'mujer' ? 1 : 0);
    for (const v of p.variants) sellable.push({ p, v, weight: weight / Math.max(1, p.variants.length / 4) });
  }
  const totalWeight = sellable.reduce((a, x) => a + x.weight, 0);
  const pickVariant = (needStock = false) => {
    for (let tries = 0; tries < 60; tries++) {
      let x = r() * totalWeight;
      for (const s of sellable) {
        x -= s.weight;
        if (x <= 0) {
          if (!needStock || s.v.stock > 0) return s;
          break;
        }
      }
    }
    return sellable.find((s) => !needStock || s.v.stock > 0);
  };
  const basket = (needStock) => {
    const n = chance(0.7) ? 1 : chance(0.83) ? 2 : 3;
    const out = [];
    for (let i = 0; i < n; i++) {
      const s = pickVariant(needStock);
      if (s && !out.some((o) => o.variantId === s.v.id)) out.push({ variantId: s.v.id, qty: 1, p: s.p, v: s.v });
    }
    return out;
  };

  const at = (day, h, m) => {
    const d = new Date(day);
    d.setHours(h, m, Math.floor(r() * 60), 0);
    return d;
  };

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days);

  for (let k = 0; k <= days; k++) {
    const day = new Date(start);
    day.setDate(start.getDate() + k);
    const isToday = k === days;
    const dow = day.getDay(); // 0 domingo
    const growth = 0.75 + (k / days) * 0.45;
    const events = [];

    // Ventas de mostrador (lunes a sábado)
    if (dow !== 0) {
      const base = dow === 6 ? 7 : dow === 5 ? 5 : 3.6;
      const count = Math.max(1, Math.round(base * growth + (r() - 0.5) * 3));
      for (let i = 0; i < count; i++) events.push({ kind: 'pos', t: at(day, 10 + Math.floor(r() * 9), Math.floor(r() * 60)) });
      if (chance(0.35)) events.push({ kind: 'gasto', t: at(day, 12 + Math.floor(r() * 5), Math.floor(r() * 60)) });
      if (chance(0.22)) events.push({ kind: 'retiro', t: at(day, 17, 30 + Math.floor(r() * 25)) });
    }
    // Pedidos en línea (todos los días)
    const webCount = Math.max(0, Math.round((dow === 0 || dow === 6 ? 2.2 : 1.4) * growth + (r() - 0.55) * 2));
    for (let i = 0; i < webCount; i++) events.push({ kind: 'web', t: at(day, 8 + Math.floor(r() * 15), Math.floor(r() * 60)) });

    events.sort((a, b) => a.t - b.t);
    let cut = isToday ? now : null;
    if (isToday) events.splice(0, events.length, ...events.filter((e) => e.t < now));
    if (!events.length && dow === 0) continue;

    // Abre la caja del día
    const opening = dow === 0 ? null : at(day, 9, 50 + Math.floor(r() * 8));
    if (opening && (!cut || opening < cut)) cashOpen(db, { amount: 500, notes: '', user, at: opening });

    for (const e of events) {
      try {
        if (e.kind === 'pos') {
          if (!db.cashSessions.some((s) => s.status === 'abierta')) continue;
          const items = basket(false).map(({ variantId, qty, p }) => ({ variantId, qty, discount: chance(0.08) ? round2(p.price * 0.1) : 0 }));
          if (!items.length) continue;
          const preview = items.reduce((a, it) => {
            const s = sellable.find((x) => x.v.id === it.variantId);
            return a + s.p.price * it.qty - it.discount;
          }, 0);
          const total = round2(preview);
          const method = r();
          let payments;
          if (method < 0.46) {
            const received = [100, 200, 500, 1000].map((b) => Math.ceil(total / b) * b).find((v) => v - total < 500) || total;
            payments = [{ method: 'efectivo', amount: total, received: chance(0.25) ? total : received }];
          } else if (method < 0.82) payments = [{ method: 'tarjeta', amount: total }];
          else if (method < 0.96) payments = [{ method: 'transferencia', amount: total }];
          else {
            const cash = Math.min(total, 200);
            payments = [{ method: 'efectivo', amount: cash, received: cash }, { method: 'tarjeta', amount: round2(total - cash) }];
          }
          const c = chance(0.4) ? pick(customers) : null;
          posCheckout(db, { items, payments, customer: c ? { name: c.name, phone: c.phone } : {} }, { user, at: e.t, skipStock: true });
        } else if (e.kind === 'gasto' || e.kind === 'retiro') {
          if (!db.cashSessions.some((s) => s.status === 'abierta')) continue;
          const session = db.cashSessions.find((s) => s.status === 'abierta');
          const { expected } = cashSummary(session, db.orders, db.cashMovements);
          const amount = e.kind === 'gasto' ? pick([45, 60, 85, 120, 150, 230]) : Math.floor((expected - 500) / 500) * 500;
          if (amount > 0 && amount <= expected) {
            cashMovement(db, { type: e.kind, amount, reason: e.kind === 'gasto' ? pick(GASTOS) : 'Depósito al banco', user, at: e.t });
          }
        } else if (e.kind === 'web') {
          const recent = (now - e.t) / 864e5;
          const needStock = recent < 4;
          const items = basket(needStock);
          if (!items.length) continue;
          const c = pick(customers);
          const delivery = chance(0.8) ? 'envio' : 'entrega';
          const payment = pick(['transferencia', 'transferencia', 'transferencia', 'deposito', 'efectivo']);
          const stockBefore = items.map((it) => it.v.stock);
          if (!needStock) items.forEach((it) => { it.v.stock += it.qty; }); // permite el pedido sin tocar el inventario actual
          const res = placeOrder(db, {
            items: items.map(({ variantId, qty }) => ({ variantId, qty })),
            customer: { name: c.name, phone: c.phone, city: c.city, address: delivery === 'envio' ? c.address : '' },
            delivery, payment, notes: chance(0.15) ? pick(['Es para regalo, ¿pueden envolverlo?', '¿Me confirman medidas de la cintura?', 'Entregar después de las 3 pm']) : '',
          }, { at: e.t });
          if (!needStock) items.forEach((it, i) => { it.v.stock = stockBefore[i]; });
          const order = db.orders.find((o) => o.id === res.id);
          const ship = delivery === 'envio' ? pick([99, 120, 150, 180]) : 0;
          order.shipping = ship;
          order.total = round2(order.subtotal - order.discount + ship);

          if (recent < 1.6 && chance(0.6)) continue; // se queda como «Nuevo»
          const later = (h) => new Date(e.t.getTime() + h * 3600e3);
          const step = (status, h) => {
            if (later(h) > now) return false;
            if (needStock) orderSetStatus(db, order.id, status, { user, at: later(h) });
            else {
              order.events.push({ id: `${order.id}-${status}`, type: 'estado', from: order.status, to: status, note: '', createdAt: later(h).toISOString(), createdBy: user.id, createdByName: user.name });
              if (status === 'confirmado') order.confirmedAt = later(h).toISOString();
              if (status === 'entregado') order.deliveredAt = later(h).toISOString();
              if (status === 'cancelado') { order.cancelledAt = later(h).toISOString(); order.cancelReason = 'La clienta ya no respondió'; }
              order.status = status;
              order.stockApplied = status !== 'cancelado';
              order.updatedAt = later(h).toISOString();
            }
            return true;
          };
          if (chance(0.08)) { step('cancelado', 20); continue; }
          if (!step('confirmado', 1.5)) continue;
          if (later(4) <= now && !(recent < 2.5 && chance(0.35))) {
            orderSetPayment(db, order.id, { status: 'pagado', method: payment === 'efectivo' ? 'transferencia' : payment, user, at: later(4) });
          }
          if (order.paymentStatus !== 'pagado') continue;
          if (!step('preparando', 18)) continue;
          if (!step('enviado', 30)) continue;
          step('entregado', delivery === 'envio' ? 76 : 40);
        }
      } catch {
        // Un evento de ejemplo que no aplica (sin existencias, caja cerrada…) simplemente se omite
      }
    }

    // Cierra la caja del día (la de hoy se queda abierta)
    const session = db.cashSessions.find((s) => s.status === 'abierta');
    if (session && !isToday) {
      const { expected } = cashSummary(session, db.orders, db.cashMovements);
      const diff = chance(0.82) ? 0 : pick([-20, -10, -5, 5, 10, 20, 50]);
      cashClose(db, { counted: round2(expected + diff), breakdown: null, notes: diff ? (diff < 0 ? 'Faltante revisado con el ticket' : 'Sobrante por cambio') : '', user, at: at(day, 19, 35) });
    }
  }

  // Algunos pedidos recientes en cada etapa, para ver el flujo completo en «Pedidos»
  const curated = [
    { hoursAgo: 30, flow: ['confirmado', 'pagado', 'preparando'] },
    { hoursAgo: 20, flow: ['confirmado'] },
    { hoursAgo: 9, flow: ['confirmado', 'pagado'] },
    { hoursAgo: 2, flow: [], note: '¿Tienen la talla M en otro color?' },
  ];
  for (const c of curated) {
    const when = new Date(now.getTime() - c.hoursAgo * 3600e3);
    const items = basket(true);
    if (!items.length) continue;
    const who = pick(customers);
    try {
      const res = placeOrder(db, {
        items: items.map(({ variantId }) => ({ variantId, qty: 1 })),
        customer: { name: who.name, phone: who.phone, city: who.city, address: who.address },
        delivery: 'envio', payment: 'transferencia', notes: c.note || '',
      }, { at: when });
      const order = db.orders.find((o) => o.id === res.id);
      order.shipping = 150;
      order.total = round2(order.subtotal - order.discount + order.shipping);
      c.flow.forEach((stepName, i) => {
        const t = new Date(when.getTime() + (i + 1) * 1.5 * 3600e3);
        if (t > now) return;
        if (stepName === 'pagado') orderSetPayment(db, order.id, { status: 'pagado', method: 'transferencia', user, at: t });
        else orderSetStatus(db, order.id, stepName, { user, at: t });
      });
    } catch {
      // sin existencias para ese ejemplo
    }
  }

  // Numeración en orden cronológico (los ejemplos de arriba se crearon al final)
  const chrono = [...db.orders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const renamed = new Map();
  chrono.forEach((o, i) => {
    const n = `DV-${1001 + i}`;
    if (o.number !== n) renamed.set(o.number, n);
    o.number = n;
  });
  if (renamed.size) {
    const fix = (s) => (s ? s.replace(/DV-\d+/g, (m) => renamed.get(m) || m) : s);
    for (const m of db.movements) { m.reason = fix(m.reason); m.reference = fix(m.reference); }
    for (const m of db.cashMovements) m.reason = fix(m.reason);
  }
  db.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Precalienta las fotos de los pedidos (por si el producto cambió)
  const bySlug = new Map(db.products.map((p) => [p.id, toStorefrontProduct(p)]));
  for (const o of db.orders) for (const it of o.items) if (!it.image) it.image = bySlug.get(it.productId)?.colors?.[0]?.images?.[0] || '';
  return db;
}
