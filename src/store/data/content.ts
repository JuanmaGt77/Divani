/**
 * Fotos y textos de la portada que se editan en el panel (Sitio web → Portada).
 * Mientras llegan los guardados se usan los de fábrica (los mismos con los que se llena la base
 * de datos: supabase/datos/content.json). Un campo guardado vacío oculta ese texto.
 */
import defaults from '../../../supabase/datos/content.json';
import type { SiteContent } from '@/lib/types';
import { useStorefront } from './storefront';

export const DEFAULT_CONTENT = defaults as SiteContent;

type Section = keyof SiteContent;

export interface ContentReader {
  get<S extends Section, F extends keyof NonNullable<SiteContent[S]>>(
    section: S,
    field: F,
  ): NonNullable<SiteContent[S]>[F] | undefined;
  /** El contenido guardado ya llegó (o se usó el último que se vio). */
  ready: boolean;
}

export function useContent(): ContentReader {
  const { data } = useStorefront();
  const saved = data?.content;
  return {
    ready: !!data,
    get(section, field) {
      const group = saved?.[section] as Record<string, unknown> | undefined;
      if (group && (field as string) in group) return group[field as string] as never;
      return (DEFAULT_CONTENT[section] as Record<string, unknown> | undefined)?.[field as string] as never;
    },
  };
}
