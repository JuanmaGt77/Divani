/** Atiende la cola de Estudio IA: arma los servicios reales (o de demostración) y corre cada mensaje. */
import { SUPABASE } from '@/lib/env';
import { subirGenerada } from './cloudinary';
import { leerConfig } from './config';
import { crearMock } from './mock';
import { analizarPrenda, editarImagen } from './openai';
import { procesarMensaje, type Servicios } from './pasos';
import { promptModelo, promptPrenda } from './prompts';
import { crearBase } from './supabase';
import type { MensajeCola } from './tipos';

export function crearServicios(env: Record<string, unknown>): Servicios {
  const cfg = leerConfig(env);
  const base = crearBase(SUPABASE, cfg.workerToken);
  const comunes = {
    cfg,
    db: base,
    subir: (archivo: string) => subirGenerada(archivo, base.firmar),
    ahora: () => Date.now(),
  };
  if (cfg.demo) {
    const mock = crearMock({ rapido: cfg.demoRapido });
    return {
      ...comunes,
      analizar: (_fotos, ctx) => mock.analizar(ctx),
      imagenPrenda: (fotos) => mock.imagenPrenda(fotos),
      imagenModelo: (referencia) => mock.imagenModelo(referencia),
    };
  }
  return {
    ...comunes,
    analizar: (fotos, ctx, limite) => analizarPrenda(fotos, ctx, cfg, { limite }),
    imagenPrenda: (fotos, limite) =>
      editarImagen(
        { imagenes: fotos, prompt: promptPrenda(fotos.length), complexity: cfg.complexityPrenda, limite },
        cfg,
      ),
    imagenModelo: (referencia, fotos, ficha, limite) =>
      editarImagen(
        {
          imagenes: [referencia, ...fotos],
          prompt: promptModelo(fotos.length, ficha),
          complexity: cfg.complexityModelo,
          limite,
        },
        cfg,
      ),
  };
}

export async function atenderCola(
  lote: { messages: readonly { body: unknown }[] },
  env: Record<string, unknown>,
): Promise<void> {
  const servicios = crearServicios(env);
  for (const mensaje of lote.messages) {
    try {
      await procesarMensaje(mensaje.body as MensajeCola, servicios);
    } catch (e) {
      // No se reintenta solo: cada intento cuesta dinero. Supabase marca el paso como cortado.
      console.error('[estudio] no se pudo atender el mensaje:', (e as Error).message);
    }
  }
}
