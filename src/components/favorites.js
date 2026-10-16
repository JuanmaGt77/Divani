/** Hoja de favoritos: prendas guardadas, con opción de compartirlas por WhatsApp. */
import { html, render } from '../core/dom.js';
import { plural } from '../core/format.js';
import { CatalogService } from '../services/catalog.service.js';
import { favoritesMessage, waLink } from '../services/whatsapp.service.js';
import { favorites } from '../store/favorites.store.js';
import { miniCard, remember } from './product-card.js';
import { sheet } from './sheet.js';

let root, title;

export async function openFavorites() {
  sheet('favorites')?.open();
  await paint();
}

async function paint() {
  if (!root) return;
  const slugs = favorites.list;
  title.innerHTML = `Favoritos${slugs.length ? ` <small>${plural(slugs.length, 'prenda', 'prendas')}</small>` : ''}`;
  if (!slugs.length) {
    render(root, html`
      <div class="empty">
        <span class="empty__icon glass"><svg class="icon" aria-hidden="true"><use href="#i-heart"></use></svg></span>
        <h3>Aún no tienes favoritos</h3>
        <p>Toca el corazón en cualquier prenda para guardarla aquí y encontrarla después.</p>
        <a class="btn btn--ink" href="tienda.html">Descubrir prendas</a>
      </div>`);
    return;
  }
  let items = [];
  try {
    items = remember(await CatalogService.getMany(slugs));
  } catch {
    render(root, html`<div class="empty"><p>No pudimos cargar tus favoritos. Revisa tu conexión e inténtalo de nuevo.</p></div>`);
    return;
  }
  render(root, html`
    <div class="favs__grid">
      ${items.map((p) => html`
        <div class="favs__item">
          ${miniCard(p)}
          <button class="icon-btn glass round" type="button" data-fav="${p.slug}" aria-pressed="true" aria-label="${`Quitar ${p.name} de favoritos`}">
            <svg class="icon" aria-hidden="true"><use href="#i-close"></use></svg>
          </button>
        </div>`)}
    </div>
    <footer class="favs__foot">
      <a class="btn btn--ink btn--wa btn--block" href="${waLink(favoritesMessage(items))}" target="_blank" rel="noopener">
        <svg class="icon" aria-hidden="true"><use href="#i-whatsapp"></use></svg>
        Preguntar por mis favoritos
      </a>
    </footer>`);
}

export function initFavorites() {
  root = document.querySelector('[data-favorites]');
  title = document.getElementById('fav-title');
  if (!root) return;
  favorites.subscribe(() => { if (sheet('favorites')?.el.open) paint(); }, { immediate: false });
}
