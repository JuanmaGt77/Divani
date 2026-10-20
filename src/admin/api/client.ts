/** Cliente de Supabase del panel (con sesión). Se carga solo cuando se abre el panel. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEY, SUPABASE } from '@/lib/env';

let instance: SupabaseClient | null = null;

export function client(): SupabaseClient {
  instance ??= createClient(SUPABASE.url, SUPABASE.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_STORAGE_KEY },
  });
  return instance;
}

interface DbError {
  code?: string;
  message?: string;
}

/** Mensaje claro (en español) para los errores de la base de datos. */
export function friendly(err: DbError | null | undefined): string {
  const msg = err?.message || '';
  if (err?.code === '42501' || /permission denied/i.test(msg)) return 'No tienes permiso para hacer esto.';
  if (/JWT|token is expired|refresh token/i.test(msg)) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg))
    return 'Sin conexión con la base de datos. Revisa tu internet.';
  if (/Could not find the function|schema cache/i.test(msg)) {
    return 'La base de datos no está actualizada: en Supabase (SQL Editor) ejecuta supabase/schema.sql y los archivos de supabase/actualizaciones.';
  }
  if (/relation .* does not exist/i.test(msg))
    return 'Faltan tablas en la base de datos: ejecuta supabase/schema.sql en Supabase.';
  if (/duplicate key/i.test(msg)) return 'Ya existe un registro con esos datos.';
  return msg || 'Ocurrió un error con la base de datos.';
}

export class DbFailure extends Error {
  code: string | undefined;
  constructor(err: DbError | null | undefined) {
    super(friendly(err));
    this.name = 'DbFailure';
    this.code = err?.code;
    this.cause = err;
  }
}

/** Ejecuta una función RPC de schema.sql y devuelve su resultado. */
export async function rpc<T = unknown>(name: string, args: object = {}): Promise<T> {
  const { data, error } = await client().rpc(name, args);
  if (error) throw new DbFailure(error);
  return data as T;
}

/** Ejecuta una consulta de supabase-js y devuelve sus filas. */
export async function q<T>(
  build: (sb: SupabaseClient) => PromiseLike<{ data: unknown; error: DbError | null }>,
): Promise<T> {
  const { data, error } = await build(client());
  if (error) throw new DbFailure(error);
  return data as T;
}

/** Trae todas las filas (Supabase devuelve como máximo 1000 por consulta). */
export async function all<T>(
  build: (sb: SupabaseClient) => {
    range: (from: number, to: number) => PromiseLike<{ data: unknown; error: DbError | null }>;
  },
  page = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const rows = await q<T[]>((sb) => build(sb).range(from, from + page - 1));
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}
