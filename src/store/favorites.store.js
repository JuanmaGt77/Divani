/** Favoritos (lista de slugs persistida en el navegador). */
import { createStore } from '../core/emitter.js';
import { load, save } from '../core/storage.js';
import { STORAGE_KEYS } from '../config/site.config.js';

const initial = load(STORAGE_KEYS.favorites, []);
const store = createStore(Array.isArray(initial) ? initial : []);

export const favorites = {
  subscribe: store.subscribe,
  get list() { return store.get(); },
  get count() { return store.get().length; },
  has: (slug) => store.get().includes(slug),
  /** Devuelve true si quedó marcado como favorito. */
  toggle(slug) {
    const cur = store.get();
    const next = cur.includes(slug) ? cur.filter((s) => s !== slug) : [slug, ...cur];
    store.set(next);
    save(STORAGE_KEYS.favorites, next);
    return next.includes(slug);
  },
  remove(slug) {
    const next = store.get().filter((s) => s !== slug);
    store.set(next);
    save(STORAGE_KEYS.favorites, next);
  },
};

window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEYS.favorites) store.set(load(STORAGE_KEYS.favorites, []));
});
