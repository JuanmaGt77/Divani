/**
 * Modo edición (solo dentro de la vista previa del panel: /?editar=1 en un iframe del mismo sitio).
 * Resalta cada sección editable al pasar el cursor y, al tocarla, le avisa al panel cuál
 * abrir. Los enlaces no navegan para que la vista previa se quede en la portada.
 */
import { isEditMode } from './hydration';

const LABELS: Record<string, string> = {
  announcements: 'Cinta de avisos',
  ribbons: 'Cintas cruzadas',
  categories: 'Compra por categoría',
  products: 'Productos',
  banners: 'Portada',
  look: 'Arma tu look',
  editorial: 'Banda editorial',
  kids: 'Niñas y niños',
  about: 'Acerca de nosotros',
  men: 'Hombre',
  faq: 'Preguntas frecuentes',
  vip: 'Lista VIP',
  store: 'Pie de página y contacto',
};

const post = (msg: object) => window.parent.postMessage(msg, location.origin);

export function initEditBridge(): void {
  if (!isEditMode()) return;
  document.documentElement.classList.add('is-editing');

  const box = document.createElement('div');
  box.className = 'edit-outline';
  box.innerHTML =
    '<span class="edit-outline__label"><svg class="icon" aria-hidden="true"><use href="#i-sparkle"></use></svg><span></span></span>';
  box.hidden = true;
  document.body.append(box);
  const label = box.querySelector('.edit-outline__label span') as HTMLElement;
  let current: HTMLElement | null = null;

  const place = (el: HTMLElement | null) => {
    current = el;
    if (!el) {
      box.hidden = true;
      return;
    }
    const r = el.getBoundingClientRect();
    box.hidden = false;
    box.style.transform = `translate(${Math.max(0, r.left)}px, ${Math.max(0, r.top)}px)`;
    box.style.width = `${Math.min(window.innerWidth, r.right) - Math.max(0, r.left)}px`;
    box.style.height = `${Math.min(window.innerHeight, r.bottom) - Math.max(0, r.top)}px`;
    label.textContent = `Editar · ${LABELS[el.dataset.edit || ''] || 'Sección'}`;
  };

  document.addEventListener(
    'pointerover',
    (e) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('[data-edit]') || null;
      if (el !== current) place(el);
    },
    { passive: true },
  );
  document.addEventListener('pointerleave', () => place(null));
  window.addEventListener('scroll', () => current && place(current), { passive: true });
  window.addEventListener('resize', () => current && place(current));

  // Tocar una sección abre su editor en el panel; nada navega fuera de la portada
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element;
      const el = t.closest<HTMLElement>('[data-edit]');
      const link = t.closest('a, button, summary, label');
      if (el) {
        e.preventDefault();
        e.stopPropagation();
        post({ type: 'divani:edit', section: el.dataset.edit });
      } else if (link) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );

  // El panel pide mostrar una sección
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.data?.type !== 'divani:scroll-to') return;
    const el = document.querySelector<HTMLElement>(`[data-edit="${CSS.escape(String(e.data.section))}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: el.offsetHeight > window.innerHeight * 0.8 ? 'start' : 'center' });
    el.classList.remove('is-edit-flash');
    void el.offsetWidth;
    el.classList.add('is-edit-flash');
  });

  // Después de guardar, el panel recarga la vista previa en el mismo punto
  const y = Number(new URLSearchParams(location.search).get('y')) || 0;
  const ready = (tries = 0) => {
    // Las secciones con productos crecen al cargar: reintenta hasta llegar al mismo punto
    if (y) window.scrollTo({ top: y, behavior: 'instant' });
    if (y && Math.abs(window.scrollY - y) > 4 && tries < 8) {
      setTimeout(() => ready(tries + 1), 250);
      return;
    }
    post({ type: 'divani:ready' });
  };
  if (document.readyState === 'complete') setTimeout(() => ready(), 300);
  else window.addEventListener('load', () => setTimeout(() => ready(), 300), { once: true });
}
