/**
 * Fotos y textos de la portada que se editan en el panel (Sitio web → Portada).
 * Cada elemento editable lleva data-slot="seccion.campo"; si el panel aún no tiene
 * un valor, se queda el que viene escrito en el HTML.
 */
import { html, render, emphasis, toString } from '../core/dom.js';
import { cdn } from '../backend/model.js';
import { fillMarquee } from '../components/header.js';
import { ContentService } from '../services/content.service.js';
import { cachedPayload } from '../services/api/supabase.adapter.js';
import { dataSource } from '../services/api/index.js';
import { isEditMode } from '../core/edit-bridge.js';
import { setHeroMedia } from './hero.js';

let last = '';

function setImage(el, value) {
  const src = cdn(value, { w: Number(el.dataset.w) || 1600 });
  if (el.getAttribute('src') !== src) el.setAttribute('src', src);
}

function fillRibbon(track, items) {
  if (!track || !items?.length) return;
  track.innerHTML = items.map((t) => `<span>${toString(emphasis(t))}</span>`).join('');
  fillMarquee(track);
}

export function applyContent(content) {
  if (!content || typeof content !== 'object') return;
  const key = JSON.stringify(content);
  if (key === last) return;
  last = key;

  document.querySelectorAll('[data-slot]').forEach((el) => {
    const [section, field] = el.dataset.slot.split('.');
    const group = content[section];
    if (!group || !(field in group)) return;
    const value = group[field];
    if (el.tagName === 'IMG') {
      if (value) setImage(el, value);
      return;
    }
    const empty = value == null || value === '' || (Array.isArray(value) && !value.length);
    el.hidden = empty;
    if (empty) return;
    if (field === 'paragraphs') render(el, html`${value.map((p, i) => html`<p class="${i === 0 ? 'lead' : ''}">${p}</p>`)}`);
    else if (el.hasAttribute('data-emph')) render(el, emphasis(value));
    else el.textContent = value;
  });

  if (content.ribbons) {
    fillRibbon(document.querySelector('[data-ribbon="primary"]'), content.ribbons.primary);
    fillRibbon(document.querySelector('[data-ribbon="secondary"]'), content.ribbons.secondary);
  }
  if (content.hero) setHeroMedia(content.hero);
}

/** Pinta al instante con lo último que se vio (Supabase) y luego con lo más reciente. */
export function initSiteContent() {
  if (dataSource === 'supabase' && !isEditMode) applyContent(cachedPayload()?.data?.content);
  return ContentService.getContent().then(applyContent).catch(() => {});
}
