/** Lo que la pantalla de Estudio IA necesita saber del servidor. Solo para administradores. */
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { SUPABASE } from '@/lib/env';
import { MAX_FOTOS, leerConfig } from '@/estudio/config';
import { SIN_SESION, json, respuestaDeError, sesionDe } from '@/estudio/http';
import { rpcEstudio } from '@/estudio/supabase';
import type { EstudioPublico } from '@/estudio/tipos';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const jwt = sesionDe(request);
  if (!jwt) return json({ error: SIN_SESION }, 401);
  try {
    const yo = await rpcEstudio<{ role?: string | null }>(SUPABASE, 'whoami', {}, jwt);
    if (yo?.role !== 'admin') return json({ error: 'No tienes permiso para hacer esto.' }, 403);
  } catch (e) {
    return respuestaDeError(e);
  }
  const cfg = leerConfig(env);
  const publico: EstudioPublico = {
    demo: cfg.demo,
    listo: !!cfg.workerToken && (cfg.demo || !!cfg.openaiKey),
    maxFotos: MAX_FOTOS,
  };
  return json(publico);
};
