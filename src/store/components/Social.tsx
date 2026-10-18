/** Enlaces a redes sociales (los que se dejan vacíos en el panel no aparecen). */
import type { PublicSettings } from '@/lib/types';
import { SOCIAL_LABELS } from '../lib/site';
import { Icon } from './Icon';

export function SocialLinks({ settings }: { settings: PublicSettings }) {
  const links = Object.entries(settings.store.social || {}).filter(([, url]) => url);
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
