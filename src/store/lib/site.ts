/** Datos de navegación y de contacto que comparten encabezado, menú y pie de página. */
import { useEffect, useState } from 'react';
import { AUTH_STORAGE_KEY } from '@/lib/env';
import type { StorefrontPayload } from '@/lib/types';
import { phone } from '@/lib/format';

export const DEPARTMENT_LINKS = [
  { slug: 'mujer', label: 'Mujer' },
  { slug: 'ninas', label: 'Niñas' },
  { slug: 'ninos', label: 'Niños' },
  { slug: 'hombre', label: 'Hombre' },
];

/** Departamentos visibles (los que se apagan en el panel desaparecen del menú y del pie). */
export function visibleDepartments(data: StorefrontPayload | null): { slug: string; label: string }[] {
  if (!data?.departments.length) return DEPARTMENT_LINKS;
  return DEPARTMENT_LINKS.flatMap((d) => {
    const found = data.departments.find((x) => x.slug === d.slug);
    return found ? [{ slug: d.slug, label: found.name || d.label }] : [];
  });
}

export const SOCIAL_LABELS: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };

/** Número de WhatsApp como se muestra en la página: +502 5555 1234 */
export const whatsappDisplay = (raw: string): string => phone(raw) || 'WhatsApp';

/** ¿Hay una sesión del panel abierta en este navegador? (para mostrar el acceso directo) */
export function useAdminSignedIn(): boolean {
  const [signed, setSigned] = useState(false);
  useEffect(() => {
    try {
      setSigned(Boolean(localStorage.getItem(AUTH_STORAGE_KEY)));
    } catch {
      setSigned(false);
    }
  }, []);
  return signed;
}
