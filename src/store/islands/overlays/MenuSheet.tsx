/** Menú del celular a pantalla completa. */
import type { ReactNode } from 'react';
import type { PublicSettings, StorefrontPayload } from '@/lib/types';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { SocialLinks } from '../../components/Social';
import { useAdminSignedIn, visibleDepartments } from '../../lib/site';
import { greetingMessage, waLink } from '../../lib/whatsapp';
import { openSizeGuide } from '../../state/ui';

export function MenuSheet({
  open,
  onClose,
  settings,
  data,
}: {
  open: boolean;
  onClose: () => void;
  settings: PublicSettings;
  data: StorefrontPayload | null;
}) {
  const signed = useAdminSignedIn();
  const deps = visibleDepartments(data);
  const item = (href: string, label: ReactNode) => (
    <li key={href}>
      <a href={href} onClick={href.includes('#') ? onClose : undefined}>
        <span>{label}</span>
        <Icon name="arrow-right" />
      </a>
    </li>
  );
  return (
    <Sheet id="menu" open={open} onClose={onClose} variant="menu" label="Menú">
      <header className="sheet__head">
        <a className="sheet__logo" href="/" aria-label={`${settings.store.name} — inicio`}>
          <svg viewBox="0 0 805 247" aria-hidden="true">
            <use href="#logo-wordmark" />
          </svg>
        </a>
        <button className="icon-btn glass round" type="button" onClick={onClose} aria-label="Cerrar menú">
          <Icon name="close" />
        </button>
      </header>
      <nav className="menu" aria-label="Menú principal">
        <ul className="menu__main list-reset">
          {deps.map((d) => item(`/tienda?depto=${d.slug}`, d.label))}
          {item('/tienda?orden=nuevo', 'Novedades')}
          {item('/tienda?oferta=1', <em>Ofertas</em>)}
        </ul>
        <ul className="menu__sub list-reset">
          <li>
            <a href="/#nosotros" onClick={onClose}>
              Acerca de nosotros
            </a>
          </li>
          <li>
            <a href="/#como-comprar" onClick={onClose}>
              Cómo comprar
            </a>
          </li>
          <li>
            <button type="button" onClick={() => openSizeGuide()}>
              Guía de tallas
            </button>
          </li>
          <li>
            <a href="/#preguntas" onClick={onClose}>
              Preguntas frecuentes
            </a>
          </li>
          <li>
            <a href="/admin" className={signed ? 'menu__admin is-signed-in' : 'menu__admin'}>
              <Icon name="user" />
              <span>{signed ? 'Ir al panel de administración' : 'Iniciar sesión'}</span>
            </a>
          </li>
        </ul>
      </nav>
      <footer className="menu__foot">
        <a
          className="btn btn--ink btn--wa btn--block"
          href={waLink(settings, greetingMessage(settings))}
          target="_blank"
          rel="noopener"
        >
          <Icon name="whatsapp" />
          Asesoría por WhatsApp
        </a>
        <div className="menu__social">
          <SocialLinks settings={settings} />
        </div>
      </footer>
    </Sheet>
  );
}
