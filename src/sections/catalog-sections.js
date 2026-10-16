/**
 * Secciones de la portada que se alimentan del catálogo:
 * categorías, novedades, lo más deseado, niñas/niños y hombre.
 */
import { html, render } from '../core/dom.js';
import { plural } from '../core/format.js';
import { observeReveal } from '../core/motion.js';
import { CatalogService } from '../services/catalog.service.js';
import { productCard, cardSkeletons, remember } from '../components/product-card.js';
import { segmented } from '../components/segmented.js';
import { railArrows } from '../components/rail.js';

const errorTpl = (retryLabel = 'Reintentar') => html`
  <div class="shop-error" style="grid-column:1/-1">
    <p>No pudimos cargar las prendas. Revisa tu conexión e inténtalo de nuevo.</p>
    <button class="btn btn--outline btn--sm" type="button" data-retry>${retryLabel}</button>
  </div>`;

async function fill(el, query, { cardOpts = {}, onError } = {}) {
  if (!el) return [];
  try {
    const { data } = await CatalogService.listProducts(query);
    remember(data);
    render(el, html`${data.map((p, i) => productCard(p, { index: i, ...cardOpts }))}`);
    observeReveal(el);
    return data;
  } catch {
    render(el, errorTpl());
    el.querySelector('[data-retry]')?.addEventListener('click', () => onError?.(), { once: true });
    return [];
  }
}

/* ---------- Categorías (bento) ---------- */
export async function initCategories() {
  const el = document.querySelector('[data-categories]');
  if (!el) return;
  try {
    const { categories } = await CatalogService.getCategories();
    const women = categories.filter((c) => c.department === 'mujer');
    render(el, html`
      ${women.map((c, i) => html`
        <a class="tile${i === 0 ? ' tile--hero' : ''}" href="${`tienda.html?depto=mujer&cat=${c.slug}`}" data-reveal style="${`--d:${i % 4}`}">
          <img src="${c.image}" alt="${`${c.name} de mujer`}" width="800" height="1000" loading="lazy" decoding="async" />
          <span class="tile__label glass">
            <span class="tile__name">${c.name}</span>
            <span class="tile__count">${plural(c.productCount, 'pieza', 'piezas')}</span>
          </span>
          <span class="icon-btn glass round tile__go" aria-hidden="true"><svg class="icon"><use href="#i-arrow-up-right"></use></svg></span>
        </a>`)}
      <a class="tile tile--type" href="tienda.html?orden=nuevo" data-reveal style="--d:2">
        <span class="eyebrow eyebrow--plain">Recién llegado</span>
        <span class="tile__big">Lo <em>nuevo</em> de la temporada</span>
        <span class="tile__cta">Ver novedades <svg class="icon" aria-hidden="true"><use href="#i-arrow-up-right"></use></svg></span>
      </a>
      <a class="tile tile--type tile--sand" href="tienda.html?oferta=1" data-reveal style="--d:3">
        <span class="eyebrow eyebrow--plain">Rebajas</span>
        <span class="tile__big">Hasta <em>30%</em> menos</span>
        <span class="tile__cta">Ver ofertas <svg class="icon" aria-hidden="true"><use href="#i-arrow-up-right"></use></svg></span>
      </a>`);
    el.removeAttribute('aria-busy');
    observeReveal(el);
  } catch {
    render(el, errorTpl());
    el.querySelector('[data-retry]')?.addEventListener('click', initCategories, { once: true });
  }
}

/* ---------- Novedades con filtro segmentado ---------- */
export function initNewArrivals() {
  const grid = document.querySelector('[data-new-grid]');
  if (!grid) return;
  let cat = '';
  const load = () => {
    render(grid, cardSkeletons(8));
    return fill(grid, { category: cat, sort: 'nuevo', pageSize: 8 }, { onError: load });
  };
  segmented(document.querySelector('[data-new-filter]'), {
    onChange: (btn) => { cat = btn.dataset.cat; load(); },
  });
  load();
}

/* ---------- Carriles ---------- */
async function fillRail(name, query) {
  const track = document.querySelector(`[data-rail="${name}"] [data-rail-track]`);
  if (!track) return;
  render(track, cardSkeletons(5));
  await fill(track, query, { cardOpts: { reveal: false }, onError: () => fillRail(name, query) });
  const rail = track.closest('.rail');
  rail.scrollLeft = 0;
}

export function initBestsellers() {
  fillRail('bestsellers', { isBestseller: true, sort: 'populares', pageSize: 12 });
  railArrows('bestsellers');
}

export function initKids() {
  const filter = document.querySelector('[data-kids-filter]');
  let dept = 'ninas';
  const load = () => fillRail('kids', { department: dept, sort: 'destacados', pageSize: 10 });
  segmented(filter, { onChange: (btn) => { dept = btn.dataset.dept; load(); } });
  load();
  railArrows('kids');
}

export function initMen() {
  const grid = document.querySelector('[data-men-grid]');
  if (!grid) return;
  const load = () => {
    render(grid, cardSkeletons(4));
    return fill(grid, { department: 'hombre', sort: 'destacados', pageSize: 4 }, { onError: load });
  };
  load();
}
