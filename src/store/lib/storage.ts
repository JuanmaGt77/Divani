/** localStorage con tolerancia a fallos (modo privado, almacenamiento bloqueado, etc.). */

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* sin almacenamiento */
  }
}

export const STORAGE_KEYS = {
  cart: 'divani.cart.v1',
  favorites: 'divani.favorites.v1',
  recentSearches: 'divani.recent-searches.v1',
  customer: 'divani.customer.v1',
  storefront: 'divani.storefront.v2',
} as const;
