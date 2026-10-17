/**
 * Tarjeta de producto + caché de productos mostrados (para abrir la vista rápida al instante).
 */
import { html, raw, esc } from '../core/dom.js';
import { money, badgesOf, totalStock } from '../core/format.js';
import { sizesOf, firstAvailableColor } from '../core/product.js';
import { cdn } from '../backend/model.js';
import { favorites } from '../store/favorites.store.js';
import { productUrl } from '../core/url.js';

export const productCache = new Map();
export const remember = (list) => { list.forEach((p) => productCache.set(p.slug, p)); return list; };

const familyHex = (c) => c.hex || '#ccc';

export function productCard(p, { index = 0, reveal = true, category = '' } = {}) {
  productCache.set(p.slug, p);
  const color = firstAvailableColor(p) || { images: [] };
  const colorIdx = Math.max(0, p.colors?.indexOf(color) ?? 0);
  const [img1, img2] = (color.images || []).map((src) => cdn(src, { w: 640 }));
  const stock = totalStock(p);
  const inColor = new Map(sizesOf(p, color.name).map((s) => [s.label, s.stock]));
  const badges = badgesOf(p);
  const fav = favorites.has(p.slug);
  const sale = p.compareAtPrice && p.compareAtPrice > p.price;
  const href = productUrl(p.slug);
  const sizes = p.sizes || [];
  const oneSize = sizes.length === 1;

  return html`
  <article class="card${stock === 0 ? ' is-soldout' : ''}" data-card="${p.slug}" data-color="${color.name || ''}" ${reveal ? raw(`data-reveal style="--d:${index % 4}"`) : ''}>
    <div class="card__media">
      <a class="card__link" href="${href}" data-product-link="${p.slug}" aria-label="${`Ver ${p.name}`}">
        <img class="card__img--main" src="${img1}" alt="${`${p.name} color ${color.name}`}" width="800" height="1000" loading="lazy" decoding="async" />
        ${img2 ? html`<img class="card__img--alt" src="${img2}" alt="" width="800" height="1000" loading="lazy" decoding="async" />` : ''}
      </a>
      <div class="card__badges">
        ${badges.map((b) => html`<span class="badge badge--${b.id}${b.id === 'nuevo' || b.id === 'ultimas' ? ' glass' : ''}">${b.label}</span>`)}
      </div>
      <button class="icon-btn glass round card__fav" type="button" data-fav="${p.slug}" aria-pressed="${String(fav)}" aria-label="${fav ? `Quitar ${p.name} de favoritos` : `Agregar ${p.name} a favoritos`}">
        <svg class="icon" aria-hidden="true"><use href="#i-heart"></use></svg>
      </button>
      ${stock > 0 ? html`
      <div class="card__quick glass">
        <p class="card__quick-title">${oneSize ? 'Agregar a la bolsa' : 'Agregar talla'}</p>
        <div class="card__sizes">
          ${sizes.map((s) => html`<button class="size-btn" type="button" data-quick-add="${p.slug}" data-size="${s.label}" ${inColor.get(s.label) ? '' : raw('disabled')} aria-label="${`Agregar talla ${s.label}`}">${s.label}</button>`)}
        </div>
      </div>
      <button class="icon-btn glass round card__add" type="button" data-quick="${p.slug}" aria-label="${`Agregar ${p.name}`}">
        <svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg>
      </button>` : ''}
    </div>
    <div class="card__info">
      ${category ? html`<p class="card__cat">${category}</p>` : ''}
      <h3 class="card__name"><a href="${href}" data-product-link="${p.slug}">${p.name}</a></h3>
      <p class="card__price${sale ? ' is-sale' : ''}">
        <span>${money(p.price)}</span>
        ${sale ? html`<s class="card__compare">${money(p.compareAtPrice)}</s>` : ''}
      </p>
      ${p.colors?.length > 1 ? html`
      <div class="card__swatches">
        ${p.colors.map((c, i) => html`<button class="card__swatch" type="button" data-card-color="${i}" aria-pressed="${String(i === colorIdx)}" aria-label="${`Color ${c.name}`}"><span class="swatch" style="${`--c:${familyHex(c)}`}"></span></button>`)}
        <small>${p.colors.length} colores</small>
      </div>` : html`<div class="card__swatches"><span class="swatch" style="${`--c:${familyHex(color)}`}"></span><small>${color.name}</small></div>`}
    </div>
  </article>`;
}

export function cardSkeletons(n = 4) {
  return raw(Array.from({ length: n }, () => `
    <div class="card" aria-hidden="true">
      <div class="card__media skeleton"></div>
      <div class="card__info"><div class="sk-line skeleton"></div><div class="sk-line sk-line--short skeleton"></div></div>
    </div>`).join(''));
}

/** Cambia las fotos de una tarjeta al color elegido. */
export function switchCardColor(cardEl, index) {
  const p = productCache.get(cardEl.dataset.card);
  const c = p?.colors?.[index];
  if (!c) return;
  const [main, alt] = cardEl.querySelectorAll('.card__media img');
  if (main) { main.src = cdn(c.images[0], { w: 640 }); main.alt = `${p.name} color ${c.name}`; }
  if (alt && c.images[1]) alt.src = cdn(c.images[1], { w: 640 });
  cardEl.querySelectorAll('[data-card-color]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.cardColor === index)));
  cardEl.dataset.color = c.name;
  // Las tallas disponibles cambian con el color
  const inColor = new Map(sizesOf(p, c.name).map((x) => [x.label, x.stock]));
  cardEl.querySelectorAll('[data-quick-add]').forEach((b) => { b.disabled = !inColor.get(b.dataset.size); });
}

export function miniCard(p) {
  productCache.set(p.slug, p);
  const c = p.colors?.[0];
  return html`
  <a class="mini" href="${productUrl(p.slug)}" data-product-link="${p.slug}">
    <span class="mini__media"><img src="${cdn(c?.images?.[0], { w: 400 })}" alt="" width="800" height="1000" loading="lazy" /></span>
    <span class="mini__name">${p.name}</span>
    <span class="mini__price">${money(p.price)}</span>
  </a>`;
}

export const productLabel = (p) => esc(p.name);
