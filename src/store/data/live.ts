/**
 * Cambios en vivo: cuando algo cambia en el panel (precios, existencias, fotos, portada…), la tienda
 * se actualiza sola, sin recargar la página.
 *  - Escucha la fila pública tienda_version, que solo guarda la hora del último cambio.
 *  - Al cambiar vuelve a pedir el paquete de la tienda. Espera un momento al azar para juntar los
 *    avisos de un mismo guardado y para que no todas las visitas pidan a la vez.
 *  - Con la pestaña oculta suelta la conexión; al volver se conecta y se pone al día.
 * El código de la conexión se descarga cuando el navegador ya está libre.
 */
import type { RealtimeClient } from '@supabase/realtime-js';
import { SUPABASE } from '@/lib/env';
import { cart } from '../state/cart';
import { $storefront, refreshStorefront } from './storefront';

const ESPERA_MS = 800;
const AZAR_MS = 1200;
/** Tiempo con la pestaña oculta antes de soltar la conexión. */
const OCULTA_MS = 60_000;

export function initLive(): void {
  // La bolsa también se pone al día: precio y existencias de cada prenda
  $storefront.listen(({ data }) => {
    if (data) cart.sync(data.products);
  });

  let espera: ReturnType<typeof setTimeout> | undefined;
  const actualizar = () => {
    clearTimeout(espera);
    espera = setTimeout(refreshStorefront, ESPERA_MS + Math.random() * AZAR_MS);
  };

  let client: RealtimeClient | null = null;
  let conectando = false;
  const conectar = async () => {
    if (client || conectando) return;
    conectando = true;
    try {
      const { RealtimeClient } = await import('@supabase/realtime-js');
      const nuevo = new RealtimeClient(`${SUPABASE.url.replace(/^http/, 'ws')}/realtime/v1`, {
        params: { apikey: SUPABASE.key },
      });
      nuevo
        .channel('tienda-en-vivo')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tienda_version' }, actualizar)
        .subscribe();
      client = nuevo;
    } catch {
      /* sin conexión en vivo la tienda sigue funcionando: se actualiza al recargar */
    } finally {
      conectando = false;
    }
  };
  const soltar = () => {
    const actual = client;
    client = null;
    void actual?.removeAllChannels().finally(() => actual.disconnect());
  };

  let oculta: ReturnType<typeof setTimeout> | undefined;
  document.addEventListener('visibilitychange', () => {
    clearTimeout(oculta);
    if (document.visibilityState === 'hidden') {
      oculta = setTimeout(soltar, OCULTA_MS);
      return;
    }
    // Al volver a la pestaña siempre se pone al día, aunque la conexión en vivo haya fallado
    actualizar();
    void conectar();
  });

  if (document.visibilityState === 'visible') void conectar();
}
