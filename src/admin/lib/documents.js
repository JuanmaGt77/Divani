/** Documentos imprimibles: ticket de venta, nota de pedido y corte de caja. */
import { escHtml as e, printDocument } from './print.js';
import { money, dateTime, dateLong, time, phone as fmtPhone } from './format.js';
import { methodLabel, MOVEMENT_TYPES } from '../../backend/model.js';
import { paymentName, deliveryName, discountTotal } from './orders.js';

const logo = '<img class="logo" src="brand/logo-full.svg" alt="Divani">';
const row = (a, b, cls = '') => `<tr class="${cls}"><td>${a}</td><td class="num">${b}</td></tr>`;

export function printTicket(order, settings) {
  const store = settings?.public?.store || {};
  const pos = settings?.private?.pos || {};
  const width = Number(pos.ticketWidth) === 58 ? 'ticket58' : 'ticket80';
  const items = order.items.map((i) => `
    <tr><td colspan="2" class="it-name">${e(i.name)}</td></tr>
    <tr class="it-sub"><td>${i.qty} × ${e(money(i.unitPrice))}${i.color || i.size ? ` · ${e([i.color, i.size].filter(Boolean).join(' · '))}` : ''}</td><td class="num">${e(money(i.unitPrice * i.qty))}</td></tr>
    ${i.discount ? `<tr class="it-sub"><td>Descuento</td><td class="num">−${e(money(i.discount))}</td></tr>` : ''}`).join('');
  const pays = (order.payments || []).map((p) => `${row(e(methodLabel(p.method)), e(money(p.amount)))}${p.received != null && p.method === 'efectivo' ? row('Recibido', e(money(p.received))) + row('Cambio', e(money(p.change || 0))) : ''}`).join('');
  const body = `
    <div class="center">${logo}
      ${store.address ? `<p class="muted">${e(store.address)}</p>` : ''}
      ${settings?.public?.whatsapp ? `<p class="muted">WhatsApp ${e(fmtPhone(settings.public.whatsapp))}</p>` : ''}
    </div>
    <hr>
    <table><tbody>
      ${row(`<strong>${order.channel === 'tienda' ? 'Ticket' : 'Pedido'} ${e(order.number)}</strong>`, e(dateTime(order.paidAt || order.createdAt)))}
      ${order.createdByName ? row('Atendió', e(order.createdByName)) : ''}
      ${order.customer?.name ? row('Cliente', e(order.customer.name)) : ''}
    </tbody></table>
    <hr>
    <table class="items"><tbody>${items}</tbody></table>
    <hr>
    <table><tbody>
      ${row('Subtotal', e(money(order.subtotal)))}
      ${discountTotal(order) ? row('Descuentos', `−${e(money(discountTotal(order)))}`) : ''}
      ${order.shipping ? row('Envío', e(money(order.shipping))) : ''}
      ${row('<strong>Total</strong>', `<strong>${e(money(order.total))}</strong>`, 'total')}
      ${pays}
    </tbody></table>
    <hr>
    <p class="center foot">${e(pos.ticketFooter || '¡Gracias por tu compra!')}</p>
    <p class="center muted small">${e(order.itemsCount)} pieza${order.itemsCount === 1 ? '' : 's'} · ${e(store.name || 'Divani')}</p>`;
  const css = `
    hr{border:0;border-top:1px dashed #999;margin:6px 0}
    td{border:0;padding:2px 0}
    .items td{padding:1px 0}
    .it-name{font-weight:500;padding-top:5px}
    .it-sub td{color:#444;font-size:.92em}
    .total td{font-size:1.15em;padding:5px 0}
    .foot{margin:6px 0 2px}
    .small{font-size:.85em}
    .logo{height:46px}`;
  printDocument({ title: `Ticket ${order.number}`, body, css, page: width });
}

export function printOrderSlip(order, settings) {
  const items = order.items.map((i) => `
    <tr>
      <td><strong>${e(i.name)}</strong><br><span class="muted">${e([i.color, i.size && `Talla ${i.size}`].filter(Boolean).join(' · '))}</span><br><span class="muted mono">${e(i.sku)}</span></td>
      <td class="num">${i.qty}</td><td class="num">${e(money(i.unitPrice))}</td><td class="num">${e(money(i.total))}</td>
    </tr>`).join('');
  const c = order.customer || {};
  const body = `
    <header class="head">
      <div>${logo}</div>
      <div class="right"><h1>Pedido ${e(order.number)}</h1><p class="muted">${e(dateLong(order.createdAt))} · ${e(time(order.createdAt))}</p></div>
    </header>
    <section class="cols">
      <div><h3>Cliente</h3><p><strong>${e(c.name || '—')}</strong></p><p>${e(fmtPhone(c.phone))}</p><p>${e(c.city || '')}</p><p>${e(c.address || '')}</p></div>
      <div><h3>Entrega y pago</h3><p>${e(deliveryName(order.deliveryMethod, settings))}</p><p>${e(paymentName(order.paymentMethod, settings))}</p><p>Pago: ${e(order.paymentStatus)}</p></div>
    </section>
    <table><thead><tr><th>Prenda</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Importe</th></tr></thead><tbody>${items}</tbody></table>
    <table class="totals"><tbody>
      ${row('Subtotal', e(money(order.subtotal)))}
      ${discountTotal(order) ? row('Descuentos', `−${e(money(discountTotal(order)))}`) : ''}
      ${row('Envío', e(money(order.shipping || 0)))}
      ${row('<strong>Total</strong>', `<strong>${e(money(order.total))}</strong>`)}
    </tbody></table>
    ${order.notes ? `<p class="note"><strong>Notas de la clienta:</strong> ${e(order.notes)}</p>` : ''}`;
  const css = `
    .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
    .head .logo{margin:0;height:56px}
    .right{text-align:right} h1{font-family:"Bodoni Moda",serif;font-size:22px}
    .cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:12px 0 18px}
    h3{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#6b5f53;margin-bottom:4px}
    .totals{width:45%;margin:10px 0 0 auto}.totals td{border:0;padding:3px 6px}
    .note{margin-top:16px;padding:10px;border:1px solid #e5ddd0;border-radius:6px}`;
  printDocument({ title: `Pedido ${order.number}`, body, css, page: 'A4' });
}

export function printCashReport(view, settings, { partial = false } = {}) {
  const { session: s, summary, movements = [], orders = [] } = view;
  const store = settings?.public?.store || {};
  const methods = Object.entries(summary.byMethod || {}).map(([m, v]) => row(e(methodLabel(m)), e(money(v)))).join('');
  const mv = movements.map((m) => `<tr><td>${e(time(m.createdAt))}</td><td>${e(m.type)}</td><td>${e(m.reason || '')}</td><td class="num">${m.type === 'ingreso' ? '+' : '−'}${e(money(m.amount))}</td></tr>`).join('');
  const sales = orders.filter((o) => o.status !== 'cancelado').map((o) => `<tr><td>${e(time(o.paidAt || o.createdAt))}</td><td>${e(o.number)}</td><td>${e(methodLabel(o.paymentMethod))}</td><td class="num">${e(money(o.total))}</td></tr>`).join('');
  const den = s.breakdown ? Object.entries(s.breakdown).filter(([, n]) => Number(n) > 0).map(([d, n]) => `<tr><td>${e(money(Number(d), { cents: Number(d) % 1 !== 0 }))}</td><td class="num">${n}</td><td class="num">${e(money(Number(d) * n))}</td></tr>`).join('') : '';
  const expected = partial ? summary.expected : s.expectedCash;
  const body = `
    <div class="center">${logo}<h1>${partial ? 'Corte parcial (X)' : 'Corte de caja (Z)'}</h1>
    <p class="muted">${e(store.name || 'Divani')} · Caja #${e(s.number)}</p></div>
    <table class="kv"><tbody>
      ${row('Apertura', `${e(dateTime(s.openedAt))}${s.openedByName ? ` · ${e(s.openedByName)}` : ''}`)}
      ${s.closedAt ? row('Cierre', `${e(dateTime(s.closedAt))}${s.closedByName ? ` · ${e(s.closedByName)}` : ''}`) : row('Impreso', e(dateTime(new Date())))}
    </tbody></table>
    <h2>Efectivo</h2>
    <table class="kv"><tbody>
      ${row('Fondo inicial', e(money(s.openingAmount)))}
      ${row('Ventas en efectivo', `+${e(money(summary.cashSales))}`)}
      ${row('Ingresos', `+${e(money(summary.movements?.ingreso || 0))}`)}
      ${row('Retiros', `−${e(money(summary.movements?.retiro || 0))}`)}
      ${row('Gastos', `−${e(money(summary.movements?.gasto || 0))}`)}
      ${row('<strong>Efectivo esperado</strong>', `<strong>${e(money(expected))}</strong>`)}
      ${!partial && s.countedCash != null ? row('<strong>Efectivo contado</strong>', `<strong>${e(money(s.countedCash))}</strong>`) : ''}
      ${!partial && s.difference != null ? row('<strong>Diferencia</strong>', `<strong>${s.difference > 0 ? '+' : ''}${e(money(s.difference))} ${s.difference > 0 ? '(sobrante)' : s.difference < 0 ? '(faltante)' : ''}</strong>`) : ''}
    </tbody></table>
    <h2>Ventas</h2>
    <table class="kv"><tbody>
      ${row('Número de ventas', summary.salesCount)}
      ${row('Total vendido', e(money(summary.salesTotal)))}
      ${row('Piezas', summary.items)}
      ${summary.cancelled ? row('Canceladas', summary.cancelled) : ''}
      ${methods}
    </tbody></table>
    ${den ? `<h2>Arqueo</h2><table><thead><tr><th>Denominación</th><th class="num">Cantidad</th><th class="num">Importe</th></tr></thead><tbody>${den}</tbody></table>` : ''}
    ${mv ? `<h2>Movimientos de efectivo</h2><table><thead><tr><th>Hora</th><th>Tipo</th><th>Motivo</th><th class="num">Importe</th></tr></thead><tbody>${mv}</tbody></table>` : ''}
    ${sales ? `<h2>Detalle de ventas</h2><table><thead><tr><th>Hora</th><th>Folio</th><th>Pago</th><th class="num">Total</th></tr></thead><tbody>${sales}</tbody></table>` : ''}
    ${s.closeNotes ? `<p class="note"><strong>Notas:</strong> ${e(s.closeNotes)}</p>` : ''}
    <div class="sign"><span>Entregó</span><span>Recibió</span></div>`;
  const css = `
    h1{font-family:"Bodoni Moda",serif;font-size:20px;margin-top:4px}
    h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b5f53;margin:16px 0 4px}
    .kv td{border-bottom:1px solid #eee7dc}
    .note{margin-top:14px}
    .sign{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:46px;text-align:center}
    .sign span{border-top:1px solid #333;padding-top:4px;font-size:11px}
    .logo{height:50px}`;
  printDocument({ title: `Corte caja ${s.number}`, body, css, page: 'A4' });
}

export const movementTypeLabel = (t) => MOVEMENT_TYPES[t] || t;

/**
 * Reporte genérico en A4: encabezado con logo, periodo y filtros, indicadores y tablas.
 * sections: [{ title, columns: [{ label, num }], rows: [[...celdas]] , foot?: [...] }]
 */
export function printReport({ title, period, filters = [], kpis = [], sections = [] }, settings) {
  const store = settings?.public?.store || {};
  const kp = kpis.map((k) => `<div class="kpi"><span>${e(k.label)}</span><strong>${e(k.value)}</strong>${k.sub ? `<small>${e(k.sub)}</small>` : ''}</div>`).join('');
  const sec = sections.map((s) => `
    <h2>${e(s.title)}</h2>
    <table><thead><tr>${s.columns.map((c) => `<th class="${c.num ? 'num' : ''}">${e(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${s.rows.map((r) => `<tr>${r.map((v, i) => `<td class="${s.columns[i]?.num ? 'num' : ''}">${e(v)}</td>`).join('')}</tr>`).join('')}</tbody>
    ${s.foot ? `<tfoot><tr>${s.foot.map((v, i) => `<td class="${s.columns[i]?.num ? 'num' : ''}"><strong>${e(v)}</strong></td>`).join('')}</tr></tfoot>` : ''}
    </table>`).join('');
  const body = `
    <header class="head">
      <div>${logo}</div>
      <div class="right"><h1>${e(title)}</h1><p class="muted">${e(period)}</p>${filters.length ? `<p class="muted small">${e(filters.join(' · '))}</p>` : ''}</div>
    </header>
    ${kp ? `<section class="kpis">${kp}</section>` : ''}
    ${sec}
    <p class="muted small foot">${e(store.name || 'Divani')} · generado el ${e(dateTime(new Date()))}</p>`;
  const css = `
    .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #d9d0c3}
    .head .logo{margin:0;height:52px}.right{text-align:right}
    h1{font-family:"Bodoni Moda",serif;font-size:22px}
    h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b5f53;margin:18px 0 6px}
    .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:6px 0}
    .kpi{border:1px solid #e5ddd0;border-radius:8px;padding:8px 10px;display:flex;flex-direction:column}
    .kpi span{font-size:10px;color:#6b5f53}.kpi strong{font-size:16px}.kpi small{font-size:9.5px;color:#6b5f53}
    tfoot td{border-top:1px solid #d9d0c3;border-bottom:0}
    tr{page-break-inside:avoid}
    .small{font-size:10px}.foot{margin-top:18px}`;
  printDocument({ title, body, css, page: 'A4' });
}
