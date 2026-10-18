/**
 * Utilidades para las islas de React de la tienda.
 * Las páginas se generan como HTML al compilar; al cargar en el navegador, cada isla primero
 * se «hidrata» con el mismo contenido que trae el HTML y después muestra lo que depende del
 * navegador (datos de la tienda, bolsa, favoritos). Así no hay saltos ni errores de hidratación.
 */
import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/** false en el HTML generado y durante la hidratación; true después. */
export const useHydrated = (): boolean =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

/** Vista previa del panel (?editar=1 dentro de un iframe del mismo sitio). */
export function isEditMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      new URLSearchParams(location.search).get('editar') === '1' &&
      window.parent !== window &&
      window.parent.location.origin === location.origin
    );
  } catch {
    return false;
  }
}

export const reduceMotion = (): boolean =>
  typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
