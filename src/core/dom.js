// Utilidades mínimas de DOM y plantillas.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Marca un string como HTML seguro (no se escapa dentro de `html```). */
export const raw = (s) => ({ __html: String(s ?? '') });

/**
 * Plantilla con escape automático:
 *   html`<p>${nombre}</p>`            → escapa nombre
 *   html`<ul>${items.map(...)}</ul>`  → arreglos de plantillas se unen
 */
export function html(strings, ...values) {
  let out = '';
  strings.forEach((str, i) => {
    out += str;
    if (i < values.length) out += serialize(values[i]);
  });
  return raw(out);
}
function serialize(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(serialize).join('');
  if (typeof v === 'object' && '__html' in v) return v.__html;
  return esc(v);
}
export const toString = (tpl) => (typeof tpl === 'object' && tpl && '__html' in tpl ? tpl.__html : String(tpl ?? ''));

export function render(el, tpl) {
  if (el) el.innerHTML = toString(tpl);
  return el;
}

/** Texto con *énfasis* → <em>énfasis</em> (para títulos que vienen de datos). */
export function emphasis(text) {
  return raw(esc(text).replace(/\*(.+?)\*/g, '<em>$1</em>'));
}

/** Delegación de eventos: on(document, 'click', '[data-x]', (e, el) => …) */
export function on(root, type, selector, handler, opts) {
  root.addEventListener(type, (e) => {
    const el = e.target.closest?.(selector);
    if (el && root.contains(el)) handler(e, el);
  }, opts);
}

export const icon = (name, cls = '') => raw(`<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`);

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
