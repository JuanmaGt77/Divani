/**
 * Datos de la tienda: productos, categorías, banners, looks, preguntas, contenido de la portada
 * y ajustes llegan juntos en un «paquete» (función storefront de Supabase).
 *  - Se pide una sola vez por página y lo comparten todas las islas.
 *  - Lo último que se vio se guarda en el navegador: la siguiente visita se pinta al instante
 *    y se actualiza en cuanto llega lo más reciente (y sirve de respaldo sin conexión).
 */
import { useEffect } from 'react';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { setRegion } from '@/lib/format';
import { COLOR_FAMILIES, DEFAULT_SETTINGS, mergeSettings } from '@/lib/model';
import { queryProducts, type ProductPage, type ProductQuery } from '@/lib/catalog-query';
import { SUPABASE } from '@/lib/env';
import { rpc } from '@/lib/rpc';
import type { PublicSettings, StoreCategory, StoreProduct, StorefrontPayload } from '@/lib/types';
import { isEditMode, useHydrated } from '../lib/hydration';
import { STORAGE_KEYS, load, save } from '../lib/storage';

export interface StorefrontState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: StorefrontPayload | null;
  error: string | null;
}

export const $storefront = atom<StorefrontState>({ status: 'idle', data: null, error: null });

function normalize(raw: Partial<StorefrontPayload> | null | undefined): StorefrontPayload {
  return {
    settings: mergeSettings({ public: raw?.settings }).public,
    departments: raw?.departments || [],
    categories: raw?.categories || [],
    colorFamilies: raw?.colorFamilies || COLOR_FAMILIES,
    banners: raw?.banners || [],
    lookbooks: raw?.lookbooks || [],
    faq: raw?.faq || [],
    content: raw?.content || {},
    products: raw?.products || [],
  };
}

/** Aplica la región (moneda e idioma) de la tienda. */
export function applySettings(settings: PublicSettings): void {
  setRegion(settings.region);
  if (typeof document !== 'undefined' && settings.region?.locale)
    document.documentElement.lang = settings.region.locale;
}

interface Cached {
  at: number;
  url: string;
  data: Partial<StorefrontPayload>;
}

function readCache(): StorefrontPayload | null {
  const v = load<Cached | null>(STORAGE_KEYS.storefront, null);
  return v?.data && v.url === SUPABASE.url ? normalize(v.data) : null;
}

let pending: Promise<StorefrontPayload> | null = null;

/** Pide el paquete de la tienda (una sola vez, salvo que se pida de nuevo con force). */
export function loadStorefront({ force = false }: { force?: boolean } = {}): Promise<StorefrontPayload> {
  if (pending && !force) return pending;
  const cur = $storefront.get();
  if (cur.status === 'idle' && !isEditMode()) {
    const cached = readCache();
    if (cached) {
      applySettings(cached.settings);
      $storefront.set({ status: 'ready', data: cached, error: null });
    }
  }
  if (!$storefront.get().data) $storefront.set({ status: 'loading', data: null, error: null });
  pending = rpc<Partial<StorefrontPayload>>('storefront')
    .then((raw) => {
      const data = normalize(raw);
      save(STORAGE_KEYS.storefront, { at: Date.now(), url: SUPABASE.url, data: raw } satisfies Cached);
      applySettings(data.settings);
      $storefront.set({ status: 'ready', data, error: null });
      return data;
    })
    .catch((err: Error) => {
      pending = null;
      const now = $storefront.get();
      // Sin conexión: se queda lo último que se vio
      if (now.data) return now.data;
      $storefront.set({ status: 'error', data: null, error: err.message });
      throw err;
    });
  return pending;
}

/** Las existencias cambiaron (se registró un pedido): la próxima consulta trae lo más reciente. */
export const refreshStorefront = (): void => {
  pending = null;
  void loadStorefront({ force: true }).catch(() => {});
};

export interface StorefrontView extends StorefrontState {
  /** false en el HTML generado y durante la hidratación (todavía no se muestran datos). */
  hydrated: boolean;
  retry: () => void;
}

/**
 * Datos de la tienda para una isla. Durante la hidratación devuelve el mismo estado que el HTML
 * generado (sin datos) y después lo real.
 */
export function useStorefront(): StorefrontView {
  const hydrated = useHydrated();
  const state = useStore($storefront);
  useEffect(() => {
    void loadStorefront().catch(() => {});
  }, []);
  const retry = () => void loadStorefront({ force: true }).catch(() => {});
  if (!hydrated) return { status: 'idle', data: null, error: null, hydrated, retry };
  return { ...state, hydrated, retry };
}

/** Ajustes públicos de la tienda (los de fábrica mientras llegan los guardados). */
export function useSettings(): PublicSettings {
  const { data } = useStorefront();
  return data?.settings || DEFAULT_SETTINGS.public;
}

/* ---------- consultas sobre el paquete ---------- */
export const listProducts = (data: StorefrontPayload, query: ProductQuery = {}): ProductPage =>
  queryProducts(data.products, query, { categories: data.categories });

export const findProduct = (data: StorefrontPayload | null, slug: string): StoreProduct | null =>
  data?.products.find((p) => p.slug === slug || p.id === slug) || null;

export const categoryName = (data: StorefrontPayload | null, slug: string | null): string =>
  (slug && data?.categories.find((c: StoreCategory) => c.slug === slug)?.name) || '';

/** Productos por slug, conservando el orden pedido. */
export function productsBySlug(data: StorefrontPayload, slugs: string[]): StoreProduct[] {
  const by = new Map(data.products.map((p) => [p.slug, p]));
  return slugs.map((s) => by.get(s)).filter((p): p is StoreProduct => !!p);
}
