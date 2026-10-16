/**
 * Control segmentado con "lente" que se desliza (estilo iOS).
 * segmented(root, { onChange(btn) })
 */
export function segmented(root, { onChange } = {}) {
  if (!root) return null;
  const thumb = root.querySelector('.segmented__thumb');
  const buttons = () => Array.from(root.querySelectorAll('.segmented__btn'));
  const current = () => buttons().find((b) => b.getAttribute('aria-selected') === 'true') || buttons()[0];

  function place(btn) {
    if (!thumb || !btn) return;
    thumb.style.setProperty('--x', `${btn.offsetLeft}px`);
    thumb.style.setProperty('--w', `${btn.offsetWidth}px`);
  }

  function select(btn, { silent = false } = {}) {
    if (!btn) return;
    buttons().forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    place(btn);
    if (root.scrollWidth > root.clientWidth) {
      root.scrollTo({ left: btn.offsetLeft - root.clientWidth / 2 + btn.offsetWidth / 2, behavior: 'smooth' });
    }
    if (!silent) onChange?.(btn);
  }

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.segmented__btn');
    if (btn && root.contains(btn) && btn.getAttribute('aria-selected') !== 'true') select(btn);
  });
  root.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const list = buttons();
    const i = list.indexOf(document.activeElement);
    if (i < 0) return;
    const next = list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
    next.focus();
    select(next);
  });

  // Reposiciona si cambia el tamaño (fuentes, rotación de pantalla)
  if ('ResizeObserver' in window) new ResizeObserver(() => place(current())).observe(root);
  document.fonts?.ready.then(() => place(current()));
  place(current());

  return {
    select: (value, key = 'value') => select(buttons().find((b) => b.dataset[key] === value), { silent: true }),
    refresh: () => place(current()),
  };
}
