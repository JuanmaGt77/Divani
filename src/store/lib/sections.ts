/**
 * Secciones ocultas de la tienda (Panel → Sitio web → interruptor de cada sección). Se ocultan con
 * CSS y no con React porque las islas de la portada no arrancan hasta acercarse a la pantalla: su
 * HTML ya está en la página. La última regla se guarda para aplicarla antes de pintar en la
 * siguiente visita (ver el script del <head> en StoreLayout.astro).
 */
import { STORAGE_KEYS } from './storage';

/** Secciones a las que llevan enlaces del menú y del pie: si se ocultan, sus enlaces también. */
const ANCHORS: Record<string, string> = { about: 'nosotros', howto: 'como-comprar', faq: 'preguntas' };

const STYLE_ID = 'secciones-ocultas';

/** Reglas por separado: un navegador sin :has() ignora solo esa, no todo el bloque. */
export function hiddenCss(ids: readonly string[] | null | undefined): string {
  return (ids || [])
    .filter((id) => /^[a-z-]+$/.test(id))
    .flatMap((id) => {
      const anchor = ANCHORS[id];
      return [
        `[data-section="${id}"]`,
        ...(anchor ? [`a[href$="#${anchor}"]`, `li:has(> a[href$="#${anchor}"])`] : []),
      ];
    })
    .map((selector) => `${selector}{display:none!important}`)
    .join('');
}

export function applyHiddenSections(ids: readonly string[] | null | undefined): void {
  const css = hiddenCss(ids);
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.append(style);
  }
  if (style.textContent !== css) style.textContent = css;
  try {
    if (css) localStorage.setItem(STORAGE_KEYS.hiddenSections, css);
    else localStorage.removeItem(STORAGE_KEYS.hiddenSections);
  } catch {
    /* sin almacenamiento: se aplica al llegar los datos */
  }
}
