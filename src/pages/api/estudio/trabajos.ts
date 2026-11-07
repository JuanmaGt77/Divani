/**
 * Crea un trabajo de Estudio IA y lo manda a la cola. Las fotos ya llegan subidas a Cloudinary.
 * La función estudio_crear corre con la sesión del usuario: revisa que sea administrador y cuida
 * el límite de trabajos simultáneos.
 */
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { SUPABASE } from '@/lib/env';
import { leerConfig } from '@/estudio/config';
import { SIN_SESION, json, respuestaDeError, sesionDe } from '@/estudio/http';
import { crearBase, rpcEstudio } from '@/estudio/supabase';
import type { MensajeCola, NombrePaso, Trabajo } from '@/estudio/tipos';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const jwt = sesionDe(request);
  if (!jwt) return json({ error: SIN_SESION }, 401);
  const cfg = leerConfig(env);
  if (!cfg.demo && !cfg.openaiKey) {
    return json({ error: 'Falta configurar la clave de OpenAI (OPENAI_API_KEY) en el servidor.' }, 503);
  }
  if (!cfg.workerToken) {
    return json({ error: 'Falta configurar ESTUDIO_WORKER_TOKEN en el servidor.' }, 503);
  }

  const cuerpo = (await request.json().catch(() => null)) as { fotos?: unknown } | null;
  const fotos = Array.isArray(cuerpo?.fotos) ? cuerpo.fotos.filter((f): f is string => typeof f === 'string') : [];
  if (!fotos.length) return json({ error: 'Sube al menos una foto de la prenda.' }, 400);

  let trabajo: Trabajo;
  try {
    trabajo = await rpcEstudio<Trabajo>(
      SUPABASE,
      'estudio_crear',
      { p_fotos: fotos, p_max: cfg.maxTrabajosActivos },
      jwt,
    );
  } catch (e) {
    return respuestaDeError(e);
  }

  const mensajes: MensajeCola[] = [
    { trabajoId: trabajo.id, paso: 'prenda', intento: 1 },
    { trabajoId: trabajo.id, paso: 'ficha', intento: 1, encadenar: true },
  ];
  try {
    await env.ESTUDIO_COLA.sendBatch(mensajes.map((body) => ({ body })));
  } catch (e) {
    console.error('[estudio] no se pudo mandar a la cola:', (e as Error).message);
    const base = crearBase(SUPABASE, cfg.workerToken);
    const error = 'No se pudo iniciar el trabajo. Intenta de nuevo.';
    const pasos: NombrePaso[] = ['prenda', 'ficha', 'modelo'];
    await Promise.allSettled(pasos.map((paso) => base.terminar(trabajo.id, paso, 1, { estado: 'error', error })));
    return json({ error }, 503);
  }
  return json(trabajo, 201);
};
