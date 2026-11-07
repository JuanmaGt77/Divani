/** Vuelve a generar una parte del trabajo: la ficha, la foto en gancho o la foto con modelo. */
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { SUPABASE } from '@/lib/env';
import { leerConfig } from '@/estudio/config';
import { SIN_SESION, json, respuestaDeError, sesionDe } from '@/estudio/http';
import { modeloPorId } from '@/estudio/modelos';
import { rpcEstudio } from '@/estudio/supabase';
import type { MensajeCola, NombrePaso, Trabajo } from '@/estudio/tipos';

export const prerender = false;

const TIPOS: NombrePaso[] = ['ficha', 'prenda', 'modelo'];

export const POST: APIRoute = async ({ request, params }) => {
  const jwt = sesionDe(request);
  if (!jwt) return json({ error: SIN_SESION }, 401);
  const cfg = leerConfig(env);
  if (!cfg.demo && !cfg.openaiKey) {
    return json({ error: 'Falta configurar la clave de OpenAI (OPENAI_API_KEY) en el servidor.' }, 503);
  }

  const cuerpo = (await request.json().catch(() => null)) as { tipo?: unknown; modeloId?: unknown } | null;
  const tipo = TIPOS.find((t) => t === cuerpo?.tipo);
  if (!tipo) return json({ error: 'Tipo no válido.' }, 400);
  const modeloId = typeof cuerpo?.modeloId === 'string' ? cuerpo.modeloId : null;
  if (modeloId && !modeloPorId(modeloId)) return json({ error: 'Esa modelo no existe.' }, 400);

  let trabajo: Trabajo;
  try {
    trabajo = await rpcEstudio<Trabajo>(
      SUPABASE,
      'estudio_regenerar',
      { p_id: params.id, p_tipo: tipo, p_modelo: modeloId },
      jwt,
    );
  } catch (e) {
    return respuestaDeError(e);
  }

  const mensaje: MensajeCola = { trabajoId: trabajo.id, paso: tipo, intento: trabajo.pasos[tipo].intento };
  try {
    await env.ESTUDIO_COLA.send(mensaje);
  } catch (e) {
    console.error('[estudio] no se pudo mandar a la cola:', (e as Error).message);
    return json({ error: 'No se pudo iniciar. Intenta de nuevo en un momento.' }, 503);
  }
  return json(trabajo);
};
