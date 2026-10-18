/** Favoritos (lista de slugs guardada en el navegador y sincronizada entre pestañas). */
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { useHydrated } from '../lib/hydration';
import { STORAGE_KEYS, load, save } from '../lib/storage';

const browser = typeof window !== 'undefined';
const read = (): string[] => {
  const v = load<unknown>(STORAGE_KEYS.favorites, []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
};

export const $favorites = atom<string[]>(browser ? read() : []);

export const favorites = {
  has: (slug: string): boolean => $favorites.get().includes(slug),
  /** Devuelve true si quedó marcado como favorito. */
  toggle(slug: string): boolean {
    const cur = $favorites.get();
    const next = cur.includes(slug) ? cur.filter((s) => s !== slug) : [slug, ...cur];
    $favorites.set(next);
    save(STORAGE_KEYS.favorites, next);
    return next.includes(slug);
  },
  remove(slug: string) {
    const next = $favorites.get().filter((s) => s !== slug);
    $favorites.set(next);
    save(STORAGE_KEYS.favorites, next);
  },
};

/** Favoritos en una isla (vacíos durante la hidratación, igual que el HTML generado). */
export function useFavorites(): string[] {
  const hydrated = useHydrated();
  const list = useStore($favorites);
  return hydrated ? list : [];
}

if (browser) {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEYS.favorites) $favorites.set(read());
  });
}
