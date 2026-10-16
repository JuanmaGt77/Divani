/**
 * Controlador de hojas (<dialog class="sheet" id="sheet-xxx">).
 *  - Abre/cierra con animación, bloquea el scroll del fondo y devuelve el foco.
 *  - Cierra con Esc, tocando fuera del panel o con cualquier [data-close].
 *  - En celular se puede arrastrar hacia abajo para cerrar (tirador o encabezado).
 */
import { emit } from '../core/emitter.js';

const registry = new Map();
const stack = [];
const CLOSE_MS = 420;

export function sheet(id) {
  if (registry.has(id)) return registry.get(id);
  const dlg = document.getElementById(`sheet-${id}`);
  if (!dlg) return null;
  const panel = dlg.querySelector('.sheet__panel');
  let lastFocus = null;
  let closeTimer = null;

  const api = {
    id,
    el: dlg,
    panel,
    get isOpen() { return dlg.open && dlg.classList.contains('is-open'); },

    open({ focus } = {}) {
      clearTimeout(closeTimer);
      if (!dlg.open) {
        lastFocus = document.activeElement;
        try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
        stack.push(api);
      }
      document.documentElement.classList.add('is-locked');
      // Enfoca el panel (no el primer botón) para que el lector de pantalla empiece arriba
      panel.setAttribute('tabindex', '-1');
      if (!focus) panel.focus({ preventScroll: true });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        dlg.classList.add('is-open');
        if (focus) (typeof focus === 'string' ? dlg.querySelector(focus) : focus)?.focus({ preventScroll: true });
      }));
      emit('sheet:open', { id });
      return api;
    },

    close() {
      if (!dlg.open) return;
      dlg.classList.remove('is-open');
      panel.style.removeProperty('--drag');
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        dlg.close();
        const i = stack.indexOf(api);
        if (i >= 0) stack.splice(i, 1);
        if (!stack.length) document.documentElement.classList.remove('is-locked');
        lastFocus?.focus?.({ preventScroll: true });
        emit('sheet:close', { id });
      }, CLOSE_MS);
    },

    toggle() { return api.isOpen ? api.close() : api.open(); },
  };

  // Tocar fuera del panel
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) api.close();
    else if (e.target.closest('[data-close]')) api.close();
  });
  // Tecla Esc
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    api.close();
  });

  enableDrag(api);
  registry.set(id, api);
  return api;
}

export const closeAllSheets = () => [...stack].forEach((s) => s.close());

/* Arrastrar hacia abajo para cerrar (solo hojas inferiores en celular) */
function enableDrag(api) {
  const { el: dlg, panel } = api;
  const handles = panel.querySelectorAll('[data-grabber], .sheet__head');
  if (!handles.length) return;
  const mobile = matchMedia('(max-width: 767px)');
  let startY = 0, dy = 0, t0 = 0, active = false;

  const onMove = (e) => {
    if (!active) return;
    dy = Math.max(0, e.clientY - startY);
    panel.style.setProperty('--drag', `${dy}px`);
  };
  const onUp = () => {
    if (!active) return;
    active = false;
    dlg.classList.remove('is-dragging');
    const v = dy / Math.max(1, performance.now() - t0);
    if (dy > 120 || v > 0.6) api.close();
    else panel.style.setProperty('--drag', '0px');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };

  handles.forEach((h) => {
    h.style.touchAction = 'none';
    h.addEventListener('pointerdown', (e) => {
      if (!mobile.matches || e.button !== 0 || e.target.closest('button, a, input')) return;
      active = true;
      startY = e.clientY;
      dy = 0;
      t0 = performance.now();
      dlg.classList.add('is-dragging');
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });
  });
}
