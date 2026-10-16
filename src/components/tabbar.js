/** Barra inferior estilo iOS 26: marca la pestaña activa y se compacta al bajar. */
export function initTabbar(active) {
  const bar = document.querySelector('[data-tabbar]');
  if (!bar) return;
  if (active) bar.querySelector(`[data-tab="${active}"]`)?.setAttribute('aria-current', 'page');

  let last = window.scrollY;
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    if (Math.abs(y - last) > 6) {
      bar.classList.toggle('is-min', y > last && y > 160);
      last = y;
    }
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
}

/** El botón flotante de WhatsApp muestra su texto unos segundos al llegar. */
export function initWaFab() {
  const fab = document.querySelector('.wa-fab');
  if (!fab) return;
  setTimeout(() => {
    fab.classList.add('is-expanded');
    setTimeout(() => fab.classList.remove('is-expanded'), 4200);
  }, 2600);
}
