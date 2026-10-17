/**
 * Cálculos para el resumen, los reportes y clientes. Todo se calcula con los pedidos reales
 * (los de la tienda en línea y los del punto de venta) dentro del rango elegido.
 */
import { isSale, saleDate, round2, lowStockOf, productStock, variantLabel, methodLabel, channelInfo } from '../../backend/model.js';
import { buckets, bucketKey, granularity, inRange } from './dates.js';

export const salesIn = (orders, range) => orders.filter((o) => isSale(o) && inRange(saleDate(o), range));

export function summarize(orders) {
  let gross = 0, lineDisc = 0, orderDisc = 0, shipping = 0, total = 0, cost = 0, items = 0;
  for (const o of orders) {
    gross += o.subtotal;
    lineDisc += (o.items || []).reduce((a, i) => a + (i.discount || 0), 0);
    orderDisc += o.discount || 0;
    shipping += o.shipping || 0;
    total += o.total;
    cost += o.costTotal || 0;
    items += o.itemsCount || 0;
  }
  const discounts = round2(lineDisc + orderDisc);
  const net = round2(gross - discounts);
  return {
    count: orders.length,
    gross: round2(gross),
    discounts,
    net,
    shipping: round2(shipping),
    total: round2(total),
    cost: round2(cost),
    profit: round2(net - cost),
    margin: net > 0 ? (net - cost) / net : 0,
    items,
    avgTicket: orders.length ? total / orders.length : 0,
    unitsPerSale: orders.length ? items / orders.length : 0,
  };
}

/** Serie de ventas por día / semana / mes para la gráfica. */
export function series(orders, range, unit = granularity(range)) {
  const bs = buckets(range, unit).map((b) => ({ ...b, total: 0, count: 0, net: 0 }));
  const index = new Map(bs.map((b, i) => [b.key, i]));
  for (const o of orders) {
    const i = index.get(bucketKey(new Date(saleDate(o)), unit));
    if (i === undefined) continue;
    bs[i].total += o.total;
    bs[i].net += o.subtotal - (o.discount || 0) - (o.items || []).reduce((a, it) => a + (it.discount || 0), 0);
    bs[i].count += 1;
  }
  return { unit, points: bs.map((b) => ({ ...b, total: round2(b.total), net: round2(b.net) })) };
}

/**
 * Ventas por producto. El descuento general del pedido se reparte entre sus prendas
 * en proporción a su importe, para que la suma cuadre con las ventas netas.
 */
export function byProduct(orders) {
  const rows = new Map();
  for (const o of orders) {
    const base = (o.items || []).reduce((a, i) => a + i.total, 0) || 1;
    for (const it of o.items || []) {
      const key = it.productId || it.name;
      const share = (it.total / base) * (o.discount || 0);
      const r = rows.get(key) || { key, productId: it.productId, name: it.name, image: it.image, units: 0, revenue: 0, cost: 0, orders: 0 };
      r.units += it.qty;
      r.revenue += it.total - share;
      r.cost += (it.unitCost || 0) * it.qty;
      r.orders += 1;
      if (!r.image && it.image) r.image = it.image;
      rows.set(key, r);
    }
  }
  return [...rows.values()].map((r) => ({
    ...r, revenue: round2(r.revenue), cost: round2(r.cost), profit: round2(r.revenue - r.cost),
    margin: r.revenue > 0 ? (r.revenue - r.cost) / r.revenue : 0,
  })).sort((a, b) => b.revenue - a.revenue);
}

export function byCategory(orders, products, categories) {
  const catOf = new Map(products.map((p) => [p.id, p.category]));
  const names = new Map(categories.map((c) => [c.slug, c.name]));
  const depOf = new Map(categories.map((c) => [c.slug, c.department]));
  const rows = new Map();
  for (const r of byProduct(orders)) {
    const slug = catOf.get(r.productId) || 'sin-categoria';
    const row = rows.get(slug) || { key: slug, name: names.get(slug) || 'Sin categoría', department: depOf.get(slug) || '', units: 0, revenue: 0, cost: 0 };
    row.units += r.units;
    row.revenue += r.revenue;
    row.cost += r.cost;
    rows.set(slug, row);
  }
  return [...rows.values()].map((r) => ({ ...r, revenue: round2(r.revenue), cost: round2(r.cost), profit: round2(r.revenue - r.cost) }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function byPayment(orders) {
  const rows = new Map();
  for (const o of orders) {
    const pays = o.payments?.length ? o.payments : [{ method: o.paymentMethod || 'otro', amount: o.total }];
    for (const p of pays) {
      const r = rows.get(p.method) || { key: p.method, name: methodLabel(p.method), amount: 0, count: 0 };
      r.amount += Number(p.amount) || 0;
      r.count += 1;
      rows.set(p.method, r);
    }
  }
  return [...rows.values()].map((r) => ({ ...r, amount: round2(r.amount) })).sort((a, b) => b.amount - a.amount);
}

export function byChannel(orders) {
  const rows = new Map();
  for (const o of orders) {
    const r = rows.get(o.channel) || { key: o.channel, name: channelInfo(o.channel).label, amount: 0, count: 0 };
    r.amount += o.total;
    r.count += 1;
    rows.set(o.channel, r);
  }
  return [...rows.values()].map((r) => ({ ...r, amount: round2(r.amount) })).sort((a, b) => b.amount - a.amount);
}

/** Variantes en alerta (agotadas o por debajo de su mínimo). */
export function stockAlerts(products, fallbackMin = 1) {
  const out = [];
  for (const p of products) {
    if (p.status === 'archivado') continue;
    for (const v of p.variants || []) {
      if (v.active === false) continue;
      const min = lowStockOf(v, fallbackMin);
      if (v.stock <= min) {
        const color = p.colors.find((c) => c.id === v.colorId);
        out.push({ product: p, variant: v, color, label: variantLabel(p, v), min, out: v.stock <= 0 });
      }
    }
  }
  return out.sort((a, b) => a.variant.stock - b.variant.stock || a.product.name.localeCompare(b.product.name));
}

export function inventoryValue(products) {
  let units = 0, cost = 0, retail = 0, variants = 0, outCount = 0;
  for (const p of products) {
    if (p.status === 'archivado') continue;
    for (const v of p.variants || []) {
      if (v.active === false) continue;
      variants += 1;
      const s = Math.max(0, v.stock);
      if (!s) outCount += 1;
      units += s;
      cost += s * (p.cost || 0);
      retail += s * p.price;
    }
  }
  return { units, cost: round2(cost), retail: round2(retail), variants, outCount, products: products.filter((p) => p.status !== 'archivado' && productStock(p) > 0).length };
}

/** Clientas a partir de sus pedidos (se agrupan por teléfono o, si no hay, por nombre). */
export function customersFrom(orders) {
  const map = new Map();
  for (const o of orders) {
    const c = o.customer || {};
    const digits = String(c.phone || '').replace(/\D/g, '').slice(-10);
    const key = digits || (c.name ? `n:${c.name.trim().toLowerCase()}` : null);
    if (!key) continue;
    const r = map.get(key) || { key, name: c.name || 'Sin nombre', phone: c.phone || '', city: c.city || '', address: c.address || '', orders: [], spent: 0, count: 0, first: o.createdAt, last: o.createdAt, channels: new Set() };
    r.orders.push(o);
    if (isSale(o)) { r.spent += o.total; r.count += 1; }
    if (new Date(o.createdAt) > new Date(r.last)) { r.last = o.createdAt; if (c.name) r.name = c.name; if (c.city) r.city = c.city; if (c.address) r.address = c.address; }
    if (new Date(o.createdAt) < new Date(r.first)) r.first = o.createdAt;
    r.channels.add(o.channel);
    map.set(key, r);
  }
  return [...map.values()].map((r) => ({ ...r, spent: round2(r.spent), avg: r.count ? r.spent / r.count : 0, channels: [...r.channels] }))
    .sort((a, b) => new Date(b.last) - new Date(a.last));
}
