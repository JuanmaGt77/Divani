/**
 * Detalle del pedido: avance por etapas (con efecto en inventario), prendas, importes,
 * pago, datos de la clienta con mensajes de WhatsApp listos, notas internas e historial.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  Printer, MessageCircle, ChevronDown, Ban, Undo2, Wallet, Pencil, Copy, MapPin, Phone, Store, Globe, Receipt, StickyNote,
  History, Check, Minus, Plus, Trash2, ShoppingBag, CircleAlert,
} from 'lucide-preact';
import { api } from '../api/index.js';
import { useQuery, invalidate } from '../lib/query.js';
import { navigate } from '../lib/router.js';
import { money, dateTime, relative, phone as fmtPhone } from '../lib/format.js';
import { useStore } from '../lib/store.js';
import { settingsStore } from '../lib/session.js';
import { nextStep, FLOW, paymentName, deliveryName, appliesStock, discountTotal } from '../lib/orders.js';
import { orderTemplates, waLink, ticketMessage } from '../lib/whatsapp.js';
import { printTicket, printOrderSlip } from '../lib/documents.js';
import { ORDER_STATUSES, statusInfo, paymentInfo, channelInfo, PAYMENT_METHODS, methodLabel } from '../../backend/model.js';
import { PageHeader, Card, Badge, StatusBadge, PaymentBadge, Thumb, Empty, SkeletonRows, Menu, KV, Banner } from '../ui/surfaces.jsx';
import { Button, MoneyField, SelectField, TextField, Stepper, IconButton, cx } from '../ui/controls.jsx';
import { Sheet, toast, toastError, confirmDialog, promptDialog } from '../ui/overlays.jsx';

export default function OrderDetail({ params }) {
  const settings = useStore(settingsStore);
  const { data: order, loading, error } = useQuery(`order:${params.id}`, () => api.orders.get(params.id), ['orders']);
  const [busy, setBusy] = useState(false);
  const [paySheet, setPaySheet] = useState(false);
  const [amounts, setAmounts] = useState(false);
  const [notes, setNotes] = useState(null);

  useEffect(() => { if (order && notes === null) setNotes(order.internalNotes || ''); }, [order]);

  if (error) return <main class="page"><Empty title="No se pudo cargar el pedido">{error.message}</Empty></main>;
  if (loading) return <main class="page"><div class="card"><SkeletonRows rows={6} /></div></main>;
  if (!order) return <main class="page"><Empty icon={ShoppingBag} title="No encontramos este pedido" action={<Button variant="primary" onClick={() => navigate('/pedidos')}>Ver pedidos</Button>} /></main>;

  const store = { ...(settings?.public?.store || {}), ticketFooter: settings?.private?.pos?.ticketFooter };
  const prefix = settings?.public?.region?.phonePrefix || '52';
  const isPos = order.channel === 'tienda';
  const next = nextStep(order);
  const closed = order.status === 'cancelado';
  const editable = !order.stockApplied && order.status === 'nuevo' && order.paymentStatus !== 'pagado';

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      invalidate('orders', 'products', 'inventory', 'cash');
      if (okMsg) toast(okMsg);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status) => {
    if (status === order.status) return;
    if (status === 'cancelado') {
      const reason = await promptDialog({
        title: isPos ? '¿Cancelar esta venta?' : '¿Cancelar este pedido?',
        message: `${order.stockApplied ? 'Las piezas regresan al inventario. ' : ''}${order.paymentStatus === 'pagado' ? 'El pago se marca como reembolsado. ' : ''}Escribe el motivo.`,
        placeholder: isPos ? 'Ej. Devolución de la clienta' : 'Ej. La clienta ya no lo quiso',
        confirm: 'Cancelar pedido',
        cancel: 'Volver',
        danger: true,
        required: true,
      });
      if (!reason) return;
      run(() => api.orders.setStatus(order.id, 'cancelado', { reason }), { title: isPos ? 'Venta cancelada' : 'Pedido cancelado', sub: order.stockApplied ? 'Las piezas regresaron al inventario.' : undefined });
      return;
    }
    const info = statusInfo(status);
    const stockMsg = appliesStock(status) && !order.stockApplied ? 'Las piezas se descuentan del inventario.' : !appliesStock(status) && order.stockApplied ? 'Las piezas regresan al inventario.' : undefined;
    run(() => api.orders.setStatus(order.id, status), { title: `Pedido ${info.label.toLowerCase()}`, sub: stockMsg });
  };

  const saveNotes = () => run(() => api.orders.update(order.id, { internalNotes: notes }), { title: 'Nota guardada' });
  const copy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); toast({ title: `${label} copiado` }); } catch { toast({ tone: 'info', title: label, sub: text }); }
  };

  const c = order.customer || {};
  const templates = orderTemplates(order, store);
  const statusItems = ORDER_STATUSES.filter((s) => s.id !== order.status).map((s) => ({ label: s.label, onClick: () => setStatus(s.id), danger: s.id === 'cancelado' }));

  return (
    <main class="page page--wide">
      <PageHeader
        back={{ to: '/pedidos', label: 'Pedidos' }}
        title={`${isPos ? 'Venta' : 'Pedido'} ${order.number}`}
        sub={<span class="row row--wrap" style={{ '--gap': '8px' }}><StatusBadge status={order.status} /><PaymentBadge status={order.paymentStatus} /><span class="muted small">{channelInfo(order.channel).label} · {dateTime(order.createdAt)}</span></span>}
        actions={(
          <>
            <Menu
              items={[
                { label: isPos ? 'Imprimir ticket' : 'Imprimir ticket', icon: Receipt, onClick: () => printTicket(order, settings) },
                !isPos && { label: 'Imprimir nota de pedido (A4)', icon: Printer, onClick: () => printOrderSlip(order, settings) },
              ]}
              trigger={({ toggle, open }) => <Button icon={Printer} iconEnd={ChevronDown} aria-expanded={String(open)} onClick={toggle}>Imprimir</Button>}
            />
            {!closed && next && <Button variant="primary" icon={next.icon} loading={busy} onClick={() => setStatus(next.status)}>{next.label}</Button>}
            <Menu items={[{ heading: 'Cambiar estado a…' }, ...statusItems]} />
          </>
        )}
      />

      {!isPos && !closed && <FlowBar order={order} />}
      {closed && (
        <Banner tone="danger" icon={Ban}>
          <strong>{isPos ? 'Venta cancelada' : 'Pedido cancelado'}</strong> {order.cancelledAt && `· ${relative(order.cancelledAt)}`}{order.cancelReason ? ` · «${order.cancelReason}»` : ''}
        </Banner>
      )}
      {next?.hint && order.status === 'nuevo' && (
        <p class="muted small flow-hint"><CircleAlert aria-hidden="true" /> Al confirmar, {order.itemsCount === 1 ? 'la pieza se aparta' : 'las piezas se apartan'} del inventario. Si después se cancela, regresan solas.</p>
      )}

      <div class="detail-grid">
        <div class="stack">
          <ItemsCard order={order} editable={editable} onSaved={() => invalidate('orders', 'products')} />

          <Card title="Importes" icon={Wallet} actions={!isPos && order.paymentStatus !== 'pagado' && !closed && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setAmounts(true)}>Editar</Button>}>
            <KV rows={[
              ['Subtotal', money(order.subtotal)],
              discountTotal(order) ? ['Descuentos', `−${money(discountTotal(order))}`] : null,
              !isPos ? ['Envío', order.shipping ? money(order.shipping) : <span class="muted">Por definir</span>] : null,
              ['Total', <strong>{money(order.total)}</strong>, 'total'],
            ]} />
            {(order.payments || []).length > 0 && (
              <div class="pay-lines">
                {order.payments.map((p) => (
                  <div class="pay-line"><span>{methodLabel(p.method)}</span><span class="num">{money(p.amount)}{p.method === 'efectivo' && p.received != null ? <small> · recibió {money(p.received)}, cambio {money(p.change || 0)}</small> : null}</span></div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Historial" icon={History}>
            <ol class="timeline">
              {[...(order.events || [])].reverse().map((ev) => (
                <li class="timeline__item">
                  <span class={cx('timeline__dot', ev.to && `tone-${ev.type === 'pago' ? paymentInfo(ev.to).tone : statusInfo(ev.to).tone}`)} />
                  <div>
                    <p class="timeline__title">{eventTitle(ev)}</p>
                    <p class="timeline__meta">{dateTime(ev.createdAt)}{ev.createdByName ? ` · ${ev.createdByName}` : ''}</p>
                    {ev.note && ev.type !== 'creado' && ev.type !== 'nota' && <p class="timeline__note">«{ev.note}»</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <aside class="stack">
          <Card title={isPos ? 'Cliente' : 'Clienta'} icon={isPos ? Store : Globe}>
            {c.name || c.phone ? (
              <div class="stack" style={{ '--gap': '10px' }}>
                <p class="strong" style={{ fontSize: '17px' }}>{c.name || 'Sin nombre'}</p>
                {c.phone && <p class="row small"><Phone aria-hidden="true" class="ico-sm" /><a href={`tel:${c.phone}`}>{fmtPhone(c.phone)}</a><IconButton size="sm" icon={Copy} label="Copiar teléfono" onClick={() => copy(c.phone, 'Teléfono')} /></p>}
                {(c.city || c.address) && (
                  <p class="row row--top small"><MapPin aria-hidden="true" class="ico-sm" /><span class="grow">{[c.address, c.city].filter(Boolean).join(', ')}</span><IconButton size="sm" icon={Copy} label="Copiar dirección" onClick={() => copy([c.name, c.address, c.city, c.phone].filter(Boolean).join('\n'), 'Dirección')} /></p>
                )}
                {c.phone ? (
                  <Menu
                    align="left"
                    items={[{ heading: 'Mensajes listos' }, ...(isPos ? [{ label: 'Enviar ticket', icon: Receipt, onClick: () => window.open(waLink(c.phone, ticketMessage(order, store), prefix), '_blank', 'noopener') }] : templates.map((t) => ({ label: t.label, onClick: () => window.open(waLink(c.phone, t.text, prefix), '_blank', 'noopener') }))), '-', { label: 'Abrir chat sin mensaje', icon: MessageCircle, onClick: () => window.open(waLink(c.phone, '', prefix), '_blank', 'noopener') }]}
                    trigger={({ toggle, open }) => <Button variant="wa" block icon={MessageCircle} iconEnd={ChevronDown} aria-expanded={String(open)} onClick={toggle}>Escribir por WhatsApp</Button>}
                  />
                ) : <p class="muted small">Sin teléfono registrado.</p>}
              </div>
            ) : <p class="muted small">{isPos ? 'Venta sin datos de cliente.' : 'Sin datos de la clienta.'}</p>}
          </Card>

          <Card title="Pago" icon={Wallet}>
            <div class="stack" style={{ '--gap': '12px' }}>
              <div class="row row--between"><PaymentBadge status={order.paymentStatus} /><span class="small muted">{order.paidAt ? dateTime(order.paidAt) : ''}</span></div>
              <KV rows={[
                ['Forma de pago', paymentName(order.paymentMethod, settings) || '—'],
                !isPos && ['Entrega', deliveryName(order.deliveryMethod, settings)],
              ]} />
              {!closed && order.paymentStatus !== 'pagado' && <Button variant="primary" block icon={Check} onClick={() => setPaySheet(true)}>Registrar pago</Button>}
              {!closed && order.paymentStatus === 'pagado' && !isPos && (
                <Button variant="ghost" block icon={Undo2} onClick={async () => {
                  if (await confirmDialog({ title: '¿Marcar como no pagado?', message: 'Úsalo si registraste el pago por error.', confirm: 'Marcar pendiente' })) run(() => api.orders.setPayment(order.id, { status: 'pendiente' }), { title: 'Pago marcado como pendiente' });
                }}>Deshacer pago</Button>
              )}
            </div>
          </Card>

          {(order.notes || !isPos) && (
            <Card title="Notas" icon={StickyNote}>
              <div class="stack" style={{ '--gap': '10px' }}>
                {order.notes && <div class="customer-note"><span class="xsmall muted">De la clienta</span><p>{order.notes}</p></div>}
                <TextField label="Nota interna" multiline rows={3} value={notes ?? ''} onValue={setNotes} placeholder="Solo la ve tu equipo (ej. pagó la mitad, enviar el martes…)" />
                {notes !== null && notes !== (order.internalNotes || '') && <Button size="sm" variant="primary" onClick={saveNotes} loading={busy}>Guardar nota</Button>}
              </div>
            </Card>
          )}

          {!closed && (
            <button type="button" class="danger-link" onClick={() => setStatus('cancelado')}><Ban aria-hidden="true" />{isPos ? 'Cancelar venta (devolución)' : 'Cancelar pedido'}</button>
          )}
        </aside>
      </div>

      <PaymentSheet open={paySheet} onClose={() => setPaySheet(false)} order={order} settings={settings} onDone={() => { setPaySheet(false); invalidate('orders', 'cash'); }} />
      <AmountsSheet open={amounts} onClose={() => setAmounts(false)} order={order} onDone={() => { setAmounts(false); invalidate('orders'); }} />
    </main>
  );
}

function eventTitle(ev) {
  if (ev.type === 'creado') return ev.note || 'Pedido creado';
  if (ev.type === 'estado') return `${statusInfo(ev.from).label} → ${statusInfo(ev.to).label}`;
  if (ev.type === 'pago') return `Pago: ${paymentInfo(ev.to).label.toLowerCase()}`;
  return ev.note || 'Actualización';
}

function FlowBar({ order }) {
  const idx = FLOW.indexOf(order.status);
  return (
    <ol class="flow" aria-label="Avance del pedido">
      {FLOW.map((s, i) => (
        <li class={cx('flow__step', i < idx && 'is-done', i === idx && 'is-current')} aria-current={i === idx ? 'step' : undefined}>
          <span class="flow__dot">{i < idx ? <Check aria-hidden="true" /> : i + 1}</span>
          <span class="flow__label">{statusInfo(s).label}</span>
        </li>
      ))}
    </ol>
  );
}

function ItemsCard({ order, editable, onSaved }) {
  const [qty, setQty] = useState(() => Object.fromEntries(order.items.map((i) => [i.id, i.qty])));
  const [saving, setSaving] = useState(false);
  useEffect(() => setQty(Object.fromEntries(order.items.map((i) => [i.id, i.qty]))), [order]);
  const changed = order.items.some((i) => qty[i.id] !== i.qty);
  const save = async () => {
    setSaving(true);
    try {
      await api.orders.update(order.id, { items: order.items.map((i) => ({ id: i.id, qty: qty[i.id] ?? i.qty })) });
      toast({ title: 'Prendas actualizadas' });
      onSaved();
    } catch (err) { toastError(err); } finally { setSaving(false); }
  };
  return (
    <Card title={`Prendas (${order.itemsCount})`} icon={ShoppingBag} bodyClass={false} foot={editable && changed ? (<><span class="muted small">Cambiaste cantidades</span><Button size="sm" variant="primary" loading={saving} onClick={save}>Guardar cambios</Button></>) : null}>
      <div class="list">
        {order.items.map((i) => (
          <div class={cx('list__row item-row', qty[i.id] === 0 && 'is-removed')} style={{ '--inset': '82px' }}>
            <Thumb src={i.image} size={48} />
            <span class="list__body">
              <span class="list__title">{i.productId ? <a href={`#/productos/${i.productId}`}>{i.name}</a> : i.name}</span>
              <span class="list__sub">{[i.color, i.size && `Talla ${i.size}`].filter(Boolean).join(' · ')}</span>
              <span class="list__sub mono">{i.sku}</span>
            </span>
            <span class="list__end item-row__end">
              {editable ? (
                <span class="row" style={{ '--gap': '4px' }}>
                  <Stepper size="sm" value={qty[i.id] ?? i.qty} min={0} max={99} onChange={(n) => setQty({ ...qty, [i.id]: n })} />
                </span>
              ) : <span class="muted small">{i.qty} × {money(i.unitPrice)}</span>}
              <span class="num strong">{money(i.unitPrice * (qty[i.id] ?? i.qty) - (i.discount || 0))}</span>
              {i.discount ? <span class="xsmall tone-down">−{money(i.discount)}</span> : null}
            </span>
          </div>
        ))}
      </div>
      {editable && <p class="field__hint" style={{ padding: '10px 20px 14px' }}>Mientras el pedido siga como «Nuevo» puedes cambiar cantidades o poner 0 para quitar una prenda.</p>}
    </Card>
  );
}

function PaymentSheet({ open, onClose, order, settings, onDone }) {
  const methods = useMemo(() => {
    const web = (settings?.public?.checkout?.paymentMethods || []).map((m) => ({ value: m.id, label: m.label }));
    const pos = PAYMENT_METHODS.filter((m) => !web.some((w) => w.value === m.id)).map((m) => ({ value: m.id, label: m.label }));
    return [...web, ...pos];
  }, [settings]);
  const [method, setMethod] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setMethod(order.paymentMethod || methods[0]?.value || 'transferencia'); }, [open]);
  const save = async () => {
    setBusy(true);
    try {
      await api.orders.setPayment(order.id, { status: 'pagado', method });
      toast({ title: 'Pago registrado', sub: `${money(order.total)} · ${paymentName(method, settings)}` });
      onDone();
    } catch (err) { toastError(err); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} size="sm" title="Registrar pago" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" icon={Check} loading={busy} onClick={save}>Marcar como pagado</Button></>}>
      <div class="stack">
        <div class="pay-total"><span>Total del pedido</span><strong>{money(order.total)}</strong></div>
        {!order.shipping && order.channel !== 'tienda' && <Banner icon={CircleAlert}>Este pedido no tiene costo de envío. Si cobras envío, agrégalo antes en «Importes».</Banner>}
        <SelectField label="¿Cómo pagó?" value={method} onValue={setMethod} options={methods} />
        {method === 'efectivo' && <p class="small muted">Si la caja está abierta, este efectivo se suma al corte de hoy.</p>}
      </div>
    </Sheet>
  );
}

function AmountsSheet({ open, onClose, order, onDone }) {
  const [shipping, setShipping] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setShipping(order.shipping || 0); setDiscount(order.discount || 0); } }, [open]);
  const lineDisc = order.items.reduce((a, i) => a + (i.discount || 0), 0);
  const total = Math.max(0, order.subtotal - lineDisc - (Number(discount) || 0)) + (Number(shipping) || 0);
  const save = async () => {
    setBusy(true);
    try {
      await api.orders.update(order.id, { shipping: Number(shipping) || 0, discount: Number(discount) || 0 });
      toast({ title: 'Importes actualizados', sub: `Nuevo total ${money(total)}` });
      onDone();
    } catch (err) { toastError(err); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} size="sm" title="Editar importes" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>Guardar</Button></>}>
      <div class="stack">
        <MoneyField label="Costo de envío" value={shipping} onValue={setShipping} hint="El que acordaste con la clienta por WhatsApp." />
        <MoneyField label="Descuento" value={discount} onValue={setDiscount} optional />
        <div class="pay-total"><span>Nuevo total</span><strong>{money(total)}</strong></div>
      </div>
    </Sheet>
  );
}
