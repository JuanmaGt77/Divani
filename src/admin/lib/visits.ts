/**
 * Las visitas del equipo no se cuentan (Panel → Visitas): al entrar al panel, este navegador
 * queda fuera del contador de la tienda (aunque después cierre sesión) y se borran las vistas
 * que hizo antes de entrar.
 */
import { VISIT_KEYS } from '@/lib/visits';
import { api } from '../api';

export async function excludeThisBrowser(): Promise<void> {
  try {
    localStorage.setItem(VISIT_KEYS.skip, '1');
    if (localStorage.getItem(VISIT_KEYS.forgotten)) return;
    const visitor = localStorage.getItem(VISIT_KEYS.visitor);
    if (visitor) await api.visits.forget(visitor);
    localStorage.setItem(VISIT_KEYS.forgotten, '1');
  } catch {
    // Sin almacenamiento o el contador todavía no está activo: se intenta en la próxima entrada
  }
}

/** El identificador anónimo de este navegador en la tienda (si alguna vez la visitó). */
export function thisBrowserVisitor(): string | null {
  try {
    return localStorage.getItem(VISIT_KEYS.visitor);
  } catch {
    return null;
  }
}
