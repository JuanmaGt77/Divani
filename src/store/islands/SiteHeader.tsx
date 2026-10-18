/**
 * Encabezado: cinta de avisos, barra de vidrio con menú, logo y accesos (búsqueda, favoritos,
 * panel y bolsa) y, en escritorio, el menú desplegable de cada departamento.
 */
import { useEffect, useRef, useState } from 'react';
import { cdn } from '@/lib/model';
import type { StorefrontPayload } from '@/lib/types';
import { Icon } from '../components/Icon';
import { Marquee } from '../components/Marquee';
import { cx } from '../components/cx';
import { useSettings, useStorefront } from '../data/storefront';
import { useAdminSignedIn, visibleDepartments } from '../lib/site';
import { cartCount, useCart } from '../state/cart';
import { useFavorites } from '../state/favorites';
import { openSheet } from '../state/ui';
import { CountBadge } from './overlays/CountBadge';

export default function SiteHeader() {
  const { data } = useStorefront();
  const settings = useSettings();
  const cartN = cartCount(useCart());
  const favN = useFavorites().length;
  const signed = useAdminSignedIn();
  const [scrolled, setScrolled] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const announcements = settings.announcements.map((t) => t.replace(/[<>&]/g, '')).filter(Boolean);
  const deps = visibleDepartments(data);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      setScrolled(window.scrollY > 24);
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Enlace activo en la tienda: el departamento abierto o «Novedades»
  useEffect(() => {
    if (location.pathname !== '/tienda') return;
    const p = new URLSearchParams(location.search);
    setCurrent(p.get('depto') || (p.get('orden') === 'nuevo' ? 'nuevo' : null));
  }, []);

  const mega = useMega(data);

  return (
    <>
      <div className="announce" role="region" aria-label="Avisos de la tienda" data-edit="announcements">
        <div className="announce__viewport">
          <Marquee className="announce__track" itemClassName="announce__item" items={announcements} />
        </div>
      </div>

      <header className={cx('site-header', scrolled && 'is-scrolled')}>
        <div className="site-header__bar glass glass--live pill">
          <button
            className="icon-btn site-header__menu"
            type="button"
            onClick={() => openSheet('menu')}
            aria-label="Abrir menú"
          >
            <Icon name="menu" />
          </button>

          <nav className="site-nav" aria-label="Principal">
            {deps.map((d) => (
              <a
                key={d.slug}
                className="site-nav__link"
                href={`/tienda?depto=${d.slug}`}
                aria-current={current === d.slug ? 'page' : undefined}
                aria-expanded={mega.enabled ? mega.dept === d.slug : undefined}
                {...mega.linkProps(d.slug)}
              >
                {d.label}
              </a>
            ))}
            <a
              className="site-nav__link"
              href="/tienda?orden=nuevo"
              aria-current={current === 'nuevo' ? 'page' : undefined}
              onPointerEnter={mega.close}
            >
              Novedades
            </a>
          </nav>

          <a className="site-logo" href="/" aria-label={`${settings.store.name} — inicio`} onPointerEnter={mega.close}>
            <svg viewBox="0 0 805 247" aria-hidden="true">
              <use href="#logo-wordmark" />
            </svg>
          </a>

          <div className="site-actions" onPointerEnter={mega.close}>
            <a className="site-nav__link site-actions__about" href="/#nosotros">
              Nosotros
            </a>
            <button className="icon-btn" type="button" onClick={() => openSheet('search')} aria-label="Buscar">
              <Icon name="search" />
            </button>
            <button
              className="icon-btn site-actions__fav"
              type="button"
              onClick={() => openSheet('favorites')}
              aria-label="Favoritos"
            >
              <Icon name="heart" />
              <CountBadge count={favN} />
            </button>
            <a
              className={cx('icon-btn site-actions__admin', signed && 'is-signed-in')}
              href="/admin"
              aria-label={signed ? 'Ir al panel de administración' : 'Iniciar sesión (administración)'}
              title={signed ? 'Ir al panel' : 'Iniciar sesión'}
            >
              <Icon name="user" />
              <span className="site-actions__admin-label">Panel</span>
            </a>
            <button className="icon-btn" type="button" onClick={() => openSheet('cart')} aria-label="Bolsa de compras">
              <Icon name="bag" />
              <CountBadge count={cartN} />
            </button>
          </div>
        </div>

        {/* Menú desplegable por departamento (escritorio) */}
        <div
          className={cx('mega glass glass--strong', mega.visible && 'is-open')}
          hidden={!mega.dept}
          onPointerEnter={mega.keep}
          onPointerLeave={mega.leave}
        >
          {mega.dept && data && <MegaContent data={data} dept={mega.dept} />}
        </div>
      </header>
    </>
  );
}

/** Abrir y cerrar el menú desplegable con el cursor (solo en escritorio con mouse). */
function useMega(data: StorefrontPayload | null) {
  const [enabled, setEnabled] = useState(false);
  const [dept, setDept] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setEnabled(matchMedia('(hover: hover) and (min-width: 1024px)').matches);
  }, []);

  const open = (slug: string) => {
    clearTimeout(closeTimer.current);
    setDept(slug);
    requestAnimationFrame(() => setVisible(true));
  };
  const close = () => {
    clearTimeout(openTimer.current);
    setVisible(false);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setDept(null), 300);
  };

  useEffect(() => {
    if (!dept) return undefined;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const scroll = () => close();
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', scroll, { passive: true });
    return () => {
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', scroll);
    };
  }, [dept]);

  const active = enabled && !!data;
  return {
    enabled: active,
    dept: active ? dept : null,
    visible: active && visible,
    close,
    keep: () => clearTimeout(closeTimer.current),
    leave: () => {
      clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(close, 220);
    },
    linkProps: (slug: string) =>
      active
        ? {
            onPointerEnter: () => {
              clearTimeout(openTimer.current);
              openTimer.current = setTimeout(() => open(slug), 110);
            },
            onPointerLeave: () => {
              clearTimeout(openTimer.current);
              clearTimeout(closeTimer.current);
              closeTimer.current = setTimeout(close, 220);
            },
            onFocus: () => open(slug),
          }
        : {},
  };
}

function MegaContent({ data, dept }: { data: StorefrontPayload; dept: string }) {
  const d = data.departments.find((x) => x.slug === dept);
  if (!d) return null;
  const cats = data.categories.filter((c) => c.department === dept);
  const featured = cats.filter((c) => ['vestidos', 'abrigos-y-chamarras'].includes(c.slug) && c.image);
  const cards =
    dept === 'mujer' && featured.length
      ? featured.map((c) => ({ name: c.name, image: c.image, slug: c.slug }))
      : [{ name: `Ver ${d.name.toLowerCase()}`, image: d.image, slug: '' }];
  return (
    <div className="mega__grid">
      <div className="mega__intro">
        <p className="eyebrow">{d.name}</p>
        <p className="mega__title">{d.name}</p>
        <p className="mega__desc">{d.description || ''}</p>
        <a className="link" href={`/tienda?depto=${dept}`}>
          Ver todo <Icon name="arrow-right" />
        </a>
      </div>
      <nav className="mega__list" aria-label={`Categorías de ${d.name}`}>
        {cats.map((c) => (
          <a key={c.slug} href={`/tienda?depto=${dept}&cat=${c.slug}`}>
            <span>{c.name}</span>
            <small>{c.productCount}</small>
          </a>
        ))}
        <a href={`/tienda?depto=${dept}&oferta=1`}>
          <span>Ofertas</span>
          <small>%</small>
        </a>
      </nav>
      <div className="mega__cards">
        {cards.slice(0, 2).map((c) => (
          <a
            key={c.slug || 'all'}
            className="mega-card"
            href={`/tienda?depto=${dept}${c.slug ? `&cat=${c.slug}` : ''}`}
          >
            <img src={cdn(c.image, { w: 500 })} alt="" loading="lazy" />
            <span className="glass">{c.name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
