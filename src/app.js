/**
 * Arranque común a todas las páginas: estilos, encabezado, hojas, bolsa, favoritos,
 * búsqueda, vista rápida y acciones delegadas de las tarjetas de producto.
 */
import './styles/main.css';
import { on } from './core/dom.js';
import { getParams } from './core/url.js';
import { initReveal, initGlassLight } from './core/motion.js';
import { cart } from './store/cart.store.js';
import { favorites } from './store/favorites.store.js';
import { initHeader } from './components/header.js';
import { initTabbar, initWaFab } from './components/tabbar.js';
import { sheet } from './components/sheet.js';
import { notify } from './components/island.js';
import { initCart, openCart } from './components/cart.js';
import { initFavorites, openFavorites } from './components/favorites.js';
import { initSearch, openSearch } from './components/search.js';
import { initSizeGuide, openSizeGuide } from './components/size-guide.js';
import { initQuickView, openProduct } from './components/quick-view.js';
import { productCache, switchCardColor } from './components/product-card.js';
import { CatalogService } from './services/catalog.service.js';
import { ContentService } from './services/content.service.js';
import { siteTexts } from './components/header.js';
import { initEditBridge } from './core/edit-bridge.js';
import { cdn } from './backend/model.js';

const openers = {
  menu: () => sheet('menu')?.open(),
  search: openSearch,
  cart: openCart,
  favorites: openFavorites,
  sizes: () => openSizeGuide(),
};

function delegatedActions() {
  // Abrir hojas: <button data-open="cart">
  on(document, 'click', '[data-open]', (e, el) => {
    const fn = openers[el.dataset.open];
    if (!fn) return;
    e.preventDefault();
    // Si viene desde el menú móvil, ciérralo primero
    if (el.closest('#sheet-menu') && el.dataset.open !== 'menu') sheet('menu')?.close();
    fn();
  });

  // Los enlaces dentro del menú móvil cierran la hoja al navegar a un ancla de esta página
  on(document, 'click', '#sheet-menu a[href*="#"]', () => sheet('menu')?.close());

  // Vista rápida al tocar un producto (Ctrl/⌘ + clic abre la tienda en otra pestaña)
  on(document, 'click', '[data-product-link]', (e, el) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    const card = el.closest('[data-card]');
    const fromSheet = el.closest('dialog');
    if (fromSheet && fromSheet.id !== 'sheet-product') sheet(fromSheet.id.replace('sheet-', ''))?.close();
    openProduct(el.dataset.productLink, { color: card?.dataset.color });
  });

  on(document, 'click', '[data-quick]', (e, el) => {
    e.preventDefault();
    const card = el.closest('[data-card]');
    openProduct(el.dataset.quick, { color: card?.dataset.color });
  });

  // Agregar rápido por talla desde la tarjeta
  on(document, 'click', '[data-quick-add]', async (e, el) => {
    e.preventDefault();
    const slug = el.dataset.quickAdd;
    const p = productCache.get(slug) || (await CatalogService.getProduct(slug));
    if (!p) return;
    const card = el.closest('[data-card]');
    const color = p.colors.find((c) => c.name === card?.dataset.color) || p.colors[0];
    if (!cart.add(p, { color: color.name, size: el.dataset.size, qty: 1 })) {
      notify({ title: 'Esa talla se agotó en este color', sub: 'Toca la prenda para ver otras opciones.', icon: 'info' });
      return;
    }
    notify({
      title: 'Agregado a tu bolsa',
      sub: `${p.name} · ${color.name} · ${el.dataset.size}`,
      image: cdn(color.images[0], { w: 160 }),
      action: { label: 'Ver bolsa', onClick: openCart },
    });
  });

  // Cambiar el color mostrado en la tarjeta
  on(document, 'click', '[data-card-color]', (e, el) => {
    e.preventDefault();
    const card = el.closest('[data-card]');
    if (card) switchCardColor(card, +el.dataset.cardColor);
  });

  // Favoritos
  on(document, 'click', '[data-fav]', (e, el) => {
    e.preventDefault();
    const slug = el.dataset.fav;
    const added = favorites.toggle(slug);
    const p = productCache.get(slug);
    document.querySelectorAll(`[data-fav="${CSS.escape(slug)}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', String(added));
      if (b.classList.contains('card__fav')) {
        b.setAttribute('aria-label', `${added ? 'Quitar' : 'Agregar'} ${p?.name || 'prenda'} ${added ? 'de' : 'a'} favoritos`);
        b.classList.remove('is-pop');
        void b.offsetWidth;
        if (added) b.classList.add('is-pop');
      }
    });
    if (added) {
      notify({
        title: 'Guardado en favoritos',
        sub: p?.name || '',
        image: cdn(p?.colors?.[0]?.images?.[0] || '', { w: 160 }),
        icon: 'heart',
        action: { label: 'Ver', onClick: openFavorites },
      });
    }
  });
}

/** Abre la vista rápida si la URL trae ?p=slug (enlaces compartidos). */
function deepLink() {
  const slug = getParams().get('p');
  if (slug) setTimeout(() => openProduct(slug), 350);
}

/** Ajustes del panel: WhatsApp, horario, redes y región (moneda, a dónde se envía…). */
function settingsFromPanel() {
  ContentService.getSettings().then(siteTexts).catch(() => {});
}

/** Oculta los departamentos que se apagaron en el panel (menú, pie de página y menú del celular). */
function departmentsFromPanel() {
  CatalogService.getCategories().then(({ departments }) => {
    if (!departments?.length) return;
    const on = new Set(departments.map((d) => d.slug));
    document.querySelectorAll('a[href*="depto="]').forEach((a) => {
      if (a.closest('main')) return;
      const dep = new URL(a.href, location.href).searchParams.get('depto');
      if (dep && !on.has(dep)) (a.closest('li') || a).hidden = true;
    });
  }).catch(() => {});
}

export function initApp({ tab } = {}) {
  window.__divaniReady = true;
  initEditBridge();
  settingsFromPanel();
  departmentsFromPanel();
  initReveal();
  initGlassLight();
  initHeader();
  initTabbar(tab);
  initWaFab();
  initCart();
  initFavorites();
  initSearch();
  initSizeGuide();
  initQuickView();
  delegatedActions();
  deepLink();
}
