/**
 * Acciones sobre muchas filas a la vez (eliminar productos o pedidos): confirmación y ejecución
 * de varias en paralelo, con progreso. Lo que falle se devuelve para poder reintentarlo.
 */
import { confirmDialog, promptDialog, toast } from '../ui/overlays';

/** Desde cuántos elementos hay que escribir ELIMINAR para confirmar. */
export const TYPE_TO_CONFIRM = 5;

/** Pide confirmación para borrar; con muchos elementos hay que escribir la palabra, para evitar un clic de más. */
export async function confirmDelete({
  title,
  message,
  count,
}: {
  title: string;
  message: string;
  count: number;
}): Promise<boolean> {
  if (count < TYPE_TO_CONFIRM) return confirmDialog({ title, message, confirm: 'Eliminar', danger: true });
  const word = await promptDialog({
    title,
    message: `${message} Para confirmar, escribe ELIMINAR.`,
    placeholder: 'ELIMINAR',
    confirm: 'Eliminar',
    required: true,
    danger: true,
  });
  if (word === null) return false;
  if (word.toUpperCase() === 'ELIMINAR') return true;
  toast({ title: 'No se eliminó nada', sub: 'Para confirmar hay que escribir ELIMINAR.' });
  return false;
}

/**
 * Ejecuta `fn` con cada id, de `size` en `size` (rápido sin saturar la base).
 * `gone` reconoce el error de algo que ya no existe: cuenta como hecho.
 */
export async function eachInBatches(
  ids: string[],
  fn: (id: string) => Promise<unknown>,
  {
    size = 4,
    onProgress,
    gone = /ya no existe/i,
  }: { size?: number; onProgress?: (done: number) => void; gone?: RegExp } = {},
): Promise<{ failed: Set<string>; error: unknown }> {
  const queue = [...ids];
  const failed = new Set<string>();
  let error: unknown = null;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, ids.length) }, async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        try {
          await fn(id);
        } catch (err) {
          if (!gone.test(err instanceof Error ? err.message : String(err))) {
            failed.add(id);
            error ??= err;
          }
        }
        onProgress?.(++done);
      }
    }),
  );
  return { failed, error };
}
