/**
 * Notificaciones tipo Dynamic Island: una píldora negra que se expande arriba al centro.
 * notify({ title, sub, image, icon, action: { label, onClick } })
 */
import { esc } from '../core/dom.js';

let el, content, timer;
const DURATION = 3400;

function ensure() {
  if (el) return true;
  el = document.querySelector('[data-island]');
  content = el?.querySelector('[data-island-content]');
  if (!el) return false;
  el.addEventListener('pointerenter', () => clearTimeout(timer));
  el.addEventListener('pointerleave', () => schedule());
  return true;
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(close, DURATION);
}

export function close() {
  el?.classList.remove('is-open');
}

export function notify({ title, sub = '', image = '', icon = 'check', action = null }) {
  if (!ensure()) return;
  const media = image
    ? `<img class="island__thumb" src="${esc(image)}" alt="" />`
    : `<span class="island__icon"><svg class="icon" aria-hidden="true"><use href="#i-${esc(icon)}"></use></svg></span>`;
  content.innerHTML = `${media}<span class="island__text"><span class="island__title">${esc(title)}</span>${sub ? `<span class="island__sub">${esc(sub)}</span>` : ''}</span>${action ? `<button class="island__btn" type="button">${esc(action.label)}</button>` : ''}`;
  if (action) {
    content.querySelector('.island__btn').addEventListener('click', () => {
      close();
      action.onClick?.();
    }, { once: true });
  }
  el.classList.remove('is-open');
  void el.offsetWidth; // reinicia la animación si ya estaba abierta
  el.classList.add('is-open');
  schedule();
}
