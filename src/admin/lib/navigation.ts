/**
 * Navegación del panel (React Router): ir a otra sección desde cualquier lugar, filtros en la
 * URL y aviso de «tienes cambios sin guardar».
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useBlocker, useLocation, useSearchParams } from 'react-router';

interface NavigatorLike {
  navigate: (to: string, opts?: { replace?: boolean }) => Promise<void>;
}

let router: NavigatorLike | null = null;

/** Lo llama la aplicación al crear el enrutador. */
export function setRouter(r: NavigatorLike): void {
  router = r;
}

/** Ir a otra sección del panel (las rutas no llevan /admin: «/pedidos/123»). */
export function navigate(to: string, { replace = false }: { replace?: boolean } = {}): void {
  void router?.navigate(to, { replace });
}

export type Query = Record<string, string>;
export type QueryPatch = Record<string, string | null | undefined>;

/** Parámetros de la URL como objeto y una función para cambiarlos sin crear historial (filtros). */
export function useSearch(): { query: Query; setQuery: (patch: QueryPatch) => void } {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => Object.fromEntries(params) as Query, [params]);
  const setQuery = useCallback(
    (patch: QueryPatch) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === '' || v == null) next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return { query, setQuery };
}

/**
 * Evita salir de una pantalla con cambios sin guardar (al cambiar de sección, de pestaña
 * o al cerrar la página). Llama a allowNext() justo antes de navegar después de guardar.
 */
export function useUnsavedChanges(
  dirty: boolean,
  message = 'Tienes cambios sin guardar. ¿Salir sin guardar?',
): { allowNext: () => void } {
  const skip = useRef(false);
  const location = useLocation();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !skip.current &&
      dirty &&
      (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(message)) blocker.proceed();
    else blocker.reset();
  }, [blocker, message]);

  useEffect(() => {
    skip.current = false;
  }, [location.key]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  return {
    allowNext: () => {
      skip.current = true;
    },
  };
}
