/** Enlaces a redes sociales. Los vacíos no aparecen, ni los que solo llevan a la portada de la red. */
import type { PublicSettings } from '@/lib/types';
import { SOCIAL_LABELS } from '../lib/site';
import { Icon } from './Icon';

/** ¿Lleva a un perfil? «https://www.instagram.com/» es el valor de fábrica, no una cuenta. */
function isProfile(url: string | undefined): boolean {
  try {
    return new URL(url || '').pathname.length > 1;
  } catch {
    return false;
  }
}

export function SocialLinks({ settings }: { settings: PublicSettings }) {
  const links = Object.entries(settings.store.social || {}).filter(([, url]) => isProfile(url));
  return (
    <>
      {links.map(([k, url]) => (
        <a
          key={k}
          href={url}
          target="_blank"
          rel="noopener"
          aria-label={`${settings.store.name} en ${SOCIAL_LABELS[k] || k}`}
        >
          <Icon name={k} />
        </a>
      ))}
    </>
  );
}
