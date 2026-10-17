/**
 * Punto único de datos del panel. Con VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY
 * trabaja contra Supabase; sin ellas, en modo demostración (todo en este navegador).
 */
import { hasSupabase } from '../../backend/config.js';
import { demoApi } from './demo.js';
import { supabaseApi } from './supabase.js';

export const api = hasSupabase ? supabaseApi : demoApi;
export const isDemo = !hasSupabase;
