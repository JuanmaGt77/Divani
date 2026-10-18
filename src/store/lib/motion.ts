/**
 * Animaciones de la tienda (fuera de React, para toda la página):
 *  - Aparición al hacer scroll: los elementos [data-reveal] reciben data-in al entrar en pantalla,
 *    también los que las islas pintan después de cargar datos.
 *  - Reflejo del vidrio que sigue al puntero (.glass--live, solo con mouse).
 * La clase js-motion se agrega desde un script en <head> para evitar parpadeos.
 */
import { reduceMotion } from './hydration';

const SELECTOR = '[data-reveal]:not([data-in]), [data-monogram]:not([data-in]), [data-phone]:not([data-in])';

export function initReveal(): void {
  const root = document.documentElement;
  (window as Window & { __divaniReady?: boolean }).__divaniReady = true;
  if (reduceMotion() || !('IntersectionObserver' in window)) {
    root.classList.remove('js-motion');
    return;
  }
  root.classList.add('js-motion');
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.setAttribute('data-in', '');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.08 },
  );
  const scan = (scope: ParentNode) => scope.querySelectorAll(SELECTOR).forEach((el) => io.observe(el));
  scan(document);
  // Las islas pintan tarjetas y secciones después de cargar datos
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        if (n.matches(SELECTOR)) io.observe(n);
        scan(n);
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
}

export function initGlassLight(): void {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let raf = 0;
  document.addEventListener(
    'pointermove',
    (e) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('.glass--live');
      if (!el || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    },
    { passive: true },
  );
}
