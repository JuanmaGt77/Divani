/**
 * Encabezado: estado al hacer scroll, contadores, cinta de avisos, mega menú,
 * enlaces de WhatsApp y redes sociales.
 */
import { $, $$, html, render, toString } from '../core/dom.js';
import { getParams } from '../core/url.js';
import { SITE } from '../config/site.config.js';
import { CatalogService } from '../services/catalog.service.js';
import { ContentService } from '../services/content.service.js';
import { waLink, greetingMessage, vipMessage } from '../services/whatsapp.service.js';
import { cart } from '../store/cart.store.js';
import { favorites } from '../store/favorites.store.js';

function scrollState() {
  const header = $('[data-header]');
  if (!header) return;
  let ticking = false;
  const update = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 24);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
}

function counters() {
  const bump = (sel, n) => $$(sel).forEach((el) => {
    const prev = el.dataset.count;
    el.textContent = n > 9 ? '9+' : n ? String(n) : '';
    el.dataset.count = String(n);
    if (prev !== undefined && +prev < n) {
      el.classList.remove('is-bump');
      void el.offsetWidth;
      el.classList.add('is-bump');
    }
  });
  cart.subscribe(() => bump('[data-cart-count]', cart.count));
  favorites.subscribe(() => bump('[data-fav-count]', favorites.count));
}

/** Rellena la cinta superior y las cintas cruzadas para un desplazamiento continuo. */
export function fillMarquee(track, items = null) {
  if (!track) return;
  if (items) track.innerHTML = items.map((t) => `<span class="announce__item">${t}</span>`).join('');
  const base = Array.from(track.children).map((n) => n.outerHTML).join('');
  if (!base) return;
  // Repite hasta cubrir al menos 1.2 pantallas y luego duplica (para el bucle sin saltos)
  let out = base;
  track.innerHTML = out;
  let guard = 0;
  while (track.scrollWidth < window.innerWidth * 1.2 && guard++ < 12) {
    out += base;
    track.innerHTML = out;
  }
  track.innerHTML = out + out;
  // Velocidad constante sin importar el largo del texto
  const half = track.scrollWidth / 2;
  track.style.setProperty('--marquee-dur', `${Math.max(18, half / 42)}s`);
  Array.from(track.children).slice(track.children.length / 2).forEach((n) => n.setAttribute('aria-hidden', 'true'));
}

async function announcements() {
  const track = $('[data-announce]');
  if (!track) return;
  try {
    const s = await ContentService.getSettings();
    const list = (s?.announcements || []).map((t) => t.replace(/[<>&]/g, ''));
    fillMarquee(track, list.length ? list : null);
  } catch {
    fillMarquee(track);
  }
}

export function whatsappLinks() {
  const messages = { greeting: greetingMessage(), vip: vipMessage() };
  $$('[data-wa]').forEach((a) => {
    const key = a.dataset.wa;
    a.href = waLink(messages[key] ?? key);
  });
  $$('[data-wa-display]').forEach((el) => { el.textContent = SITE.whatsapp.display; });
  $$('[data-site-hours]').forEach((el) => { el.textContent = SITE.hours; });
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
}

function socialLinks() {
  const labels = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };
  const links = Object.entries(SITE.social).filter(([, url]) => url);
  $$('[data-social]').forEach((box) => {
    render(box, html`${links.map(([k, url]) => html`<a href="${url}" target="_blank" rel="noopener" aria-label="${`${SITE.name} en ${labels[k] || k}`}"><svg class="icon" aria-hidden="true"><use href="${`#i-${k}`}"></use></svg></a>`)}`);
  });
}

function activeNav() {
  const p = getParams();
  const dept = p.get('depto');
  const isShop = /tienda\.html$/.test(location.pathname);
  $$('.site-nav__link').forEach((a) => {
    const target = new URL(a.href, location.href).searchParams;
    const on = isShop && ((dept && target.get('depto') === dept) || (!dept && p.get('orden') === 'nuevo' && target.get('orden') === 'nuevo'));
    if (on) a.setAttribute('aria-current', 'page');
  });
}

/* ---------- Mega menú (escritorio) ---------- */
async function megaMenu() {
  const panel = $('[data-mega-panel]');
  const links = $$('[data-mega]');
  if (!panel || !links.length || !matchMedia('(hover: hover) and (min-width: 1024px)').matches) return;
  let data;
  try { data = await CatalogService.getCategories(); } catch { return; }
  let openTimer, closeTimer, currentLink = null;

  const paint = (dept) => {
    const d = data.departments.find((x) => x.slug === dept);
    const cats = data.categories.filter((c) => c.department === dept);
    const cards = dept === 'mujer'
      ? cats.filter((c) => ['vestidos', 'abrigos-y-chamarras'].includes(c.slug))
      : [{ name: `Ver ${d.name.toLowerCase()}`, image: d.image, slug: '' }];
    return toString(html`
      <div class="mega__grid">
        <div class="mega__intro">
          <p class="eyebrow">${d.name}</p>
          <p class="mega__title">${d.name}</p>
          <p class="mega__desc">${d.description || ''}</p>
          <a class="link" href="${`tienda.html?depto=${dept}`}">Ver todo <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"></use></svg></a>
        </div>
        <nav class="mega__list" aria-label="${`Categorías de ${d.name}`}">
          ${cats.map((c) => html`<a href="${`tienda.html?depto=${dept}&cat=${c.slug}`}"><span>${c.name}</span><small>${c.productCount}</small></a>`)}
          <a href="${`tienda.html?depto=${dept}&oferta=1`}"><span>Ofertas</span><small>%</small></a>
        </nav>
        <div class="mega__cards">
          ${cards.slice(0, 2).map((c) => html`<a class="mega-card" href="${`tienda.html?depto=${dept}${c.slug ? `&cat=${c.slug}` : ''}`}"><img src="${c.image}" alt="" loading="lazy" /><span class="glass">${c.name}</span></a>`)}
        </div>
      </div>`);
  };

  const open = (link) => {
    clearTimeout(closeTimer);
    if (currentLink === link && !panel.hidden) return;
    currentLink?.setAttribute('aria-expanded', 'false');
    currentLink = link;
    link.setAttribute('aria-expanded', 'true');
    panel.innerHTML = paint(link.dataset.mega);
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('is-open'));
  };
  const close = () => {
    panel.classList.remove('is-open');
    currentLink?.setAttribute('aria-expanded', 'false');
    currentLink = null;
    setTimeout(() => { if (!panel.classList.contains('is-open')) panel.hidden = true; }, 300);
  };

  links.forEach((link) => {
    link.setAttribute('aria-expanded', 'false');
    link.addEventListener('pointerenter', () => { clearTimeout(openTimer); openTimer = setTimeout(() => open(link), 110); });
    link.addEventListener('pointerleave', () => { clearTimeout(openTimer); closeTimer = setTimeout(close, 220); });
    link.addEventListener('focus', () => open(link));
  });
  panel.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  panel.addEventListener('pointerleave', () => { closeTimer = setTimeout(close, 220); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('scroll', () => { if (!panel.hidden) close(); }, { passive: true });
  $$('.site-nav__link:not([data-mega]), .site-logo, .site-actions').forEach((el) => el.addEventListener('pointerenter', close));
}

export function initHeader() {
  scrollState();
  counters();
  announcements();
  whatsappLinks();
  socialLinks();
  activeNav();
  megaMenu();
}
