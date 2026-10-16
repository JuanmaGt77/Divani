/** Flechas para los carriles horizontales de productos. */
export function railArrows(name) {
  const rail = document.querySelector(`[data-rail="${name}"]`);
  const arrows = document.querySelector(`[data-rail-arrows="${name}"]`);
  if (!rail || !arrows) return;
  const prev = arrows.querySelector('[data-rail-prev]');
  const next = arrows.querySelector('[data-rail-next]');
  const step = () => Math.max(260, rail.clientWidth * 0.75);
  prev?.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
  next?.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));
  const update = () => {
    const max = rail.scrollWidth - rail.clientWidth - 4;
    if (prev) prev.disabled = rail.scrollLeft <= 4;
    if (next) next.disabled = rail.scrollLeft >= max;
  };
  rail.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(rail);
  update();
}
