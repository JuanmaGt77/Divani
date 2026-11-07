/**
 * Entrada del Worker. Las páginas y direcciones las atiende Astro (`fetch`); `queue` recibe los
 * mensajes de Estudio IA, que necesitan más tiempo del que dura una petición: Cloudflare puede
 * cancelar una petición cuando el teléfono se desconecta, pero una cola sigue hasta 15 minutos.
 */
import { handle } from '@astrojs/cloudflare/handler';
import { atenderCola } from './estudio/cola';
import { SECURITY_HEADERS } from './lib/security-headers';

export default {
  fetch: async (...args: Parameters<typeof handle>) => {
    const respuesta = await handle(...args);
    // En desarrollo Vite necesita cargar y conectarse a cosas que estas reglas no permiten
    if (import.meta.env.DEV) return respuesta;
    const segura = new Response(respuesta.body, respuesta);
    for (const [nombre, valor] of Object.entries(SECURITY_HEADERS)) segura.headers.set(nombre, valor);
    return segura;
  },
  queue: (lote: { messages: readonly { body: unknown }[] }, env: Record<string, unknown>) => atenderCola(lote, env),
};
