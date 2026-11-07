/** Utilidades de las direcciones /api/estudio/…. */
import { ErrorRpc } from './supabase';

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

/** La sesión del panel, que llega en el encabezado Authorization. */
export const sesionDe = (request: Request): string | null => {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  return m?.[1] || null;
};

export const SIN_SESION = 'Tu sesión expiró. Vuelve a iniciar sesión.';

/** Convierte un error de Supabase en una respuesta para el panel. */
export function respuestaDeError(e: unknown): Response {
  if (e instanceof ErrorRpc) {
    if (e.status === 401) return json({ error: SIN_SESION }, 401);
    if (e.status === 403) return json({ error: 'No tienes permiso para hacer esto.' }, 403);
    // Los mensajes de las funciones de Estudio ya vienen en español y listos para mostrar
    if (e.status === 400) return json({ error: e.message }, 400);
    if (e.status === 404) {
      return json({ error: 'La base de datos no está actualizada: ejecuta supabase/schema.sql en Supabase.' }, 503);
    }
  }
  console.error('[estudio] error en la petición:', (e as Error).message);
  return json({ error: 'No se pudo completar. Intenta de nuevo.' }, 500);
}
