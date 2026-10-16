// Animaciones al hacer scroll y reflejo del vidrio que sigue al puntero.

export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let io = null;

/** Activa las apariciones [data-reveal]. La clase js-motion se agrega desde un script en <head>. */
export function initReveal() {
  const root = document.documentElement;
  if (reduceMotion() || !('IntersectionObserver' in window)) {
    root.classList.remove('js-motion');
    return;
  }
  root.classList.add('js-motion');
  io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
  observeReveal();
}

/** Observa elementos nuevos (por ejemplo, tarjetas que se pintan después de cargar datos). */
export function observeReveal(scope = document) {
  if (!io) return;
  scope.querySelectorAll('[data-reveal]:not(.is-in), [data-monogram]:not(.is-in), [data-phone]:not(.is-in)').forEach((el) => io.observe(el));
}

/** Reflejo especular que sigue al puntero sobre el vidrio (solo con mouse). */
export function initGlassLight() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let raf = 0;
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('.glass--live');
    if (!el || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }, { passive: true });
}
