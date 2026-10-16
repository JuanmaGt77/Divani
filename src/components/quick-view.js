/**
 * Vista rápida de producto (hoja). Funciona como la página de detalle:
 * galería, color, talla, cantidad, agregar a la bolsa y pedir por WhatsApp.
 */
import { html, raw, render, esc } from '../core/dom.js';
import { money, discountPct, totalStock } from '../core/format.js';
import { setParams, productUrl } from '../core/url.js';
import { listen } from '../core/emitter.js';
import { CatalogService } from '../services/catalog.service.js';
import { ContentService } from '../services/content.service.js';
import { productMessage, waLink } from '../services/whatsapp.service.js';
import { cart } from '../store/cart.store.js';
import { favorites } from '../store/favorites.store.js';
import { productCache } from './product-card.js';
import { sheet } from './sheet.js';
import { notify } from './island.js';
import { openCart } from './cart.js';
import { openSizeGuide } from './size-guide.js';
import { CATALOG } from '../config/site.config.js';

let state = null;
let root = null;
let catNames = {};
let shippingNote = '';

export async function openProduct(slug, { color } = {}) {
  root ??= document.querySelector('[data-product]');
  if (!root) return;
  let p = productCache.get(slug);
  if (!p) {
    try {
      p = await CatalogService.getProduct(slug);
    } catch {
      p = null;
    }
  }
  if (!p) {
    notify({ title: 'No encontramos esa prenda', sub: 'Puede que ya se haya agotado.', icon: 'info' });
    return;
  }
  productCache.set(p.slug, p);
  const colorIdx = Math.max(0, p.colors.findIndex((c) => c.name === color));
  const available = p.sizes.filter((s) => s.stock > 0);
  state = { p, colorIdx, size: available.length === 1 ? available[0].label : null, qty: 1 };
  paint({ fresh: true });
  sheet('product').open();
  setParams({ p: p.slug });
  root.querySelector('.pdp__info')?.scrollTo(0, 0);
  root.scrollTo?.(0, 0);
}

function paint({ fresh = false } = {}) {
  // Conserva scroll y acordeones abiertos al cambiar color, talla o cantidad
  const keep = fresh ? null : {
    root: root.scrollTop,
    info: root.querySelector('.pdp__info')?.scrollTop || 0,
    open: Array.from(root.querySelectorAll('.accordion details'), (d) => d.open),
  };
  draw();
  if (keep) {
    root.scrollTop = keep.root;
    const info = root.querySelector('.pdp__info');
    if (info) info.scrollTop = keep.info;
    root.querySelectorAll('.accordion details').forEach((d, i) => { if (i in keep.open) d.open = keep.open[i]; });
  }
}

function draw() {
  const { p, colorIdx, size, qty } = state;
  const color = p.colors[colorIdx];
  const pct = discountPct(p);
  const stock = totalStock(p);
  const sel = p.sizes.find((s) => s.label === size);
  const fav = favorites.has(p.slug);
  const wa = waLink(productMessage(p, { color: color.name, size, qty }));

  render(root, html`
    <div class="pdp__gallery">
      <div class="pdp__slides" data-pdp-slides>
        ${color.images.map((src, i) => html`<div class="pdp__slide"><img src="${src}" alt="${i === 0 ? `${p.name}, color ${color.name}` : `Detalle de ${p.name} con su etiqueta`}" width="800" height="1000" /></div>`)}
      </div>
      <div class="pdp__thumbs glass">
        ${color.images.map((src, i) => html`<button class="pdp__thumb" type="button" data-pdp-thumb="${i}" aria-current="${String(i === 0)}" aria-label="${`Ver foto ${i + 1}`}"><img src="${src}" alt="" /></button>`)}
      </div>
      <div class="pdp__dots glass" aria-hidden="true">${color.images.map((_, i) => html`<span aria-current="${String(i === 0)}"></span>`)}</div>
    </div>

    <div class="pdp__info">
      <div>
        <p class="pdp__eyebrow">${catNames[p.category] || 'Divani'} · ${p.origin || 'Importado de EE. UU.'}</p>
        <h2 class="pdp__title">${p.name}</h2>
      </div>
      <p class="pdp__price${pct ? ' is-sale' : ''}">
        <span>${money(p.price)}</span>
        ${pct ? html`<s>${money(p.compareAtPrice)}</s><span class="badge badge--oferta">−${pct}%</span>` : ''}
      </p>
      <p class="pdp__desc">${p.description}</p>

      <div class="pdp__group">
        <p class="pdp__label"><span>Color: <strong>${color.name}</strong></span></p>
        <div class="pdp__colors" role="group" aria-label="Colores">
          ${p.colors.map((c, i) => html`<button class="pdp__color" type="button" data-pdp-color="${i}" aria-pressed="${String(i === colorIdx)}" aria-label="${c.name}"><span class="swatch" style="${`--c:${c.hex}`}"></span></button>`)}
        </div>
      </div>

      <div class="pdp__group">
        <p class="pdp__label">
          <span>Talla${size ? html`: <strong>${size}</strong>` : ''}</span>
          ${p.sizes.length > 1 ? html`<button type="button" data-size-guide><svg class="icon" aria-hidden="true"><use href="#i-ruler"></use></svg>Guía de tallas</button>` : ''}
        </p>
        <div class="pdp__sizes" role="group" aria-label="Tallas" data-pdp-sizes>
          ${p.sizes.map((s) => html`<button class="pdp__size" type="button" data-pdp-size="${s.label}" aria-pressed="${String(s.label === size)}" ${s.stock ? '' : raw('disabled')} aria-label="${s.stock ? `Talla ${s.label}` : `Talla ${s.label}, agotada`}">${s.label}</button>`)}
        </div>
        <p class="pdp__hint" data-pdp-hint aria-live="polite">${sel && sel.stock <= CATALOG.lowStock ? `Solo ${sel.stock === 1 ? 'queda 1 pieza' : `quedan ${sel.stock} piezas`} en esta talla.` : ''}</p>
      </div>

      ${stock > 0 ? html`
      <div class="pdp__actions">
        <div class="stepper" aria-label="Cantidad">
          <button type="button" data-pdp-qty="-1" aria-label="Quitar uno" ${qty <= 1 ? raw('disabled') : ''}><svg class="icon" aria-hidden="true"><use href="#i-minus"></use></svg></button>
          <output aria-live="polite">${qty}</output>
          <button type="button" data-pdp-qty="1" aria-label="Agregar uno" ${sel && qty >= sel.stock ? raw('disabled') : ''}><svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg></button>
        </div>
        <button class="btn btn--ink" type="button" data-pdp-add>
          <svg class="icon" aria-hidden="true"><use href="#i-bag"></use></svg>
          Agregar a la bolsa
        </button>
        <a class="btn btn--glass btn--wa glass" href="${wa}" target="_blank" rel="noopener" data-pdp-wa>
          <svg class="icon" aria-hidden="true"><use href="#i-whatsapp"></use></svg>
          Pedir por WhatsApp
        </a>
      </div>` : html`
      <div class="pdp__actions">
        <a class="btn btn--ink btn--wa btn--block" style="grid-column:1/-1" href="${waLink(`Hola, me interesa «${p.name}». ¿Volverá a estar disponible?`)}" target="_blank" rel="noopener">
          <svg class="icon" aria-hidden="true"><use href="#i-whatsapp"></use></svg>
          Avísame si regresa
        </a>
      </div>`}

      <ul class="pdp__perks list-reset">
        <li><svg class="icon" aria-hidden="true"><use href="#i-tag"></use></svg>Prenda importada con etiqueta original</li>
        <li><svg class="icon" aria-hidden="true"><use href="#i-truck"></use></svg>Envíos a todo México</li>
        <li><svg class="icon" aria-hidden="true"><use href="#i-chat"></use></svg>Te asesoramos con la talla por WhatsApp</li>
      </ul>

      <div class="accordion">
        <details open>
          <summary>Detalles<svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg></summary>
          <div class="accordion__body"><ul class="list-reset stack" style="--stack:6px">${p.details.map((d) => html`<li>— ${d}</li>`)}</ul></div>
        </details>
        <details>
          <summary>Material y cuidados<svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg></summary>
          <div class="accordion__body"><p><strong>Material:</strong> ${p.material}</p><p><strong>Cuidados:</strong> ${p.care}</p><p class="muted small">Código: ${p.sku}</p></div>
        </details>
        <details>
          <summary>Envíos y pagos<svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg></summary>
          <div class="accordion__body"><p>${shippingNote || 'El costo y tiempo de envío te los confirmamos por WhatsApp según tu ciudad.'}</p></div>
        </details>
      </div>

      <div class="cluster">
        <button class="pdp__share" type="button" data-pdp-share><svg class="icon" aria-hidden="true"><use href="#i-share"></use></svg>Compartir</button>
        <button class="pdp__share" type="button" data-fav="${p.slug}" aria-pressed="${String(fav)}">
          <svg class="icon" aria-hidden="true"><use href="#i-heart"></use></svg>${fav ? 'En favoritos' : 'Guardar en favoritos'}
        </button>
      </div>
    </div>
  `);
}

function bind() {
  root = document.querySelector('[data-product]');
  if (!root) return;

  root.addEventListener('click', (e) => {
    const t = e.target;
    const color = t.closest('[data-pdp-color]');
    if (color) {
      state.colorIdx = +color.dataset.pdpColor;
      paint();
      return;
    }
    const size = t.closest('[data-pdp-size]');
    if (size && !size.disabled) {
      state.size = size.dataset.pdpSize;
      const max = state.p.sizes.find((s) => s.label === state.size)?.stock || 1;
      state.qty = Math.min(state.qty, max);
      paint();
      return;
    }
    const qty = t.closest('[data-pdp-qty]');
    if (qty) {
      const max = state.p.sizes.find((s) => s.label === state.size)?.stock ?? 10;
      state.qty = Math.max(1, Math.min(max, state.qty + Number(qty.dataset.pdpQty)));
      paint();
      return;
    }
    if (t.closest('[data-pdp-add]')) return add();
    if (t.closest('[data-size-guide]')) return openSizeGuide(state.p.department);
    if (t.closest('[data-pdp-share]')) return share();
    const thumb = t.closest('[data-pdp-thumb]');
    if (thumb) {
      const slides = root.querySelector('[data-pdp-slides]');
      slides.scrollTo({ left: slides.clientWidth * +thumb.dataset.pdpThumb, behavior: 'smooth' });
    }
  });

  // Sincroniza miniaturas y puntos con el deslizamiento de la galería
  root.addEventListener('scroll', (e) => {
    const slides = e.target.closest?.('[data-pdp-slides]');
    if (!slides) return;
    const i = Math.round(slides.scrollLeft / Math.max(1, slides.clientWidth));
    root.querySelectorAll('[data-pdp-thumb]').forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
    root.querySelectorAll('.pdp__dots span').forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
  }, true);

  listen('sheet:close', ({ id }) => {
    if (id === 'product') setParams({ p: null });
  });
}

function add() {
  const { p, colorIdx, size, qty } = state;
  if (!size) {
    const hint = root.querySelector('[data-pdp-hint]');
    hint.textContent = 'Elige una talla para agregarla a tu bolsa.';
    root.querySelectorAll('.pdp__size:not(:disabled)').forEach((b) => {
      b.classList.remove('is-shake');
      void b.offsetWidth;
      b.classList.add('is-shake');
    });
    return;
  }
  const color = p.colors[colorIdx];
  cart.add(p, { color: color.name, size, qty });
  sheet('product').close();
  notify({
    title: 'Agregado a tu bolsa',
    sub: `${p.name} · ${color.name} · ${size}`,
    image: color.images[0],
    action: { label: 'Ver bolsa', onClick: openCart },
  });
}

async function share() {
  const { p } = state;
  const url = productUrl(p.slug);
  try {
    if (navigator.share) {
      await navigator.share({ title: `${p.name} · Divani`, text: `Mira esta prenda en Divani: ${p.name}`, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    notify({ title: 'Enlace copiado', sub: 'Pégalo donde quieras compartirlo.', icon: 'link' });
  } catch (err) {
    if (err?.name === 'AbortError') return;
    notify({ title: 'Copia este enlace', sub: url, icon: 'link' });
  }
}

export async function initQuickView() {
  bind();
  CatalogService.getCategories().then((c) => {
    catNames = Object.fromEntries(c.categories.map((x) => [x.slug, x.name]));
  }).catch(() => {});
  ContentService.getSettings().then((s) => { shippingNote = s?.checkout?.note || ''; }).catch(() => {});
  // Repinta el estado de favorito si cambia mientras está abierta
  favorites.subscribe(() => { if (state && sheet('product')?.isOpen) paint(); }, { immediate: false });
}

export const escapeName = (p) => esc(p.name);
