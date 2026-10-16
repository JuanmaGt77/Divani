/**
 * Tienda (tienda.html): catálogo con departamentos, categorías, filtros, orden,
 * búsqueda y «cargar más». El estado vive en la URL para que los enlaces se puedan compartir.
 */
import { initApp } from '../app.js';
import { $, html, raw, render, debounce } from '../core/dom.js';
import { plural, money } from '../core/format.js';
import { getParams, setParams, listParam } from '../core/url.js';
import { observeReveal } from '../core/motion.js';
import { CATALOG } from '../config/site.config.js';
import { CatalogService } from '../services/catalog.service.js';
import { waLink, greetingMessage } from '../services/whatsapp.service.js';
import { productCard, cardSkeletons, remember } from '../components/product-card.js';
import { segmented } from '../components/segmented.js';
import { sheet } from '../components/sheet.js';

initApp({ tab: 'tienda' });

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2T', '3T', '4T', '5', '6', '8', '10', '12', '2', '4', '24', '25', '26', '27', '28', '29', '30', '32', '34', '36', 'Única'];
const PRICE_RANGES = [
  { label: 'Menos de $500', min: '', max: 499 },
  { label: '$500 a $800', min: 500, max: 800 },
  { label: '$800 a $1,200', min: 800, max: 1200 },
  { label: 'Más de $1,200', min: 1200, max: '' },
];

const el = {
  title: $('[data-shop-title]'),
  desc: $('[data-shop-desc]'),
  count: $('[data-shop-count]'),
  crumb: $('[data-crumb-current]'),
  crumbSep: $('[data-crumb-sep]'),
  grid: $('[data-shop-grid]'),
  chips: $('[data-cat-chips]'),
  chipsMobile: $('[data-cat-chips-mobile]'),
  active: $('[data-active-filters]'),
  more: $('[data-shop-more]'),
  moreBtn: $('[data-load-more]'),
  progress: $('[data-shop-progress]'),
  bar: $('[data-shop-bar]'),
  sort: $('[data-sort]'),
  filterCount: $('[data-filter-count]'),
  form: $('[data-filters-form]'),
  apply: $('[data-filters-apply]'),
};

let meta = { departments: [], categories: [], colorFamilies: [] };
let facets = null;
let total = 0;
let loaded = 0;
let reqId = 0;

/* ---------------- Estado ⇄ URL ---------------- */
function readState() {
  const p = getParams();
  return {
    depto: p.get('depto') || '',
    cat: listParam(p, 'cat'),
    talla: listParam(p, 'talla'),
    color: listParam(p, 'color'),
    min: p.get('min') || '',
    max: p.get('max') || '',
    oferta: p.get('oferta') === '1',
    nuevo: p.get('nuevo') === '1',
    disponible: p.get('disponible') === '1',
    q: p.get('q') || '',
    orden: p.get('orden') || 'destacados',
    page: 1,
  };
}
let state = readState();

function writeState() {
  setParams({
    depto: state.depto, cat: state.cat, talla: state.talla, color: state.color,
    min: state.min, max: state.max, oferta: state.oferta ? '1' : '', nuevo: state.nuevo ? '1' : '',
    disponible: state.disponible ? '1' : '', q: state.q, orden: state.orden === 'destacados' ? '' : state.orden,
  });
}

const toQuery = (page = 1) => ({
  department: state.depto, category: state.cat, size: state.talla, color: state.color,
  minPrice: state.min, maxPrice: state.max, onSale: state.oferta, isNew: state.nuevo, inStock: state.disponible,
  q: state.q, sort: state.orden, page, pageSize: CATALOG.pageSize,
});

const activeFilterCount = () =>
  state.cat.length + state.talla.length + state.color.length + (state.min || state.max ? 1 : 0) + state.oferta + state.nuevo + state.disponible;

/* ---------------- Encabezado de la página ---------------- */
const catBySlug = (slug) => meta.categories.find((c) => c.slug === slug);
const deptBySlug = (slug) => meta.departments.find((d) => d.slug === slug);

function paintHero() {
  const dept = deptBySlug(state.depto);
  const cat = state.cat.length === 1 ? catBySlug(state.cat[0]) : null;
  let title = 'Toda la tienda';
  let desc = 'Ropa americana con etiqueta original para toda la familia.';
  if (state.q) { title = `«${state.q}»`; desc = 'Resultados de tu búsqueda.'; }
  else if (cat) { title = cat.name; desc = cat.description || dept?.description || desc; }
  else if (dept) { title = dept.name; desc = dept.description || desc; }
  else if (state.oferta) { title = 'Ofertas'; desc = 'Piezas seleccionadas con precio especial, mientras haya existencias.'; }
  else if (state.orden === 'nuevo') { title = 'Novedades'; desc = 'Lo último que llegó a Divani.'; }
  el.title.textContent = title;
  el.title.classList.toggle('is-query', !!state.q);
  el.desc.textContent = desc;
  const crumbs = [dept?.name, cat?.name, state.q && 'Búsqueda'].filter(Boolean).join(' / ');
  el.crumb.textContent = crumbs;
  el.crumbSep.hidden = !crumbs;
  document.title = `${state.q ? `Búsqueda: ${state.q}` : title} · Divani`;
}

function visibleCategories() {
  const d = state.depto || 'mujer';
  return meta.categories.filter((c) => c.department === d);
}

function paintChips() {
  const cats = visibleCategories();
  const tpl = html`
    <button class="chip" type="button" data-chip-cat="" aria-pressed="${String(!state.cat.length)}">Todo</button>
    ${cats.map((c) => html`<button class="chip" type="button" data-chip-cat="${c.slug}" aria-pressed="${String(state.cat.includes(c.slug))}">${c.name}${facets?.categories?.[c.slug] ? html` <span class="chip__count">${facets.categories[c.slug]}</span>` : ''}</button>`)}`;
  render(el.chips, tpl);
  render(el.chipsMobile, tpl);
}

function paintActive() {
  const pills = [];
  const pill = (label, key, value) => html`<button class="chip" type="button" data-remove="${key}" data-value="${value ?? ''}">${label}<svg class="icon" aria-hidden="true"><use href="#i-close"></use></svg></button>`;
  if (state.q) pills.push(pill(`Búsqueda: ${state.q}`, 'q'));
  state.cat.forEach((c) => pills.push(pill(catBySlug(c)?.name || c, 'cat', c)));
  state.talla.forEach((t) => pills.push(pill(`Talla ${t}`, 'talla', t)));
  state.color.forEach((c) => pills.push(pill(meta.colorFamilies.find((f) => f.id === c)?.name || c, 'color', c)));
  if (state.min || state.max) pills.push(pill(state.min && state.max ? `${money(state.min)} – ${money(state.max)}` : state.min ? `Desde ${money(state.min)}` : `Hasta ${money(state.max)}`, 'precio'));
  if (state.oferta) pills.push(pill('En oferta', 'oferta'));
  if (state.nuevo) pills.push(pill('Novedades', 'nuevo'));
  if (state.disponible) pills.push(pill('Disponibles', 'disponible'));
  render(el.active, pills.length ? html`${pills}<button class="link" type="button" data-clear-all>Limpiar todo</button>` : '');
  const n = activeFilterCount();
  el.filterCount.textContent = n ? String(n) : '';
  el.filterCount.dataset.count = String(n);
}

/* ---------------- Resultados ---------------- */
async function load({ append = false } = {}) {
  const my = ++reqId;
  const page = append ? state.page + 1 : 1;
  if (!append) {
    render(el.grid, cardSkeletons(8));
    el.more.hidden = true;
  } else {
    el.moreBtn.setAttribute('aria-disabled', 'true');
  }
  let res;
  try {
    res = await CatalogService.listProducts(toQuery(page));
  } catch {
    if (my !== reqId) return;
    render(el.grid, html`
      <div class="shop-error" style="grid-column:1/-1">
        <p>No pudimos cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.</p>
        <button class="btn btn--outline btn--sm" type="button" data-retry>Reintentar</button>
      </div>`);
    return;
  }
  if (my !== reqId) return;
  state.page = page;
  facets = res.facets;
  total = res.meta.total;
  remember(res.data);

  const cards = html`${res.data.map((p, i) => productCard(p, { index: i }))}`;
  if (append) {
    el.grid.insertAdjacentHTML('beforeend', cards.__html);
    loaded += res.data.length;
  } else {
    loaded = res.data.length;
    render(el.grid, total ? cards : emptyTpl());
  }
  observeReveal(el.grid);
  el.moreBtn.removeAttribute('aria-disabled');

  el.count.textContent = plural(total, 'pieza', 'piezas');
  el.more.hidden = total <= CATALOG.pageSize;
  el.moreBtn.hidden = loaded >= total;
  el.progress.textContent = `Mostrando ${loaded} de ${total}`;
  el.bar.style.setProperty('--p', total ? (loaded / total).toFixed(3) : 0);
  el.apply.textContent = total ? `Ver ${plural(total, 'resultado', 'resultados')}` : 'Sin resultados';

  paintHero();
  paintChips();
  paintActive();
  if (sheet('filters')?.el.open) paintFilters();
}

function emptyTpl() {
  return html`
    <div class="shop-empty" style="grid-column:1/-1">
      <span class="empty__icon glass round"><svg class="icon" aria-hidden="true"><use href="#i-search"></use></svg></span>
      <h2>No encontramos prendas con esos filtros</h2>
      <p>Prueba quitando algún filtro o explora otra categoría. También puedes preguntarnos por WhatsApp: con gusto te ayudamos a encontrar lo que buscas.</p>
      <div class="cluster" style="justify-content:center">
        <button class="btn btn--ink" type="button" data-clear-all>Limpiar filtros</button>
        <a class="btn btn--outline btn--wa" href="${waLink(greetingMessage())}" target="_blank" rel="noopener">
          <svg class="icon" aria-hidden="true"><use href="#i-whatsapp"></use></svg>Preguntar por WhatsApp
        </a>
      </div>
    </div>`;
}

/* ---------------- Hoja de filtros ---------------- */
function paintFilters() {
  const f = facets || { categories: {}, sizes: {}, colors: {}, price: { min: 0, max: 0 } };
  const cats = (state.depto ? meta.categories.filter((c) => c.department === state.depto) : meta.categories).filter((c) => f.categories[c.slug]);
  const sizes = Object.keys(f.sizes).sort((a, b) => (SIZE_ORDER.indexOf(a) + 1 || 99) - (SIZE_ORDER.indexOf(b) + 1 || 99));
  const colors = meta.colorFamilies.filter((c) => f.colors[c.id]);
  const deptName = (slug) => deptBySlug(slug)?.name;

  render(el.form, html`
    <div class="filters__group">
      <p class="filters__title">Categoría</p>
      <div class="filters__chips">
        ${cats.map((c) => html`<button class="chip" type="button" data-f-cat="${c.slug}" aria-pressed="${String(state.cat.includes(c.slug))}">${c.name}${!state.depto && c.department !== 'mujer' ? ` · ${deptName(c.department)}` : ''} <span class="chip__count">${f.categories[c.slug]}</span></button>`)}
      </div>
    </div>
    ${sizes.length ? html`
    <div class="filters__group">
      <p class="filters__title">Talla</p>
      <div class="filters__chips">
        ${sizes.map((s) => html`<button class="chip" type="button" data-f-size="${s}" aria-pressed="${String(state.talla.includes(s))}">${s}</button>`)}
      </div>
    </div>` : ''}
    ${colors.length ? html`
    <div class="filters__group">
      <p class="filters__title">Color</p>
      <div class="filters__chips">
        ${colors.map((c) => html`<button class="chip color-chip" type="button" data-f-color="${c.id}" aria-pressed="${String(state.color.includes(c.id))}"><span class="${c.hex === 'pattern' ? 'swatch swatch--pattern' : 'swatch'}" style="${c.hex === 'pattern' ? '' : `--c:${c.hex}`}"></span>${c.name}</button>`)}
      </div>
    </div>` : ''}
    <div class="filters__group">
      <p class="filters__title">Precio</p>
      <div class="filters__chips">
        ${PRICE_RANGES.map((r, i) => html`<button class="chip" type="button" data-f-range="${i}" aria-pressed="${String(String(state.min) === String(r.min) && String(state.max) === String(r.max))}">${r.label}</button>`)}
      </div>
      <div class="price-inputs">
        <label class="visually-hidden" for="f-min">Precio mínimo</label>
        <input class="input" id="f-min" name="min" type="number" inputmode="numeric" min="0" step="50" placeholder="${`Mín. ${money(f.price.min)}`}" value="${state.min}" />
        <span>—</span>
        <label class="visually-hidden" for="f-max">Precio máximo</label>
        <input class="input" id="f-max" name="max" type="number" inputmode="numeric" min="0" step="50" placeholder="${`Máx. ${money(f.price.max)}`}" value="${state.max}" />
      </div>
    </div>
    <div class="filters__group">
      <p class="filters__title">Mostrar</p>
      ${[['oferta', 'Solo ofertas'], ['nuevo', 'Solo novedades'], ['disponible', 'Ocultar agotados']].map(([k, label]) => html`
        <label class="switch-row" for="${`f-${k}`}">
          <span>${label}</span>
          <span class="switch"><input type="checkbox" id="${`f-${k}`}" data-f-switch="${k}" ${state[k] ? raw('checked') : ''} /><span></span></span>
        </label>`)}
    </div>`);
}

/* ---------------- Eventos ---------------- */
const reload = () => { writeState(); load(); };
const reloadSoon = debounce(reload, 350);

function toggleIn(list, v) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function bind() {
  const seg = segmented($('[data-dept-filter]'), {
    onChange: (btn) => {
      state.depto = btn.dataset.dept;
      state.cat = [];
      state.talla = [];
      reload();
    },
  });
  seg?.select(state.depto, 'dept');

  el.sort.value = state.orden;
  el.sort.addEventListener('change', () => { state.orden = el.sort.value; reload(); });

  const onChip = (e) => {
    const chip = e.target.closest('[data-chip-cat]');
    if (!chip) return;
    const v = chip.dataset.chipCat;
    state.cat = v ? toggleIn(state.cat, v) : [];
    if (v && !state.depto) state.depto = catBySlug(v)?.department || '';
    seg?.select(state.depto, 'dept');
    reload();
  };
  el.chips.addEventListener('click', onChip);
  el.chipsMobile.addEventListener('click', onChip);

  document.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const { remove: key, value } = rm.dataset;
      if (key === 'q') state.q = '';
      else if (key === 'precio') { state.min = ''; state.max = ''; }
      else if (Array.isArray(state[key])) state[key] = state[key].filter((x) => x !== value);
      else state[key] = false;
      reload();
      return;
    }
    if (e.target.closest('[data-clear-all]')) {
      const keepDept = state.depto;
      state = { ...readStateEmpty(), depto: keepDept, orden: state.orden };
      paintFilters();
      reload();
      return;
    }
    if (e.target.closest('[data-retry]')) load();
  });

  $('[data-open-filters]').addEventListener('click', () => {
    paintFilters();
    sheet('filters')?.open();
  });

  el.form.addEventListener('click', (e) => {
    const t = e.target;
    const cat = t.closest('[data-f-cat]');
    const size = t.closest('[data-f-size]');
    const color = t.closest('[data-f-color]');
    const range = t.closest('[data-f-range]');
    if (cat) state.cat = toggleIn(state.cat, cat.dataset.fCat);
    else if (size) state.talla = toggleIn(state.talla, size.dataset.fSize);
    else if (color) state.color = toggleIn(state.color, color.dataset.fColor);
    else if (range) {
      const r = PRICE_RANGES[+range.dataset.fRange];
      const same = String(state.min) === String(r.min) && String(state.max) === String(r.max);
      state.min = same ? '' : String(r.min);
      state.max = same ? '' : String(r.max);
    } else return;
    e.preventDefault();
    const btn = cat || size || color;
    if (btn) btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    reload();
  });
  el.form.addEventListener('change', (e) => {
    const sw = e.target.closest('[data-f-switch]');
    if (sw) { state[sw.dataset.fSwitch] = sw.checked; reload(); }
  });
  el.form.addEventListener('input', (e) => {
    if (e.target.name === 'min' || e.target.name === 'max') {
      state[e.target.name] = e.target.value.replace(/\D/g, '');
      reloadSoon();
    }
  });
  el.form.addEventListener('submit', (e) => e.preventDefault());
  $('[data-filters-clear]').addEventListener('click', () => {
    state = { ...readStateEmpty(), depto: state.depto, orden: state.orden, q: state.q };
    reload();
    paintFilters();
  });

  el.moreBtn.addEventListener('click', () => load({ append: true }));
}

function readStateEmpty() {
  return { depto: '', cat: [], talla: [], color: [], min: '', max: '', oferta: false, nuevo: false, disponible: false, q: '', orden: 'destacados', page: 1 };
}

/* ---------------- Inicio ---------------- */
(async function start() {
  try {
    meta = await CatalogService.getCategories();
  } catch { /* se muestran resultados sin nombres de categoría */ }
  bind();
  load();
})();
