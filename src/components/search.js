/** Búsqueda instantánea: sugerencias, búsquedas recientes y resultados mientras escribes. */
import { html, render, debounce } from '../core/dom.js';
import { load, save } from '../core/storage.js';
import { STORAGE_KEYS } from '../config/site.config.js';
import { CatalogService } from '../services/catalog.service.js';
import { ContentService } from '../services/content.service.js';
import { miniCard } from './product-card.js';
import { sheet } from './sheet.js';

let input, body, form;
let popular = ['Vestidos', 'Mezclilla', 'Satín', 'Blazer', 'Niñas', 'Bolsas'];
let token = 0;

export function openSearch() {
  sheet('search')?.open({ focus: '#search-input' });
  if (!input.value) paintIdle();
}

function recent() {
  return load(STORAGE_KEYS.recentSearches, []);
}
function remember(q) {
  const list = [q, ...recent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
  save(STORAGE_KEYS.recentSearches, list);
}

const shopUrl = (q) => `tienda.html?q=${encodeURIComponent(q)}`;

async function paintIdle() {
  const rec = recent();
  let featured = [];
  try {
    featured = (await CatalogService.listProducts({ isNew: true, pageSize: 4, sort: 'nuevo' })).data;
  } catch { /* sin conexión: solo sugerencias */ }
  if (input.value) return;
  render(body, html`
    ${rec.length ? html`
    <div class="search__group">
      <p class="search__label">Búsquedas recientes</p>
      <div class="cluster" style="--cluster:8px">${rec.map((q) => html`<a class="chip" href="${shopUrl(q)}" data-search-term="${q}">${q}</a>`)}</div>
    </div>` : ''}
    <div class="search__group">
      <p class="search__label">Lo más buscado</p>
      <div class="cluster" style="--cluster:8px">${popular.map((q) => html`<a class="chip" href="${shopUrl(q)}" data-search-term="${q}">${q}</a>`)}</div>
    </div>
    ${featured.length ? html`
    <div class="search__group">
      <p class="search__label">Recién llegado</p>
      <div class="search__results">${featured.map(miniCard)}</div>
    </div>` : ''}`);
}

async function run(q) {
  const my = ++token;
  if (!q) return paintIdle();
  let res;
  try {
    res = await CatalogService.search(q, { limit: 8 });
  } catch {
    if (my === token) render(body, html`<p class="search__empty">No pudimos buscar en este momento. Revisa tu conexión e inténtalo de nuevo.</p>`);
    return;
  }
  if (my !== token) return;
  const { data, meta } = res;
  render(body, data.length ? html`
    <div class="search__group">
      <p class="search__label">${meta.total} ${meta.total === 1 ? 'resultado' : 'resultados'}</p>
      <div class="search__results">${data.map(miniCard)}</div>
    </div>
    ${meta.total > data.length ? html`<a class="btn btn--outline search__all" href="${shopUrl(q)}">Ver los ${meta.total} resultados</a>` : ''}
  ` : html`
    <div class="search__group">
      <p class="search__empty">No encontramos prendas para «${q}». Prueba con otra palabra, por ejemplo:</p>
      <div class="cluster" style="--cluster:8px">${popular.map((t) => html`<a class="chip" href="${shopUrl(t)}" data-search-term="${t}">${t}</a>`)}</div>
    </div>`);
}

export function initSearch() {
  form = document.querySelector('[data-search-form]');
  if (!form) return;
  input = form.querySelector('input');
  body = document.querySelector('[data-search-body]');
  const go = debounce((q) => run(q), 180);
  input.addEventListener('input', () => go(input.value.trim()));
  // Esc cierra la búsqueda a la primera (el campo de búsqueda nativo solo lo vaciaría)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      sheet('search')?.close();
    }
  });
  form.addEventListener('submit', (e) => {
    const q = input.value.trim();
    if (!q) { e.preventDefault(); return; }
    remember(q);
  });
  body.addEventListener('click', (e) => {
    const term = e.target.closest('[data-search-term]');
    if (term) remember(term.dataset.searchTerm);
  });
  ContentService.getSettings().then((s) => { if (s?.popularSearches?.length) popular = s.popularSearches; }).catch(() => {});
}
