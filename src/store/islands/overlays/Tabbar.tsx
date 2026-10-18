/** Barra inferior estilo iOS 26 (celular) y botón flotante de WhatsApp (escritorio). */
import { useEffect, useState } from 'react';
import type { PublicSettings } from '@/lib/types';
import { Icon } from '../../components/Icon';
import { cx } from '../../components/cx';
import { greetingMessage, waLink } from '../../lib/whatsapp';
import { cartCount, useCart } from '../../state/cart';
import { useFavorites } from '../../state/favorites';
import { openSheet } from '../../state/ui';
import { CountBadge } from './CountBadge';

export type Tab = 'inicio' | 'tienda';

export function Tabbar({ active, settings }: { active?: Tab | undefined; settings: PublicSettings }) {
  const [min, setMin] = useState(false);
  const cartN = cartCount(useCart());
  const favN = useFavorites().length;
  const wa = waLink(settings, greetingMessage(settings));

  // Se compacta al bajar y regresa al subir
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) > 6) {
        setMin(y > last && y > 160);
        last = y;
      }
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={cx('tabbar', min && 'is-min')} aria-label="Navegación rápida">
      <div className="tabbar__bar glass pill">
        <a className="tabbar__item" href="/" aria-current={active === 'inicio' ? 'page' : undefined}>
          <Icon name="home" />
          <span>Inicio</span>
        </a>
        <a className="tabbar__item" href="/tienda" aria-current={active === 'tienda' ? 'page' : undefined}>
          <Icon name="grid" />
          <span>Tienda</span>
        </a>
        <button className="tabbar__item" type="button" onClick={() => openSheet('favorites')}>
          <Icon name="heart" />
          <span>Favoritos</span>
          <CountBadge count={favN} />
        </button>
        <button className="tabbar__item" type="button" onClick={() => openSheet('cart')}>
          <Icon name="bag" />
          <span>Bolsa</span>
          <CountBadge count={cartN} />
        </button>
      </div>
      <a
        className="tabbar__wa glass round"
        href={wa}
        target="_blank"
        rel="noopener"
        aria-label="Escríbenos por WhatsApp"
      >
        <Icon name="whatsapp" />
      </a>
    </nav>
  );
}

/** El botón flotante de WhatsApp muestra su texto unos segundos al llegar. */
export function WaFab({ settings }: { settings: PublicSettings }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let off: ReturnType<typeof setTimeout>;
    const on = setTimeout(() => {
      setExpanded(true);
      off = setTimeout(() => setExpanded(false), 4200);
    }, 2600);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, []);
  return (
    <a
      className={cx('wa-fab glass pill', expanded && 'is-expanded')}
      href={waLink(settings, greetingMessage(settings))}
      target="_blank"
      rel="noopener"
      aria-label="Escríbenos por WhatsApp"
    >
      <span className="wa-fab__icon">
        <Icon name="whatsapp" />
      </span>
      <span className="wa-fab__text">¿Te ayudamos?</span>
    </a>
  );
}
