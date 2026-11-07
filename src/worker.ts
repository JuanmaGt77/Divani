/**
 * Entrada del Worker. Las páginas y direcciones las atiende Astro (`fetch`); `queue` recibe los
 * mensajes de Estudio IA, que necesitan más tiempo del que dura una petición: Cloudflare puede
 * cancelar una petición cuando el teléfono se desconecta, pero una cola sigue hasta 15 minutos.
 */
import { handle } from '@astrojs/cloudflare/handler';
import { atenderCola } from './estudio/cola';

export default {
  fetch: handle,
  queue: (lote: { messages: readonly { body: unknown }[] }, env: Record<string, unknown>) => atenderCola(lote, env),
};
