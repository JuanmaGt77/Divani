/**
 * Bolsa de compras y pedido por WhatsApp (en la misma hoja, en dos pasos).
 * Paso 1: prendas, cantidades y subtotal.
 * Paso 2: datos de entrega → botón que abre WhatsApp con el pedido completo.
 */
import { html, raw, render, toString } from '../core/dom.js';
import { money, plural } from '../core/format.js';
import { load, save } from '../core/storage.js';
import { STORAGE_KEYS } from '../config/site.config.js';
import { usingMockData } from '../services/api/index.js';
import { ContentService } from '../services/content.service.js';
import { OrderService } from '../services/order.service.js';
import { openWhatsApp } from '../services/whatsapp.service.js';
import { cart } from '../store/cart.store.js';
import { sheet } from './sheet.js';
import { notify } from './island.js';

let root, title, backBtn;
let settings = { checkout: { deliveryMethods: [], paymentMethods: [] } };
let step = 'bag';
let reference = '';
let sent = false;

export function openCart() {
  step = 'bag';
  sent = false;
  paint();
  sheet('cart')?.open();
}

const fallbackDelivery = [{ id: 'envio', label: 'Envío a domicilio', requiresAddress: true }];
const fallbackPayment = [{ id: 'transferencia', label: 'Transferencia' }];

function paint() {
  if (!root) return;
  const items = cart.items;
  title.innerHTML = step === 'checkout' ? 'Tus datos' : `Tu bolsa${cart.count ? ` <small>${plural(cart.count, 'pieza', 'piezas')}</small>` : ''}`;
  backBtn.hidden = step !== 'checkout';
  root.classList.toggle('is-checkout', step === 'checkout' && items.length > 0);

  if (!items.length) {
    render(root, html`
      <div class="empty">
        <span class="empty__icon glass"><svg class="icon" aria-hidden="true"><use href="#i-bag"></use></svg></span>
        <h3>Tu bolsa está vacía</h3>
        <p>Explora la tienda y agrega tus prendas favoritas. Aquí te esperan.</p>
        <a class="btn btn--ink" href="tienda.html">Explorar la tienda</a>
      </div>`);
    return;
  }

  const c = settings.checkout || {};
  const free = c.freeShippingFrom;
  const subtotal = cart.subtotal;

  render(root, html`
    <div class="cart__steps">
      <section class="cart__step" aria-label="Prendas en tu bolsa" ${step === 'checkout' ? raw('inert') : ''}>
        <div class="cart__list">${items.map(lineTpl)}</div>
        <footer class="cart__summary">
          ${free ? html`
          <div class="cart__progress">
            <span>${subtotal >= free ? '¡Tu pedido tiene envío gratis!' : `Te faltan ${money(free - subtotal)} para envío gratis`}</span>
            <span class="cart__bar"><span style="${`--p:${Math.min(1, subtotal / free)}`}"></span></span>
          </div>` : ''}
          <div class="cart__row"><span>Subtotal</span><strong class="cart__total">${money(subtotal)}</strong></div>
          <p class="cart__note">${c.note || 'El costo de envío se confirma por WhatsApp.'}</p>
          <button class="btn btn--ink btn--lg btn--block" type="button" data-cart-next>
            Continuar con mi pedido
            <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"></use></svg>
          </button>
        </footer>
      </section>

      <section class="cart__step" aria-label="Datos del pedido" ${step === 'bag' ? raw('inert') : ''}>
        ${sent ? doneTpl() : checkoutTpl(subtotal)}
      </section>
    </div>`);

  if (step === 'checkout' && !sent) {
    prefill();
    syncLink();
  }
}

function lineTpl(i) {
  return html`
  <article class="line" data-line="${i.key}">
    <img src="${i.image}" alt="" width="78" height="98" loading="lazy" />
    <div class="line__body">
      <div class="line__top">
        <h3 class="line__name">${i.name}</h3>
        <button class="icon-btn icon-btn--sm" type="button" data-line-remove="${i.key}" aria-label="${`Quitar ${i.name}`}">
          <svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg>
        </button>
      </div>
      <p class="line__meta">${[i.color, i.size && `Talla ${i.size}`].filter(Boolean).join(' · ')}</p>
      <div class="line__bottom">
        <div class="stepper" aria-label="Cantidad">
          <button type="button" data-line-qty="${i.key}" data-delta="-1" aria-label="Quitar uno"><svg class="icon" aria-hidden="true"><use href="#i-minus"></use></svg></button>
          <output>${i.qty}</output>
          <button type="button" data-line-qty="${i.key}" data-delta="1" aria-label="Agregar uno" ${i.qty >= (i.max ?? 99) ? raw('disabled') : ''}><svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg></button>
        </div>
        <span class="line__price">${money(i.price * i.qty)}</span>
      </div>
    </div>
  </article>`;
}

function checkoutTpl(subtotal) {
  const c = settings.checkout || {};
  const delivery = c.deliveryMethods?.length ? c.deliveryMethods : fallbackDelivery;
  const payment = c.paymentMethods?.length ? c.paymentMethods : fallbackPayment;
  return html`
    <form class="checkout" data-checkout novalidate>
      <p class="checkout__intro">Completa tus datos y envía tu pedido por WhatsApp. Te respondemos para confirmar disponibilidad, envío y pago.</p>
      <div class="checkout__grid">
        <div class="field">
          <label class="field__label" for="co-name">Nombre</label>
          <input class="input" id="co-name" name="name" autocomplete="name" required />
          <p class="field__error">Escribe tu nombre.</p>
        </div>
        <div class="field">
          <label class="field__label" for="co-phone">Teléfono <span class="opt">(opcional)</span></label>
          <input class="input" id="co-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" />
        </div>
        <div class="field field--full">
          <label class="field__label" for="co-city">Ciudad y estado</label>
          <input class="input" id="co-city" name="city" autocomplete="address-level2" placeholder="Ej. Guadalajara, Jalisco" required />
          <p class="field__error">Indica tu ciudad y estado.</p>
        </div>
        <fieldset class="field field--full" style="border:0;padding:0;margin:0">
          <legend class="field__label" style="margin-bottom:8px">Entrega</legend>
          <div class="choice-row">
            ${delivery.map((d, k) => html`<label class="choice"><input type="radio" name="delivery" value="${d.id}" ${k === 0 ? raw('checked') : ''} /><span>${d.label}</span></label>`)}
          </div>
        </fieldset>
        <div class="field field--full" data-address-field>
          <label class="field__label" for="co-address">Dirección de entrega</label>
          <textarea class="input" id="co-address" name="address" rows="2" autocomplete="street-address" placeholder="Calle, número, colonia y código postal"></textarea>
          <p class="field__error">Escribe la dirección para el envío.</p>
        </div>
        <fieldset class="field field--full" style="border:0;padding:0;margin:0">
          <legend class="field__label" style="margin-bottom:8px">Forma de pago preferida</legend>
          <div class="choice-row">
            ${payment.map((d, k) => html`<label class="choice"><input type="radio" name="payment" value="${d.id}" ${k === 0 ? raw('checked') : ''} /><span>${d.label}</span></label>`)}
          </div>
        </fieldset>
        <div class="field field--full">
          <label class="field__label" for="co-notes">Notas <span class="opt">(opcional)</span></label>
          <textarea class="input" id="co-notes" name="notes" rows="2" placeholder="¿Alguna indicación especial?"></textarea>
        </div>
      </div>
      <div class="checkout__ref"><span>Referencia del pedido</span><span>${reference}</span></div>
      <ul class="checkout__items list-reset">
        ${cart.items.map((i) => html`<li><span>${i.qty} × ${i.name}${i.size ? ` (${i.size})` : ''}</span><span>${money(i.price * i.qty)}</span></li>`)}
      </ul>
      <div class="cart__row"><span>Total (sin envío)</span><strong class="cart__total">${money(subtotal)}</strong></div>
    </form>
    <footer class="cart__summary">
      <a class="btn btn--ink btn--lg btn--block btn--wa" href="#" target="_blank" rel="noopener" data-checkout-send>
        <svg class="icon" aria-hidden="true"><use href="#i-whatsapp"></use></svg>
        Enviar pedido por WhatsApp
      </a>
      <p class="cart__note">Se abrirá WhatsApp con tu pedido escrito. Solo tienes que enviarlo.</p>
    </footer>`;
}

function doneTpl() {
  const { url } = OrderService.preview(collect());
  return html`
    <div class="checkout">
      <div class="checkout__done">
        <span class="empty__icon"><svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg></span>
        <h3>¡Tu pedido está listo!</h3>
        <p>Termina de enviarlo en WhatsApp. Si la aplicación no se abrió, toca el botón de nuevo.</p>
        <a class="btn btn--ink btn--wa btn--block" href="${url}" target="_blank" rel="noopener">
          <svg class="icon" aria-hidden="true"><use href="#i-whatsapp"></use></svg>
          Abrir WhatsApp de nuevo
        </a>
        <div class="cluster">
          <button class="btn btn--outline btn--sm" type="button" data-cart-clear>Ya lo envié, vaciar bolsa</button>
          <button class="btn btn--outline btn--sm" type="button" data-cart-edit>Editar mis datos</button>
        </div>
      </div>
    </div>`;
}

/* ---------- datos del formulario ---------- */
function collect() {
  const form = root.querySelector('[data-checkout]');
  const saved = load(STORAGE_KEYS.customer, {});
  const val = (name) => (form ? form.elements[name]?.value?.trim() : saved[name]) || '';
  const c = settings.checkout || {};
  const delivery = (c.deliveryMethods?.length ? c.deliveryMethods : fallbackDelivery).find((d) => d.id === (val('delivery') || saved.delivery)) || null;
  const payment = (c.paymentMethods?.length ? c.paymentMethods : fallbackPayment).find((d) => d.id === (val('payment') || saved.payment)) || null;
  return {
    orderNumber: reference,
    items: cart.items,
    subtotal: cart.subtotal,
    customer: { name: val('name'), phone: val('phone'), city: val('city'), address: delivery?.requiresAddress ? val('address') : '' },
    delivery,
    payment,
    notes: val('notes'),
  };
}

function prefill() {
  const form = root.querySelector('[data-checkout]');
  const saved = load(STORAGE_KEYS.customer, null);
  if (form && saved) {
    for (const [k, v] of Object.entries(saved)) {
      const el = form.elements[k];
      if (!el || !v) continue;
      if (el instanceof RadioNodeList) {
        const r = Array.from(el).find((x) => x.value === v);
        if (r) r.checked = true;
      } else el.value = v;
    }
  }
  toggleAddress();
}

function toggleAddress() {
  const form = root.querySelector('[data-checkout]');
  if (!form) return;
  const c = settings.checkout || {};
  const id = form.elements.delivery?.value;
  const d = (c.deliveryMethods?.length ? c.deliveryMethods : fallbackDelivery).find((x) => x.id === id);
  const field = form.querySelector('[data-address-field]');
  field.hidden = !d?.requiresAddress;
}

function persist() {
  const form = root.querySelector('[data-checkout]');
  if (!form) return;
  const data = {};
  ['name', 'phone', 'city', 'address', 'delivery', 'payment'].forEach((k) => { data[k] = form.elements[k]?.value || ''; });
  save(STORAGE_KEYS.customer, data);
}

function syncLink() {
  const a = root.querySelector('[data-checkout-send]');
  if (a) a.href = OrderService.preview(collect()).url;
}

function validate() {
  const form = root.querySelector('[data-checkout]');
  let first = null;
  const check = (name, ok) => {
    const field = form.elements[name]?.closest('.field');
    field?.classList.toggle('is-invalid', !ok);
    if (!ok && !first) first = form.elements[name];
  };
  const order = collect();
  check('name', !!order.customer.name);
  check('city', !!order.customer.city);
  if (order.delivery?.requiresAddress) check('address', !!order.customer.address);
  first?.focus();
  return !first;
}

/* ---------- eventos ---------- */
function bind() {
  root = document.querySelector('[data-cart]');
  if (!root) return;
  const dlg = document.getElementById('sheet-cart');
  title = dlg.querySelector('#cart-title');
  backBtn = dlg.querySelector('[data-cart-back]');

  backBtn.addEventListener('click', () => { step = 'bag'; paint(); });

  root.addEventListener('click', async (e) => {
    const t = e.target;
    const qty = t.closest('[data-line-qty]');
    if (qty) {
      const item = cart.items.find((i) => i.key === qty.dataset.lineQty);
      if (item) cart.setQty(item.key, item.qty + Number(qty.dataset.delta));
      return;
    }
    const rm = t.closest('[data-line-remove]');
    if (rm) {
      const line = rm.closest('.line');
      line?.classList.add('is-leaving');
      setTimeout(() => cart.remove(rm.dataset.lineRemove), 260);
      return;
    }
    if (t.closest('[data-cart-next]')) {
      reference ||= OrderService.newReference();
      step = 'checkout';
      sent = false;
      paint();
      root.querySelector('#co-name')?.focus({ preventScroll: true });
      return;
    }
    if (t.closest('[data-cart-edit]')) {
      sent = false;
      paint();
      return;
    }
    if (t.closest('[data-cart-clear]')) {
      cart.clear();
      reference = '';
      sent = false;
      step = 'bag';
      sheet('cart').close();
      notify({ title: '¡Gracias por tu compra!', sub: 'Te respondemos por WhatsApp muy pronto.', icon: 'sparkle' });
      return;
    }
    const send = t.closest('[data-checkout-send]');
    if (send) {
      if (!validate()) {
        e.preventDefault();
        return;
      }
      persist();
      if (!usingMockData) {
        // Con backend: registra el pedido y luego abre WhatsApp con el número oficial
        e.preventDefault();
        send.setAttribute('aria-disabled', 'true');
        try {
          const res = await OrderService.submit(collect());
          reference = res.orderNumber || reference;
          openWhatsApp(res.url);
        } catch (err) {
          notify({ title: 'No pudimos registrar tu pedido', sub: err.message, icon: 'info' });
          send.removeAttribute('aria-disabled');
          return;
        }
      } else {
        syncLink();
      }
      setTimeout(() => { sent = true; paint(); }, 400);
    }
  });

  root.addEventListener('input', (e) => {
    if (!e.target.closest('[data-checkout]')) return;
    e.target.closest('.field')?.classList.remove('is-invalid');
    syncLink();
  });
  root.addEventListener('change', (e) => {
    if (!e.target.closest('[data-checkout]')) return;
    if (e.target.name === 'delivery') toggleAddress();
    persist();
    syncLink();
  });

  cart.subscribe(() => {
    if (sheet('cart')?.el.open && !(step === 'checkout' && sent)) paint();
  }, { immediate: false });
}

export function initCart() {
  bind();
  ContentService.getSettings().then((s) => { if (s) settings = s; }).catch(() => {});
}

export const cartSummaryText = () => toString(html`${plural(cart.count, 'pieza', 'piezas')} · ${money(cart.subtotal)}`);
