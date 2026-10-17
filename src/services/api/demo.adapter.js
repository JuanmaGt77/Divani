/**
 * Tienda en modo demostración: lee la base que el panel guarda en este navegador
 * (IndexedDB) y registra ahí mismo los pedidos, así se prueba el sistema completo
 * —tienda ↔ panel— sin servidor.
 */
import { payloadAdapter } from './payload.adapter.js';

const store = () => import('../../backend/demo/store.js');

export const demoAdapter = payloadAdapter({
  name: 'demo',
  async load() {
    const [{ loadDemoDb }, { storefrontPayload }] = await Promise.all([store(), import('../../backend/model.js')]);
    return storefrontPayload(await loadDemoDb({ create: true }));
  },
  async placeOrder(payload) {
    const [{ mutate }, ops] = await Promise.all([store(), import('../../backend/ops.js')]);
    return mutate((db) => ops.placeOrder(db, payload), { topic: 'orders' });
  },
});

/** ¿El panel ya creó una base de demostración en este navegador? */
export async function demoAvailable() {
  try {
    const { hasDemoDb } = await store();
    return await hasDemoDb();
  } catch {
    return false;
  }
}
