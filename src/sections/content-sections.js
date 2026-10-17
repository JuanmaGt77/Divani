/**
 * Secciones de contenido editable: carrusel de banners, «arma tu look» y preguntas frecuentes.
 */
import { html, render, emphasis } from '../core/dom.js';
import { money } from '../core/format.js';
import { reduceMotion, observeReveal } from '../core/motion.js';
import { cdn } from '../backend/model.js';
import { ContentService } from '../services/content.service.js';
import { CatalogService } from '../services/catalog.service.js';
import { lookMessage, waLink } from '../services/whatsapp.service.js';
import { remember } from '../components/product-card.js';
import { openProduct } from '../components/quick-view.js';

/* ---------- Carrusel de banners ---------- */
export async function initPromos() {
  const root = document.querySelector('[data-promo]');
  if (!root) return;
  const track = root.querySelector('[data-promo-track]');
  const dots = root.querySelector('[data-promo-dots]');
  let banners = [];
  try {
    banners = await ContentService.getBanners('home-carousel');
  } catch {
    root.hidden = true;
    return;
  }
  if (!banners.length) { root.hidden = true; return; }

  render(track, html`${banners.map((b, i) => html`
    <article class="promo__slide${i === 0 ? ' is-current' : ''}" aria-roledescription="diapositiva" aria-label="${`${i + 1} de ${banners.length}`}">
      <picture>
        ${b.imageMobile ? html`<source media="(max-width: 767px)" srcset="${cdn(b.imageMobile, { w: 900 })}" />` : ''}
        <img class="promo__img" src="${cdn(b.image, { w: 2000 })}" alt="" width="1600" height="900" ${i === 0 ? '' : html`loading="lazy"`} decoding="async" />
      </picture>
      <div class="promo__card glass glass--live">
        <p class="eyebrow">${b.eyebrow}</p>
        <h2 class="promo__title">${emphasis(b.title)}</h2>
        <p class="promo__text">${b.text}</p>
        <a class="btn btn--ink" href="${b.cta.href}">${b.cta.label}<svg class="icon" aria-hidden="true"><use href="#i-arrow-right"></use></svg></a>
      </div>
    </article>`)}`);
  render(dots, html`${banners.map((b, i) => html`<button class="promo__dot" type="button" aria-label="${`Ir a la promoción ${i + 1}`}" aria-current="${String(i === 0)}" data-dot="${i}"><span></span></button>`)}`);

  const slides = Array.from(track.children);
  let index = 0;
  let timer;
  const DUR = 6500;
  root.style.setProperty('--promo-dur', `${DUR}ms`);

  const go = (i, smooth = true) => {
    index = (i + slides.length) % slides.length;
    track.scrollTo({ left: track.clientWidth * index, behavior: smooth ? 'smooth' : 'auto' });
  };
  const mark = (i) => {
    slides.forEach((s, k) => s.classList.toggle('is-current', k === i));
    dots.querySelectorAll('[data-dot]').forEach((d, k) => {
      d.setAttribute('aria-current', String(k === i));
      if (k === i) { const s = d.firstElementChild; s.style.animation = 'none'; void s.offsetWidth; s.style.animation = ''; }
    });
  };
  const schedule = () => {
    clearTimeout(timer);
    if (reduceMotion() || root.classList.contains('is-paused')) return;
    timer = setTimeout(() => go(index + 1), DUR);
  };

  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    if (i !== index || !slides[i].classList.contains('is-current')) { index = i; mark(i); schedule(); }
  }, { passive: true });
  root.querySelector('[data-promo-prev]')?.addEventListener('click', () => go(index - 1));
  root.querySelector('[data-promo-next]')?.addEventListener('click', () => go(index + 1));
  dots.addEventListener('click', (e) => { const d = e.target.closest('[data-dot]'); if (d) go(+d.dataset.dot); });
  const pause = () => { root.classList.add('is-paused'); clearTimeout(timer); };
  const resume = () => { root.classList.remove('is-paused'); schedule(); };
  root.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') pause(); });
  root.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') resume(); });
  root.addEventListener('focusin', pause);
  root.addEventListener('focusout', resume);
  window.addEventListener('resize', () => go(index, false));
  // Solo avanza cuando está en pantalla
  new IntersectionObserver(([en]) => (en.isIntersecting ? resume() : pause()), { threshold: 0.3 }).observe(root);
  mark(0);
}

/* ---------- Arma tu look ---------- */
export async function initLookbook() {
  const root = document.querySelector('[data-look]');
  if (!root) return;
  let look, products;
  try {
    [look] = await ContentService.getLookbooks();
    products = remember(await CatalogService.getMany(look.hotspots.map((h) => h.product)));
  } catch {
    root.closest('section').hidden = true;
    return;
  }
  const bySlug = Object.fromEntries(products.map((p) => [p.slug, p]));
  const pieces = look.hotspots.map((h) => {
    const p = bySlug[h.product];
    if (!p) return null;
    const color = p.colors.find((c) => c.name === h.color) || p.colors[0];
    return { ...h, p, color };
  }).filter(Boolean);
  const total = pieces.reduce((a, x) => a + x.p.price, 0);
  const wa = waLink(lookMessage(look.title, pieces.map((x) => ({ name: x.p.name, color: x.color.name, price: x.p.price }))));

  render(root, html`
    <figure class="look__media" data-reveal="scale">
      <img src="${cdn(look.image, { w: 1400 })}" alt="${`Look: ${pieces.map((x) => x.p.name).join(', ')}`}" width="1200" height="1000" loading="lazy" decoding="async" />
      ${pieces.map((x, i) => html`
        <button class="hotspot" type="button" style="${`--x:${x.x}%;--y:${x.y}%`}" data-hotspot="${i}" aria-expanded="false" aria-label="${`Ver ${x.p.name}`}">
          <span class="hotspot__dot glass"><svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg></span>
        </button>`)}
    </figure>
    <div class="look__info">
      <p class="eyebrow">${look.eyebrow}</p>
      <h2 class="look__title">${emphasis(look.title)}</h2>
      <p class="lead">${look.text}</p>
      <div class="look__list">
        ${pieces.map((x, i) => html`
          <button class="look-item" type="button" data-look-item="${i}" data-product-link="${x.p.slug}">
            <img src="${cdn(x.color.images[0], { w: 160 })}" alt="" width="60" height="75" loading="lazy" />
            <span><span class="look-item__name">${x.p.name}</span><br /><span class="look-item__meta">${x.color.name}</span></span>
            <span class="look-item__price">${money(x.p.price)}</span>
          </button>`)}
      </div>
      <div class="look__total"><span>Look completo</span><strong>${money(total)}</strong></div>
      <div class="look__actions">
        <a class="btn btn--ink btn--wa" href="${wa}" target="_blank" rel="noopener">
          <svg class="icon" aria-hidden="true"><use href="#i-whatsapp"></use></svg>
          Pedir el look por WhatsApp
        </a>
      </div>
    </div>`);
  observeReveal(root);

  const spots = Array.from(root.querySelectorAll('[data-hotspot]'));
  const items = Array.from(root.querySelectorAll('[data-look-item]'));
  const activate = (i) => {
    spots.forEach((s, k) => s.setAttribute('aria-expanded', String(k === i)));
    items.forEach((it, k) => it.classList.toggle('is-active', k === i));
  };
  spots.forEach((s, i) => {
    s.addEventListener('pointerenter', () => activate(i));
    s.addEventListener('focus', () => activate(i));
    s.addEventListener('click', () => { activate(i); openProduct(pieces[i].p.slug, { color: pieces[i].color.name }); });
  });
  items.forEach((it, i) => it.addEventListener('pointerenter', () => activate(i)));
  root.querySelector('.look__media').addEventListener('pointerleave', () => activate(-1));
}

/* ---------- Preguntas frecuentes ---------- */
export async function initFaq() {
  const el = document.querySelector('[data-faq]');
  if (!el) return;
  try {
    const faq = await ContentService.getFaq();
    render(el, html`${faq.map((f, i) => html`
      <details ${i === 0 ? html`open` : ''}>
        <summary>${f.q}<svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg></summary>
        <div class="accordion__body"><p style="white-space:pre-line">${f.a}</p></div>
      </details>`)}`);
  } catch {
    el.closest('section').hidden = true;
  }
}

