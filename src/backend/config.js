/**
 * ¿Con qué base de datos trabaja la tienda?
 *  - Supabase: si existen VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY (archivo .env).
 *  - Demostración: sin esas variables. El panel guarda todo en este navegador (IndexedDB)
 *    y la tienda lee esos mismos datos, para probar el sistema completo sin servidor.
 */
const env = import.meta.env ?? {};

export const SUPABASE = {
  url: String(env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, ''),
  // Clave publicable (sb_publishable_…) o la clave anon heredada. Ambas son públicas por diseño.
  key: String(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim(),
};

export const hasSupabase = Boolean(SUPABASE.url && SUPABASE.key);

export const BACKEND = hasSupabase ? 'supabase' : 'demo';

/** Clave con la que supabase-js guarda la sesión del panel (la tienda la usa para mostrar el acceso rápido). */
export const AUTH_STORAGE_KEY = 'divani.admin.auth';
