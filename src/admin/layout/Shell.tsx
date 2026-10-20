/**
 * Estructura del panel: barra lateral de vidrio en escritorio; en celular, barra
 * superior que muestra el título al hacer scroll y tab bar flotante estilo iOS 26.
 */
import { useEffect, useState, type ComponentPropsWithoutRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useStore } from '@nanostores/react';
import {
  Boxes,
  ChartColumn,
  Eye,
  Globe,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  ScanBarcode,
  Settings,
  Shirt,
  ShoppingBag,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../api';
import { useData } from '../lib/query';
import { navigate } from '../lib/navigation';
import { session, settingsStore, signOut } from '../lib/session';
import { cx } from '../ui/controls';
import { Sheet, confirmDialog } from '../ui/overlays';
import { Avatar, Menu, type MenuItem } from '../ui/surfaces';

type NavEntry = { group: string } | { path: string; label: string; short?: string; icon: LucideIcon; badge?: boolean };

export const NAV: NavEntry[] = [
  { group: 'Tienda' },
  { path: '/', label: 'Resumen', icon: LayoutDashboard },
  { path: '/pedidos', label: 'Pedidos', icon: ShoppingBag, badge: true },
  { path: '/vender', label: 'Punto de venta', short: 'Vender', icon: ScanBarcode },
  { path: '/caja', label: 'Caja', icon: Wallet },
  { group: 'Catálogo' },
  { path: '/productos', label: 'Productos', icon: Shirt },
  { path: '/inventario', label: 'Inventario', icon: Boxes },
  { group: 'Análisis' },
  { path: '/reportes', label: 'Reportes', icon: ChartColumn },
  { path: '/visitas', label: 'Visitas', icon: Eye },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { group: 'Sitio' },
  { path: '/sitio', label: 'Sitio web', icon: Globe },
  { path: '/ajustes', label: 'Configuración', icon: Settings },
];

const LINKS = NAV.filter((n): n is Extract<NavEntry, { path: string }> => 'path' in n);
const TABS = ['/', '/pedidos', '/vender', '/productos'];

const isActive = (path: string, current: string): boolean =>
  path === '/' ? current === '/' : current === path || current.startsWith(`${path}/`);

function Logo(props: ComponentPropsWithoutRef<'img'>) {
  return <img src="/brand/logo-mark.svg" alt="" width="38" height="40" {...props} />;
}

const openStore = () => window.open('/', '_blank', 'noopener');

export function Shell() {
  const location = useLocation();
  const path = location.pathname;
  const user = useStore(session).user;
  const settings = useStore(settingsStore);
  const { data: newCount } = useData(['orders', 'new-count'], () => api.orders.countNew(), ['orders']);
  const [more, setMore] = useState(false);
  const [condensed, setCondensed] = useState(false);
  const [title, setTitle] = useState('');

  // Título compacto en la barra superior cuando el título grande sale de la pantalla
  useEffect(() => {
    setMore(false);
    window.scrollTo({ top: 0 });
    let io: IntersectionObserver | undefined;
    const t = setTimeout(() => {
      const el = document.querySelector('[data-page-title]');
      setTitle(el?.textContent || '');
      if (!el || !('IntersectionObserver' in window)) return;
      io = new IntersectionObserver(([e]) => setCondensed(!e?.isIntersecting), { rootMargin: '-52px 0px 0px 0px' });
      io.observe(el);
    }, 60);
    return () => {
      clearTimeout(t);
      io?.disconnect();
    };
  }, [path]);

  const storeName = settings?.public?.store?.name || 'Divani';
  const logout = async () => {
    const ok = await confirmDialog({
      title: '¿Cerrar sesión?',
      message: 'Tendrás que volver a escribir tu correo y contraseña.',
      confirm: 'Cerrar sesión',
      danger: true,
    });
    if (ok) {
      await signOut();
      navigate('/', { replace: true });
    }
  };
  const userItems: MenuItem[] = [
    { heading: user?.email },
    { label: 'Ver la tienda', icon: Store, onClick: openStore },
    { label: 'Cambiar contraseña', icon: KeyRound, onClick: () => navigate('/ajustes?seccion=cuenta') },
    '-',
    { label: 'Cerrar sesión', icon: LogOut, danger: true, onClick: logout },
  ];
  const badge = newCount && newCount > 0 ? newCount : 0;

  return (
    <div className="shell">
      <aside className="sidebar glass" aria-label="Menú principal">
        <Link className="sidebar__brand" to="/">
          <Logo className="sidebar__logo" />
          <span className="sidebar__name">
            <strong>{storeName}</strong>
            <span>Administración</span>
          </span>
        </Link>
        <nav className="sidebar__nav">
          {NAV.map((n) =>
            'group' in n ? (
              <p key={n.group} className="sidebar__group">
                {n.group}
              </p>
            ) : (
              <NavLink key={n.path} className="nav-item" to={n.path} end={n.path === '/'}>
                <n.icon aria-hidden="true" />
                {n.label}
                {n.badge && badge > 0 && (
                  <span className="count-pill" aria-label={`${badge} pedidos nuevos`}>
                    {badge}
                  </span>
                )}
              </NavLink>
            ),
          )}
        </nav>
        <div className="sidebar__foot">
          <a className="nav-item" href="/" target="_blank" rel="noopener">
            <Store aria-hidden="true" />
            Ver la tienda
          </a>
          <Menu
            up
            align="left"
            items={userItems}
            trigger={({ toggle, open }) => (
              <button type="button" className="user-chip" aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
                <Avatar name={user?.name} />
                <span className="user-chip__text">
                  <strong>{user?.name || 'Administración'}</strong>
                  <span>{user?.email}</span>
                </span>
              </button>
            )}
          />
        </div>
      </aside>

      <div className="main">
        <header className={cx('topbar glass', condensed && 'is-condensed')}>
          <div className="topbar__side">
            <Link to="/" aria-label="Inicio del panel">
              <Logo className="topbar__logo" />
            </Link>
          </div>
          <p className="topbar__title" aria-hidden="true">
            {title}
          </p>
          <div className="topbar__side topbar__side--end">
            <Menu
              items={userItems}
              trigger={({ toggle, open }) => (
                <button type="button" className="icon-btn" aria-label="Cuenta" aria-expanded={open} onClick={toggle}>
                  <Avatar name={user?.name} size={30} />
                </button>
              )}
            />
          </div>
        </header>
        <Outlet key={path} />
      </div>

      <nav className="tabbar glass" aria-label="Secciones">
        {TABS.map((p) => {
          const n = LINKS.find((x) => x.path === p);
          if (!n) return null;
          return (
            <NavLink key={p} className="tabbar__item" to={p} end={p === '/'}>
              <n.icon aria-hidden="true" />
              {n.short || n.label}
              {n.badge && badge > 0 && <span className="count-pill">{badge}</span>}
            </NavLink>
          );
        })}
        <button
          type="button"
          className="tabbar__item"
          aria-current={!TABS.some((p) => isActive(p, path)) ? 'page' : undefined}
          onClick={() => setMore(true)}
        >
          <LayoutGrid aria-hidden="true" />
          Más
        </button>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title="Más secciones">
        <div className="more-grid">
          {LINKS.filter((n) => !TABS.includes(n.path)).map((n) => (
            <Link key={n.path} className="more-tile" to={n.path} onClick={() => setMore(false)}>
              <span>
                <n.icon aria-hidden="true" />
              </span>
              <span>{n.label}</span>
            </Link>
          ))}
          <a className="more-tile" href="/" target="_blank" rel="noopener">
            <span>
              <Store aria-hidden="true" />
            </span>
            <span>Ver la tienda</span>
          </a>
          <button
            type="button"
            className="more-tile"
            onClick={() => {
              setMore(false);
              void logout();
            }}
          >
            <span>
              <LogOut aria-hidden="true" />
            </span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </Sheet>
    </div>
  );
}
