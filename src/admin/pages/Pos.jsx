/**
 * Punto de venta: busca o escanea, arma el ticket, aplica descuentos y cobra en efectivo
 * (con cambio), tarjeta, transferencia o pago mixto. Descuenta inventario al instante,
 * se liga a la caja abierta e imprime o manda el ticket por WhatsApp.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  ScanBarcode, Trash2, Percent, UserRound, Wallet, CreditCard, ArrowRightLeft, Banknote, Check, Printer, MessageCircle, Plus,
  ShoppingBag, CircleAlert, X, ChevronUp, Shirt,
} from 'lucide-preact';
import { api } from '../api/index.js';
import { useQuery, invalidate } from '../lib/query.js';
import { navigate } from '../lib/router.js';
import { money, plural, number } from '../lib/format.js';
import { useIsMobile, useHotkey, matches } from '../lib/hooks.js';
import { variantIndex, findBySku } from '../lib/catalog.js';
import { useStore } from '../lib/store.js';
import { settingsStore } from '../lib/session.js';
import { waLink, ticketMessage } from '../lib/whatsapp.js';
import { printTicket } from '../lib/documents.js';
import { productStock, orderTotals, round2, sizeRank, methodLabel, cdn } from '../../backend/model.js';
import { PageHeader, Card, Badge, Thumb, Empty, SkeletonRows, Banner } from '../ui/surfaces.jsx';
import { Button, IconButton, Segmented, Field, MoneyInput, TextField, Stepper, Chip, cx } from '../ui/controls.jsx';
import { Sheet, toast, toastError, confirmDialog } from '../ui/overlays.jsx';
import { OpenCashSheet } from '../components/CashSheets.jsx';

const TICKET_KEY = 'divani.pos.ticket.v1';
const emptyTicket = () => ({ lines: [], discount: 0, customer: { name: '', phone: '' } });
const loadTicket = () => { try { return { ...emptyTicket(), ...JSON.parse(localStorage.getItem(TICKET_KEY) || 'null') }; } catch { return emptyTicket(); } };
const METHOD_ICONS = { efectivo: Banknote, tarjeta: CreditCard, transferencia: ArrowRightLeft };

export default function Pos() {
  const settings = useStore(settingsStore);
  const mobile = useIsMobile();
  const { data: products, loading } = useQuery('products', () => api.catalog.products(), ['products', 'inventory']);
  const { data: cash, loading: cashLoading } = useQuery('cash:current', () => api.cash.current(), ['cash', 'orders']);
  const { data: tax } = useQuery('taxonomy', () => api.catalog.taxonomy(), ['taxonomy']);
  const [ticket, setTicket] = useState(loadTicket);
  const [q, setQ] = useState('');
  const [dep, setDep] = useState('');
  const [picking, setPicking] = useState(null);
  const [lineEdit, setLineEdit] = useState(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [openCash, setOpenCash] = useState(false);
  const search = useRef(null);

  useEffect(() => { try { localStorage.setItem(TICKET_KEY, JSON.stringify(ticket)); } catch { /* sin almacenamiento */ } }, [ticket]);
  useHotkey('/', () => search.current?.focus());
  useEffect(() => { if (!mobile) search.current?.focus(); }, []);

  const index = useMemo(() => variantIndex(products || []), [products]);
  const sellable = useMemo(() => (products || []).filter((p) => p.status !== 'archivado'), [products]);
  const shown = useMemo(() => sellable.filter((p) => (!dep || p.department === dep)
    && matches(q, p.name, p.code, p.tags, p.colors.map((c) => c.name), p.variants.map((v) => v.sku)))
    .sort((a, b) => (productStock(b) > 0) - (productStock(a) > 0) || a.name.localeCompare(b.name, 'es')), [sellable, q, dep]);

  const inTicket = (variantId) => ticket.lines.find((l) => l.variantId === variantId)?.qty || 0;

  const addVariant = (x, qty = 1) => {
    const have = inTicket(x.variant.id);
    if (have + qty > x.variant.stock) {
      toast({ tone: 'error', title: 'Sin existencias suficientes', sub: `${x.product.name} · ${x.label}: quedan ${x.variant.stock}` });
      return;
    }
    setTicket((t) => {
      const lines = t.lines.some((l) => l.variantId === x.variant.id)
        ? t.lines.map((l) => (l.variantId === x.variant.id ? { ...l, qty: l.qty + qty } : l))
        : [...t.lines, {
          variantId: x.variant.id, productId: x.product.id, name: x.product.name, color: x.color?.name || '', size: x.variant.size,
          sku: x.variant.sku, image: x.image, unitPrice: x.product.price, qty, discount: 0, stock: x.variant.stock,
        }];
      return { ...t, lines };
    });
    if (navigator.vibrate) navigator.vibrate(12);
  };

  const pickProduct = (p) => {
    const vs = p.variants.filter((v) => v.active !== false);
    const available = vs.filter((v) => v.stock > 0);
    if (!available.length) { toast({ tone: 'error', title: 'Producto agotado', sub: p.name }); return; }
    if (vs.length === 1) { addVariant(index.find((x) => x.variant.id === vs[0].id)); return; }
    setPicking(p);
  };

  const onSearchKey = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const hit = findBySku(index, q);
    if (hit) { addVariant(hit); setQ(''); return; }
    if (shown.length === 1) { pickProduct(shown[0]); setQ(''); return; }
    if (q) toast({ tone: 'info', title: 'Elige la prenda en la lista', sub: `${shown.length} coinciden con «${q}»` });
  };

  const setLine = (variantId, patch) => setTicket((t) => ({ ...t, lines: t.lines.map((l) => (l.variantId === variantId ? { ...l, ...patch } : l)).filter((l) => l.qty > 0) }));
  const clear = async () => {
    if (ticket.lines.length && !(await confirmDialog({ title: '¿Vaciar el ticket?', message: 'Se quitan todas las prendas del ticket actual.', confirm: 'Vaciar', danger: true }))) return;
    setTicket(emptyTicket());
  };

  const totals = orderTotals({ items: ticket.lines.map((l) => ({ ...l, discount: Math.min(l.discount, l.unitPrice * l.qty) })), discount: ticket.discount });
  const cashOpen = !!cash?.session;
  const deps = tax?.departments || [];
  const pieces = ticket.lines.reduce((a, l) => a + l.qty, 0);

  const ticketPanel = (
    <TicketPanel
      ticket={ticket}
      totals={totals}
      onQty={(l, n) => setLine(l.variantId, { qty: n })}
      onRemove={(l) => setLine(l.variantId, { qty: 0 })}
      onLine={(l) => setLineEdit(l)}
      onDiscount={() => setDiscountOpen(true)}
      onCustomer={(c) => setTicket((t) => ({ ...t, customer: { ...t.customer, ...c } }))}
      onClear={clear}
      onCharge={() => { setTicketOpen(false); setCheckout(true); }}
      disabled={!cashOpen}
    />
  );

  return (
    <main class="page page--wide pos">
      <PageHeader
        title="Punto de venta"
        sub={cashOpen ? `Caja #${cash.session.number} abierta · ${plural(cash.summary.salesCount, 'venta', 'ventas')} hoy por ${money(cash.summary.salesTotal)}` : 'Registra ventas de mostrador; el inventario se descuenta solo.'}
        actions={cashOpen && <Button icon={Wallet} onClick={() => navigate('/caja')}>Ver caja</Button>}
      />
      {!cashLoading && !cashOpen && (
        <Banner icon={CircleAlert} action={<Button size="sm" variant="primary" icon={Wallet} onClick={() => setOpenCash(true)}>Abrir caja</Button>}>
          <strong>La caja está cerrada.</strong> Ábrela con tu fondo inicial para empezar a cobrar.
        </Banner>
      )}

      <div class="pos__grid">
        <section class="pos__catalog">
          <div class="scan-box pos__search">
            <ScanBarcode aria-hidden="true" />
            <input ref={search} class="input" value={q} onInput={(e) => setQ(e.currentTarget.value)} onKeyDown={onSearchKey} placeholder={mobile ? "Escanea o busca una prenda" : "Escanea el código o busca por nombre, color o SKU"} aria-label="Buscar o escanear" enterKeyHint="search" />
            {q && <IconButton class="pos__clear" size="sm" icon={X} label="Borrar" onClick={() => setQ('')} />}
          </div>
          <div class="chips pos__chips">
            <Chip pressed={!dep} onClick={() => setDep('')}>Todo</Chip>
            {deps.map((d) => <Chip pressed={dep === d.slug} onClick={() => setDep(d.slug)}>{d.name}</Chip>)}
          </div>
          {loading ? <Card bodyClass={false}><SkeletonRows rows={6} /></Card> : !shown.length ? (
            <Card><Empty icon={Shirt} title="Sin resultados">Prueba con otra palabra o escanea el código de la etiqueta.</Empty></Card>
          ) : (
            <div class="pos__products">
              {shown.map((p) => {
                const stock = productStock(p);
                return (
                  <button type="button" class={cx('pos-tile', !stock && 'is-out')} onClick={() => pickProduct(p)} disabled={!stock}>
                    <span class="pos-tile__media">
                      {p.colors[0]?.images?.[0] ? <img src={cdn(p.colors[0].images[0], { w: 360 })} alt="" loading="lazy" /> : <Shirt aria-hidden="true" />}
                      <span class={cx('pos-tile__stock', stock <= 2 && 'is-low')}>{stock ? `${stock} disp.` : 'Agotado'}</span>
                    </span>
                    <span class="pos-tile__name">{p.name}</span>
                    <span class="pos-tile__price">{money(p.price)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {!mobile && <aside class="pos__ticket">{ticketPanel}</aside>}
      </div>

      {mobile && (
        <button type="button" class={cx('pos-bar glass', pieces > 0 && 'has-items')} onClick={() => setTicketOpen(true)}>
          <span class="pos-bar__count"><ShoppingBag aria-hidden="true" />{pieces}</span>
          <span class="grow">{pieces ? 'Ver ticket' : 'Ticket vacío'}</span>
          <strong>{money(totals.total)}</strong>
          <ChevronUp aria-hidden="true" />
        </button>
      )}
      {mobile && <Sheet open={ticketOpen} onClose={() => setTicketOpen(false)} title="Ticket" size="lg">{ticketPanel}</Sheet>}

      <VariantPicker product={picking} index={index} inTicket={inTicket} onClose={() => setPicking(null)} onAdd={(x, n) => { addVariant(x, n); setPicking(null); }} />
      <LineSheet line={lineEdit} onClose={() => setLineEdit(null)} onSave={(patch) => { setLine(lineEdit.variantId, patch); setLineEdit(null); }} />
      <DiscountSheet open={discountOpen} subtotal={totals.subtotal - totals.lineDiscount} value={ticket.discount} onClose={() => setDiscountOpen(false)} onSave={(d) => { setTicket((t) => ({ ...t, discount: d })); setDiscountOpen(false); }} />
      <CheckoutSheet
        open={checkout}
        ticket={ticket}
        totals={totals}
        settings={settings}
        onClose={() => setCheckout(false)}
        onDone={() => { setTicket(emptyTicket()); invalidate('products', 'inventory', 'orders', 'cash'); }}
      />
      <OpenCashSheet open={openCash} onClose={() => setOpenCash(false)} />
    </main>
  );
}

function TicketPanel({ ticket, totals, onQty, onRemove, onLine, onDiscount, onCustomer, onClear, onCharge, disabled }) {
  const [showCustomer, setShowCustomer] = useState(!!(ticket.customer?.name || ticket.customer?.phone));
  return (
    <div class="ticket">
      <div class="ticket__head">
        <h2>Ticket</h2>
        <span class="muted small">{plural(totals.itemsCount, 'pieza', 'piezas')}</span>
        <span class="grow" />
        {ticket.lines.length > 0 && <IconButton size="sm" icon={Trash2} label="Vaciar ticket" onClick={onClear} />}
      </div>
      {!ticket.lines.length ? (
        <div class="ticket__empty">
          <ScanBarcode aria-hidden="true" />
          <p>Escanea una etiqueta o toca una prenda para agregarla.</p>
        </div>
      ) : (
        <ul class="ticket__lines">
          {ticket.lines.map((l) => (
            <li class="tline">
              <Thumb src={l.image} size={44} />
              <div class="tline__body">
                <p class="tline__name">{l.name}</p>
                <p class="tline__meta">{[l.color, l.size].filter(Boolean).join(' · ')}</p>
                <Stepper size="sm" value={l.qty} min={0} max={l.stock} onChange={(n) => onQty(l, n)} />
              </div>
              <div class="tline__end">
                <button type="button" class="tline__price" onClick={() => onLine(l)} title="Descuento a esta prenda">
                  {money(l.unitPrice * l.qty - l.discount)}
                  {l.discount > 0 && <s>{money(l.unitPrice * l.qty)}</s>}
                </button>
                <IconButton size="sm" icon={X} label={`Quitar ${l.name}`} onClick={() => onRemove(l)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div class="ticket__tools">
        <Chip size="sm" icon={Percent} pressed={ticket.discount > 0} onClick={onDiscount}>{ticket.discount > 0 ? `Descuento ${money(ticket.discount)}` : 'Descuento'}</Chip>
        <Chip size="sm" icon={UserRound} pressed={showCustomer} onClick={() => setShowCustomer(!showCustomer)}>Cliente</Chip>
      </div>
      {showCustomer && (
        <div class="grid ticket__customer" style={{ '--cols': 2, '--cols-m': 2, '--gap': '8px' }}>
          <input class="input input--sm" value={ticket.customer.name} onInput={(e) => onCustomer({ name: e.currentTarget.value })} placeholder="Nombre (opcional)" aria-label="Nombre del cliente" />
          <input class="input input--sm" type="tel" inputMode="tel" value={ticket.customer.phone} onInput={(e) => onCustomer({ phone: e.currentTarget.value })} placeholder="WhatsApp (opcional)" aria-label="Teléfono del cliente" />
        </div>
      )}

      <dl class="ticket__totals">
        <div><dt>Subtotal</dt><dd>{money(totals.subtotal)}</dd></div>
        {totals.discountTotal > 0 && <div><dt>Descuentos</dt><dd class="tone-down">−{money(totals.discountTotal)}</dd></div>}
        <div class="ticket__total"><dt>Total</dt><dd>{money(totals.total)}</dd></div>
      </dl>
      <Button variant="primary" size="xl" block disabled={!ticket.lines.length || disabled} onClick={onCharge}>
        {disabled ? 'Abre la caja para cobrar' : `Cobrar ${money(totals.total)}`}
      </Button>
    </div>
  );
}

function VariantPicker({ product, index, inTicket, onClose, onAdd }) {
  const [colorId, setColorId] = useState(null);
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  useEffect(() => {
    if (!product) return;
    const firstColor = product.colors.find((c) => product.variants.some((v) => v.colorId === c.id && v.stock > 0)) || product.colors[0];
    setColorId(firstColor?.id);
    setVariantId(null);
    setQty(1);
  }, [product?.id]);
  if (!product) return <Sheet open={false} onClose={onClose} title="" />;
  const color = product.colors.find((c) => c.id === colorId);
  const variants = product.variants.filter((v) => v.colorId === colorId && v.active !== false).sort((a, b) => sizeRank(a.size) - sizeRank(b.size));
  const chosen = variants.find((v) => v.id === variantId);
  const left = chosen ? chosen.stock - inTicket(chosen.id) : 0;
  return (
    <Sheet
      open={!!product}
      onClose={onClose}
      title={product.name}
      sub={money(product.price)}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" icon={Plus} disabled={!chosen || left < qty} onClick={() => onAdd(index.find((x) => x.variant.id === chosen.id), qty)}>Agregar al ticket</Button></>}
    >
      <div class="picker">
        <div class="picker__media">{color?.images?.[0] ? <img src={cdn(color.images[0], { w: 500 })} alt="" /> : <Shirt aria-hidden="true" />}</div>
        <div class="stack">
          <Field label={`Color: ${color?.name || ''}`}>
            <div class="chips">
              {product.colors.map((c) => {
                const any = product.variants.some((v) => v.colorId === c.id && v.stock > 0);
                return <Chip pressed={c.id === colorId} onClick={() => { setColorId(c.id); setVariantId(null); }}><span class="swatch" style={{ '--c': c.hex, '--s': '14px', opacity: any ? 1 : 0.4 }} />{c.name}</Chip>;
              })}
            </div>
          </Field>
          <Field label="Talla">
            <div class="size-grid">
              {variants.map((v) => {
                const avail = v.stock - inTicket(v.id);
                return (
                  <button type="button" class="size-opt" aria-pressed={String(v.id === variantId)} disabled={avail <= 0} onClick={() => { setVariantId(v.id); setQty(1); }}>
                    <strong>{v.size}</strong>
                    <small>{avail > 0 ? `${avail} disp.` : v.stock > 0 ? 'En ticket' : 'Agotada'}</small>
                  </button>
                );
              })}
            </div>
          </Field>
          {chosen && left > 1 && <Field label="Cantidad"><Stepper value={qty} min={1} max={left} onChange={setQty} /></Field>}
        </div>
      </div>
    </Sheet>
  );
}

function LineSheet({ line, onClose, onSave }) {
  const [mode, setMode] = useState('pct');
  const [value, setValue] = useState('');
  useEffect(() => { if (line) { setMode('pct'); setValue(line.discount ? round2((line.discount / (line.unitPrice * line.qty)) * 100) : ''); } }, [line?.variantId]);
  if (!line) return <Sheet open={false} onClose={onClose} title="" />;
  const gross = line.unitPrice * line.qty;
  const disc = round2(Math.min(gross, mode === 'pct' ? gross * (Number(value) || 0) / 100 : Number(value) || 0));
  return (
    <Sheet open={!!line} onClose={onClose} size="sm" title="Descuento a la prenda" sub={`${line.name} · ${[line.color, line.size].filter(Boolean).join(' · ')}`}
      footer={<><Button variant="ghost" onClick={() => onSave({ discount: 0 })}>Quitar descuento</Button><Button variant="primary" onClick={() => onSave({ discount: disc })}>Aplicar</Button></>}>
      <DiscountBody mode={mode} setMode={setMode} value={value} setValue={setValue} base={gross} disc={disc} />
    </Sheet>
  );
}

function DiscountSheet({ open, subtotal, value: current, onClose, onSave }) {
  const [mode, setMode] = useState('pct');
  const [value, setValue] = useState('');
  useEffect(() => { if (open) { setMode(current ? 'amount' : 'pct'); setValue(current || ''); } }, [open]);
  const disc = round2(Math.min(subtotal, mode === 'pct' ? subtotal * (Number(value) || 0) / 100 : Number(value) || 0));
  return (
    <Sheet open={open} onClose={onClose} size="sm" title="Descuento al ticket"
      footer={<><Button variant="ghost" onClick={() => onSave(0)}>Quitar descuento</Button><Button variant="primary" onClick={() => onSave(disc)}>Aplicar</Button></>}>
      <DiscountBody mode={mode} setMode={setMode} value={value} setValue={setValue} base={subtotal} disc={disc} />
    </Sheet>
  );
}

function DiscountBody({ mode, setMode, value, setValue, base, disc }) {
  return (
    <div class="stack">
      <Segmented block value={mode} onChange={(m) => { setMode(m); setValue(''); }} options={[{ value: 'pct', label: 'Porcentaje' }, { value: 'amount', label: 'Cantidad' }]} />
      {mode === 'pct' ? (
        <>
          <div class="affix affix--post"><input class="input input--big" inputMode="decimal" value={value} onInput={(e) => setValue(e.currentTarget.value.replace(/[^\d.]/g, ''))} placeholder="0" data-autofocus /><span class="affix__post">%</span></div>
          <div class="chips">{[5, 10, 15, 20, 30, 50].map((p) => <Chip size="sm" pressed={Number(value) === p} onClick={() => setValue(String(p))}>{p} %</Chip>)}</div>
        </>
      ) : <MoneyInput big value={value} onValue={setValue} data-autofocus />}
      <div class="pay-total"><span>Descuento</span><strong>−{money(disc)}</strong></div>
      <p class="muted small">Queda en {money(round2(base - disc))}</p>
    </div>
  );
}

function roundUps(total) {
  const out = new Set();
  for (const step of [50, 100, 200, 500, 1000]) {
    const v = Math.ceil(total / step) * step;
    if (v > total) out.add(v);
  }
  return [...out].sort((a, b) => a - b).slice(0, 4);
}

function CheckoutSheet({ open, ticket, totals, settings, onClose, onDone }) {
  const methods = settings?.private?.pos?.paymentMethods || ['efectivo', 'tarjeta', 'transferencia'];
  const [method, setMethod] = useState('efectivo');
  const [received, setReceived] = useState('');
  const [split, setSplit] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  useEffect(() => { if (open) { setMethod(methods[0] || 'efectivo'); setReceived(''); setSplit({}); setDone(null); } }, [open]);

  const total = totals.total;
  const recv = received === '' ? total : Number(received) || 0;
  const change = round2(recv - total);
  const splitSum = round2(Object.values(split).reduce((a, v) => a + (Number(v) || 0), 0));
  const remaining = round2(total - splitSum);
  const valid = method === 'mixto' ? Math.abs(remaining) < 0.01 && splitSum > 0 : method === 'efectivo' ? recv + 0.001 >= total : true;

  const payments = () => {
    if (method === 'mixto') {
      return Object.entries(split).filter(([, v]) => Number(v) > 0).map(([m, v]) => ({ method: m, amount: round2(Number(v)), ...(m === 'efectivo' ? { received: round2(Number(v)) } : {}) }));
    }
    if (method === 'efectivo') return [{ method, amount: total, received: recv }];
    return [{ method, amount: total }];
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const order = await api.pos.checkout({
        items: ticket.lines.map((l) => ({ variantId: l.variantId, qty: l.qty, discount: Math.min(l.discount, l.unitPrice * l.qty) })),
        discount: ticket.discount,
        customer: ticket.customer,
        payments: payments(),
      });
      setDone(order);
      onDone();
    } catch (err) {
      toastError(err, 'No se pudo registrar la venta');
    } finally {
      setBusy(false);
    }
  };

  const store = { ...(settings?.public?.store || {}), ticketFooter: settings?.private?.pos?.ticketFooter };
  const prefix = settings?.public?.region?.phonePrefix || '52';
  const cashChange = done?.payments?.find((p) => p.method === 'efectivo')?.change || 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={done ? 'Venta registrada' : 'Cobrar'}
      footer={done ? (
        <>
          <Button icon={Printer} onClick={() => printTicket(done, settings)}>Imprimir ticket</Button>
          {done.customer?.phone && <Button variant="wa" icon={MessageCircle} onClick={() => window.open(waLink(done.customer.phone, ticketMessage(done, store), prefix), '_blank', 'noopener')}>WhatsApp</Button>}
          <Button variant="primary" onClick={onClose}>Nueva venta</Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={onClose}>Volver</Button>
          <Button variant="primary" size="lg" icon={Check} loading={busy} disabled={!valid} onClick={confirm}>Confirmar venta</Button>
        </>
      )}
    >
      {done ? (
        <div class="sale-done">
          <span class="sale-done__check"><Check aria-hidden="true" /></span>
          <p class="sale-done__num">{done.number}</p>
          <p class="sale-done__total">{money(done.total)}</p>
          <p class="muted">{(done.payments || []).map((p) => `${methodLabel(p.method)} ${money(p.amount)}`).join(' · ')}</p>
          {cashChange > 0 && <div class="sale-done__change"><span>Cambio</span><strong>{money(cashChange)}</strong></div>}
          <p class="muted small">El inventario ya se actualizó.</p>
        </div>
      ) : (
        <div class="stack">
          <div class="charge-total"><span>Total a cobrar</span><strong>{money(total)}</strong><small>{plural(totals.itemsCount, 'pieza', 'piezas')}{totals.discountTotal ? ` · ahorro ${money(totals.discountTotal)}` : ''}</small></div>
          <Segmented block size="lg" value={method} onChange={(m) => { setMethod(m); setReceived(''); setSplit({}); }} label="Forma de pago"
            options={[...methods.map((m) => ({ value: m, label: methodLabel(m), icon: METHOD_ICONS[m] })), ...(methods.length > 1 ? [{ value: 'mixto', label: 'Mixto' }] : [])]} />
          {method === 'efectivo' && (
            <>
              <Field label="Recibí"><MoneyInput big value={received} onValue={setReceived} placeholder={String(total)} data-autofocus /></Field>
              <div class="chips">
                <Chip size="sm" pressed={received === '' || Number(received) === total} onClick={() => setReceived(total)}>Exacto</Chip>
                {roundUps(total).map((v) => <Chip size="sm" pressed={Number(received) === v} onClick={() => setReceived(v)}>{money(v)}</Chip>)}
              </div>
              <div class={cx('change-box', change < 0 && 'is-short')}>
                <span>{change < 0 ? 'Falta' : 'Cambio'}</span>
                <strong>{money(Math.abs(change))}</strong>
              </div>
            </>
          )}
          {method === 'mixto' && (
            <div class="stack" style={{ '--gap': '10px' }}>
              {methods.map((m) => (
                <div class="split-row">
                  <span class="split-row__label">{(() => { const I = METHOD_ICONS[m] || Wallet; return <I aria-hidden="true" />; })()}{methodLabel(m)}</span>
                  <MoneyInput value={split[m] ?? ''} onValue={(v) => setSplit({ ...split, [m]: v })} />
                  <Button size="sm" variant="ghost" onClick={() => setSplit({ ...split, [m]: round2((Number(split[m]) || 0) + Math.max(0, remaining)) })} disabled={remaining <= 0}>Resto</Button>
                </div>
              ))}
              <div class={cx('change-box', Math.abs(remaining) >= 0.01 && 'is-short')}>
                <span>{remaining > 0 ? 'Falta asignar' : remaining < 0 ? 'Sobra' : 'Completo'}</span>
                <strong>{money(Math.abs(remaining))}</strong>
              </div>
            </div>
          )}
          {(method === 'tarjeta' || method === 'transferencia') && (
            <p class="muted small">{method === 'tarjeta' ? 'Cobra en tu terminal y confirma cuando el pago salga aprobado.' : 'Confirma cuando veas la transferencia en tu banco.'}</p>
          )}
        </div>
      )}
    </Sheet>
  );
}
