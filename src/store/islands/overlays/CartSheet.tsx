/**
 * Bolsa de compras y pedido por WhatsApp (en la misma hoja, en dos pasos).
 * Paso 1: prendas, cantidades y subtotal.
 * Paso 2: datos de entrega → se registra el pedido y se abre WhatsApp con el número oficial.
 */
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { money, plural } from '@/lib/format';
import { cdn } from '@/lib/model';
import type { PublicSettings } from '@/lib/types';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { cx } from '../../components/cx';
import { placeOrder, type CustomerData } from '../../data/orders';
import { refreshStorefront } from '../../data/storefront';
import { STORAGE_KEYS, load, save } from '../../lib/storage';
import { orderMessage, prepareWhatsAppWindow, waLink, type OrderDraft } from '../../lib/whatsapp';
import { cart, cartCount, cartSubtotal, useCart, type CartLine } from '../../state/cart';
import { notify } from '../../state/ui';

const EMPTY: CustomerData = { name: '', phone: '', city: '', address: '', delivery: '', payment: '' };
type Field = 'name' | 'city' | 'address';

export function CartSheet({
  open,
  onClose,
  settings,
}: {
  open: boolean;
  onClose: () => void;
  settings: PublicSettings;
}) {
  const items = useCart();
  const [step, setStep] = useState<'bag' | 'checkout'>('bag');
  const [customer, setCustomer] = useState<CustomerData>(EMPTY);
  const [notes, setNotes] = useState('');
  const [invalid, setInvalid] = useState<Set<Field>>(new Set());
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [received, setReceived] = useState<(OrderDraft & { url: string }) | null>(null);
  const form = useRef<HTMLFormElement>(null);

  const c = settings.checkout;
  const deliveryMethods = c.deliveryMethods?.length
    ? c.deliveryMethods
    : [{ id: 'envio', label: 'Envío a domicilio', requiresAddress: true }];
  const paymentMethods = c.paymentMethods?.length
    ? c.paymentMethods
    : [{ id: 'transferencia', label: 'Transferencia' }];
  const delivery = deliveryMethods.find((d) => d.id === customer.delivery) || deliveryMethods[0];
  const payment = paymentMethods.find((d) => d.id === customer.payment) || paymentMethods[0];
  const count = cartCount(items);
  const subtotal = cartSubtotal(items);
  const free = c.freeShippingFrom;

  // Cada vez que se abre: empieza en la bolsa con los datos que la clienta ya había escrito
  useEffect(() => {
    if (!open) return;
    setStep('bag');
    setReceived(null);
    setInvalid(new Set());
    setCustomer({ ...EMPTY, ...load<Partial<CustomerData>>(STORAGE_KEYS.customer, {}) });
  }, [open]);

  const update = (patch: Partial<CustomerData>) => {
    setCustomer((cur) => {
      const next = { ...cur, ...patch };
      save(STORAGE_KEYS.customer, next);
      return next;
    });
    setInvalid((s) => {
      const n = new Set(s);
      for (const k of Object.keys(patch)) n.delete(k as Field);
      return n;
    });
  };

  const removeLine = (key: string) => {
    setLeaving((s) => new Set(s).add(key));
    setTimeout(() => {
      cart.remove(key);
      setLeaving((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }, 260);
  };

  const draft = (orderNumber?: string): OrderDraft => ({
    ...(orderNumber ? { orderNumber } : {}),
    items: items.map((i) => ({ ...i })),
    subtotal,
    customer: {
      name: customer.name.trim(),
      phone: customer.phone.trim(),
      city: customer.city.trim(),
      address: delivery?.requiresAddress ? customer.address.trim() : '',
    },
    delivery: delivery ? { label: delivery.label } : null,
    payment: payment ? { label: payment.label } : null,
    notes: notes.trim(),
  });

  const validate = (): boolean => {
    const bad = new Set<Field>();
    if (!customer.name.trim()) bad.add('name');
    if (!customer.city.trim()) bad.add('city');
    if (delivery?.requiresAddress && !customer.address.trim()) bad.add('address');
    setInvalid(bad);
    const first = (['name', 'city', 'address'] as Field[]).find((f) => bad.has(f));
    if (first) form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    return !bad.size;
  };

  const send = async (e?: SyntheticEvent) => {
    e?.preventDefault();
    if (busy || !validate()) return;
    setBusy(true);
    // La ventana se abre en el mismo toque para que el navegador no la bloquee
    const win = prepareWhatsAppWindow();
    try {
      const order = draft();
      const res = await placeOrder({
        items,
        customer: { ...customer, ...order.customer, delivery: delivery?.id || '', payment: payment?.id || '' },
        notes: order.notes || '',
        subtotal,
      });
      const final = { ...order, orderNumber: res.number };
      const url = waLink(settings, orderMessage(settings, final));
      win.go(url);
      setReceived({ ...final, url });
      cart.clear();
      refreshStorefront();
    } catch (err) {
      win.close();
      notify({ title: 'No pudimos registrar tu pedido', sub: (err as Error).message, icon: 'info' });
    } finally {
      setBusy(false);
    }
  };

  const title = received ? (
    'Pedido recibido'
  ) : step === 'checkout' ? (
    'Tus datos'
  ) : (
    <>Tu bolsa{count ? <small>{plural(count, 'pieza', 'piezas')}</small> : null}</>
  );

  return (
    <Sheet id="cart" open={open} onClose={onClose} variant="side" labelledBy="cart-title" grabber>
      <header className="sheet__head">
        <button
          className="icon-btn"
          type="button"
          hidden={step !== 'checkout' || !!received}
          onClick={() => setStep('bag')}
          aria-label="Volver a la bolsa"
        >
          <Icon name="chevron-left" />
        </button>
        <h2 className="sheet__title" id="cart-title">
          {title}
        </h2>
        <button className="icon-btn glass round" type="button" onClick={onClose} aria-label="Cerrar bolsa">
          <Icon name="close" />
        </button>
      </header>
      <div className={cx('cart', step === 'checkout' && items.length > 0 && !received && 'is-checkout')}>
        {received ? (
          <div className="checkout">
            <div className="checkout__done">
              <span className="empty__icon">
                <Icon name="check" />
              </span>
              <h3>¡Recibimos tu pedido!</h3>
              <p className="checkout__number">{received.orderNumber}</p>
              <p>
                Termina de enviarlo por WhatsApp: ahí te confirmamos disponibilidad, envío y pago. Si la aplicación no
                se abrió, toca el botón.
              </p>
              <a className="btn btn--ink btn--wa btn--block" href={received.url} target="_blank" rel="noopener">
                <Icon name="whatsapp" />
                Enviar por WhatsApp
              </a>
              <div className="cluster">
                <button className="btn btn--outline btn--sm" type="button" onClick={onClose}>
                  Seguir comprando
                </button>
              </div>
            </div>
          </div>
        ) : !items.length ? (
          <div className="empty">
            <span className="empty__icon glass">
              <Icon name="bag" />
            </span>
            <h3>Tu bolsa está vacía</h3>
            <p>Explora la tienda y agrega tus prendas favoritas. Aquí te esperan.</p>
            <a className="btn btn--ink" href="/tienda">
              Explorar la tienda
            </a>
          </div>
        ) : (
          <div className="cart__steps">
            <section className="cart__step" aria-label="Prendas en tu bolsa" inert={step === 'checkout'}>
              <div className="cart__list">
                {items.map((i) => (
                  <Line key={i.key} line={i} leaving={leaving.has(i.key)} onRemove={() => removeLine(i.key)} />
                ))}
              </div>
              <footer className="cart__summary">
                {free ? (
                  <div className="cart__progress">
                    <span>
                      {subtotal >= free
                        ? '¡Tu pedido tiene envío gratis!'
                        : `Te faltan ${money(free - subtotal)} para envío gratis`}
                    </span>
                    <span className="cart__bar">
                      <span style={{ '--p': Math.min(1, subtotal / free) }} />
                    </span>
                  </div>
                ) : null}
                <div className="cart__row">
                  <span>Subtotal</span>
                  <strong className="cart__total">{money(subtotal)}</strong>
                </div>
                <p className="cart__note">{c.note || 'El costo de envío se confirma por WhatsApp.'}</p>
                <button
                  className="btn btn--ink btn--lg btn--block"
                  type="button"
                  onClick={() => {
                    setStep('checkout');
                    requestAnimationFrame(() =>
                      form.current?.querySelector<HTMLElement>('#co-name')?.focus({ preventScroll: true }),
                    );
                  }}
                >
                  Continuar con mi pedido
                  <Icon name="arrow-right" />
                </button>
              </footer>
            </section>

            <section className="cart__step" aria-label="Datos del pedido" inert={step === 'bag'}>
              <form className="checkout" ref={form} noValidate onSubmit={(e) => void send(e)}>
                <p className="checkout__intro">
                  Completa tus datos y envía tu pedido por WhatsApp. Te respondemos para confirmar disponibilidad, envío
                  y pago.
                </p>
                <div className="checkout__grid">
                  <div className={cx('field', invalid.has('name') && 'is-invalid')}>
                    <label className="field__label" htmlFor="co-name">
                      Nombre
                    </label>
                    <input
                      className="input"
                      id="co-name"
                      name="name"
                      autoComplete="name"
                      required
                      value={customer.name}
                      onChange={(e) => update({ name: e.currentTarget.value })}
                    />
                    <p className="field__error">Escribe tu nombre.</p>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="co-phone">
                      Teléfono <span className="opt">(opcional)</span>
                    </label>
                    <input
                      className="input"
                      id="co-phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={customer.phone}
                      onChange={(e) => update({ phone: e.currentTarget.value })}
                    />
                  </div>
                  <div className={cx('field field--full', invalid.has('city') && 'is-invalid')}>
                    <label className="field__label" htmlFor="co-city">
                      {settings.region.cityLabel}
                    </label>
                    <input
                      className="input"
                      id="co-city"
                      name="city"
                      autoComplete="address-level2"
                      placeholder={settings.region.cityPlaceholder}
                      required
                      value={customer.city}
                      onChange={(e) => update({ city: e.currentTarget.value })}
                    />
                    <p className="field__error">{`Indica tu ${settings.region.cityLabel.toLowerCase()}.`}</p>
                  </div>
                  <fieldset className="field field--full" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="field__label" style={{ marginBottom: '8px' }}>
                      Entrega
                    </legend>
                    <div className="choice-row">
                      {deliveryMethods.map((d) => (
                        <label key={d.id} className="choice">
                          <input
                            type="radio"
                            name="delivery"
                            value={d.id}
                            checked={delivery?.id === d.id}
                            onChange={() => update({ delivery: d.id })}
                          />
                          <span>{d.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div
                    className={cx('field field--full', invalid.has('address') && 'is-invalid')}
                    hidden={!delivery?.requiresAddress}
                  >
                    <label className="field__label" htmlFor="co-address">
                      Dirección de entrega
                    </label>
                    <textarea
                      className="input"
                      id="co-address"
                      name="address"
                      rows={2}
                      autoComplete="street-address"
                      placeholder="Calle, número, zona o colonia y código postal"
                      value={customer.address}
                      onChange={(e) => update({ address: e.currentTarget.value })}
                    />
                    <p className="field__error">Escribe la dirección para el envío.</p>
                  </div>
                  <fieldset className="field field--full" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="field__label" style={{ marginBottom: '8px' }}>
                      Forma de pago preferida
                    </legend>
                    <div className="choice-row">
                      {paymentMethods.map((d) => (
                        <label key={d.id} className="choice">
                          <input
                            type="radio"
                            name="payment"
                            value={d.id}
                            checked={payment?.id === d.id}
                            onChange={() => update({ payment: d.id })}
                          />
                          <span>{d.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="field field--full">
                    <label className="field__label" htmlFor="co-notes">
                      Notas <span className="opt">(opcional)</span>
                    </label>
                    <textarea
                      className="input"
                      id="co-notes"
                      name="notes"
                      rows={2}
                      placeholder="¿Alguna indicación especial?"
                      value={notes}
                      onChange={(e) => setNotes(e.currentTarget.value)}
                    />
                  </div>
                </div>
                <ul className="checkout__items list-reset">
                  {items.map((i) => (
                    <li key={i.key}>
                      <span>
                        {i.qty} × {i.name}
                        {i.size ? ` (${i.size})` : ''}
                      </span>
                      <span>{money(i.price * i.qty)}</span>
                    </li>
                  ))}
                </ul>
                <div className="cart__row">
                  <span>Total (sin envío)</span>
                  <strong className="cart__total">{money(subtotal)}</strong>
                </div>
              </form>
              <footer className="cart__summary">
                <button
                  className={cx('btn btn--ink btn--lg btn--block btn--wa', busy && 'is-loading')}
                  type="button"
                  aria-disabled={busy || undefined}
                  onClick={() => void send()}
                >
                  <Icon name="whatsapp" />
                  {busy ? 'Registrando tu pedido…' : 'Enviar pedido por WhatsApp'}
                </button>
                <p className="cart__note">Se abrirá WhatsApp con tu pedido escrito. Solo tienes que enviarlo.</p>
              </footer>
            </section>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Line({ line: i, leaving, onRemove }: { line: CartLine; leaving: boolean; onRemove: () => void }) {
  return (
    <article className={cx('line', leaving && 'is-leaving')}>
      <img src={cdn(i.image, { w: 200 })} alt="" width={78} height={98} loading="lazy" />
      <div className="line__body">
        <div className="line__top">
          <h3 className="line__name">{i.name}</h3>
          <button className="icon-btn icon-btn--sm" type="button" onClick={onRemove} aria-label={`Quitar ${i.name}`}>
            <Icon name="trash" />
          </button>
        </div>
        <p className="line__meta">{[i.color, i.size && `Talla ${i.size}`].filter(Boolean).join(' · ')}</p>
        <div className="line__bottom">
          <div className="stepper" aria-label="Cantidad">
            <button type="button" onClick={() => cart.setQty(i.key, i.qty - 1)} aria-label="Quitar uno">
              <Icon name="minus" />
            </button>
            <output>{i.qty}</output>
            <button
              type="button"
              onClick={() => cart.setQty(i.key, i.qty + 1)}
              aria-label="Agregar uno"
              disabled={i.qty >= (i.max ?? 99)}
            >
              <Icon name="plus" />
            </button>
          </div>
          <span className="line__price">{money(i.price * i.qty)}</span>
        </div>
      </div>
    </article>
  );
}
