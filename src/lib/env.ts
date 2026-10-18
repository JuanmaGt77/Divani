/**
 * Conexión con Supabase. Las dos variables son públicas por diseño (van dentro de la página):
 * lo que protege los datos son las reglas de supabase/schema.sql.
 * Se validan al compilar (astro.config.mjs): sin ellas la tienda no se publica.
 */
import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from 'astro:env/client';

export const SUPABASE = {
  url: PUBLIC_SUPABASE_URL.trim().replace(/\/+$/, ''),
  key: PUBLIC_SUPABASE_PUBLISHABLE_KEY.trim(),
};

/** Llave con la que supabase-js guarda la sesión del panel (la tienda la usa para mostrar el acceso rápido). */
export const AUTH_STORAGE_KEY = 'divani.admin.auth';
