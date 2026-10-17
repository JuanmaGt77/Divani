/**
 * Estructura del panel: barra lateral de vidrio en escritorio; en celular, barra
 * superior que muestra el título al hacer scroll y tab bar flotante estilo iOS 26.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  LayoutDashboard, ShoppingBag, ScanBarcode, Wallet, Shirt, Boxes, Users, ChartColumn, Globe, Settings,
  Store, LogOut, LayoutGrid, Sparkles, KeyRound,
} from 'lucide-preact';
import { href, navigate } from '../lib/router.js';
import { useQuery } from '../lib/query.js';
import { useStore } from '../lib/store.js';
import { session, settingsStore, signOut } from '../lib/session.js';
import { api, isDemo } from '../api/index.js';
import { Sheet, confirmDialog } from '../ui/overlays.jsx';
import { Avatar, Menu } from '../ui/surfaces.jsx';
import { cx } from '../ui/controls.jsx';

export const NAV = [
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
  { path: '/clientes', label: 'Clientes', icon: Users },
  { group: 'Sitio' },
  { path: '/sitio', label: 'Sitio web', icon: Globe },
  { path: '/ajustes', label: 'Configuración', icon: Settings },
];
const TABS = ['/', '/pedidos', '/vender', '/productos'];

const isActive = (path, current) => (path === '/' ? current === '/' : current === path || current.startsWith(`${path}/`));

function Logo(props) {
  return <img src="brand/logo-mark.svg" alt="" width="38" height="40" {...props} />;
}

export function Shell({ route, children }) {
  const user = useStore(session, (s) => s.user);
  const settings = useStore(settingsStore);
  const { data: newCount } = useQuery('orders:new-count', () => api.orders.countNew(), ['orders']);
  const [more, setMore] = useState(false);
  const [condensed, setCondensed] = useState(false);
  const [title, setTitle] = useState('');
  const topbar = useRef(null);

  // Título compacto en la barra superior cuando el título grande sale de la pantalla
  useEffect(() => {
    setMore(false);
    window.scrollTo({ top: 0 });
    let io;
    const t = setTimeout(() => {
      const el = document.querySelector('[data-page-title]');
      setTitle(el?.textContent || '');
      if (!el || !('IntersectionObserver' in window)) return;
      io = new IntersectionObserver(([e]) => setCondensed(!e.isIntersecting), { rootMargin: '-52px 0px 0px 0px' });
      io.observe(el);
    }, 60);
    return () => { clearTimeout(t); io?.disconnect(); };
  }, [route.path]);

  const storeName = settings?.public?.store?.name || 'Divani';
  const logout = async () => {
    if (await confirmDialog({ title: '¿Cerrar sesión?', message: 'Tendrás que volver a escribir tu correo y contraseña.', confirm: 'Cerrar sesión', danger: true })) {
      await signOut();
      navigate('/', { replace: true });
    }
  };
  const userItems = [
    { heading: user?.email },
    { label: 'Ver la tienda', icon: Store, onClick: () => window.open('index.html', '_blank', 'noopener') },
    !isDemo && { label: 'Cambiar contraseña', icon: KeyRound, onClick: () => navigate('/ajustes?seccion=cuenta') },
    '-',
    { label: 'Cerrar sesión', icon: LogOut, danger: true, onClick: logout },
  ];

  return (
    <div class="shell">
      <aside class="sidebar glass" aria-label="Menú principal">
        <a class="sidebar__brand" href={href('/')}>
          <Logo class="sidebar__logo" />
          <span class="sidebar__name"><strong>{storeName}</strong><span>Administración</span></span>
        </a>
        <nav class="sidebar__nav">
          {NAV.map((n) => (n.group
            ? <p class="sidebar__group">{n.group}</p>
            : (
              <a class="nav-item" href={href(n.path)} aria-current={isActive(n.path, route.path) ? 'page' : undefined}>
                <n.icon aria-hidden="true" />
                {n.label}
                {n.badge && newCount > 0 && <span class="count-pill" aria-label={`${newCount} pedidos nuevos`}>{newCount}</span>}
              </a>
            )))}
        </nav>
        <div class="sidebar__foot">
          {isDemo && (
            <a class="demo-chip" href={href('/ajustes?seccion=datos')} title="Los cambios se guardan solo en este navegador">
              <Sparkles aria-hidden="true" /><span><strong>Modo demostración</strong><small>Conecta Supabase para usar datos reales</small></span>
            </a>
          )}
          <a class="nav-item" href="index.html" target="_blank" rel="noopener"><Store aria-hidden="true" />Ver la tienda</a>
          <Menu
            up
            align="left"
            items={userItems}
            trigger={({ toggle, open }) => (
              <button type="button" class="user-chip" aria-haspopup="menu" aria-expanded={String(open)} onClick={toggle}>
                <Avatar name={user?.name} />
                <span class="user-chip__text"><strong>{user?.name || 'Administración'}</strong><span>{isDemo ? 'Modo demostración' : user?.email}</span></span>
              </button>
            )}
          />
        </div>
      </aside>

      <div class="main">
        <header class={cx('topbar glass', condensed && 'is-condensed')} ref={topbar}>
          <div class="topbar__side">
            <a href={href('/')} aria-label="Inicio del panel"><Logo class="topbar__logo" /></a>
            {isDemo && <a class="topbar__demo" href={href('/ajustes?seccion=datos')}>Demo</a>}
          </div>
          <p class="topbar__title" aria-hidden="true">{title}</p>
          <div class="topbar__side topbar__side--end">
            <Menu items={userItems} trigger={({ toggle, open }) => (
              <button type="button" class="icon-btn" aria-label="Cuenta" aria-expanded={String(open)} onClick={toggle}><Avatar name={user?.name} size={30} /></button>
            )} />
          </div>
        </header>
        {children}
      </div>

      <nav class="tabbar glass" aria-label="Secciones">
        {TABS.map((p) => {
          const n = NAV.find((x) => x.path === p);
          return (
            <a class="tabbar__item" href={href(p)} aria-current={isActive(p, route.path) ? 'page' : undefined}>
              <n.icon aria-hidden="true" />
              {n.short || n.label}
              {n.badge && newCount > 0 && <span class="count-pill">{newCount}</span>}
            </a>
          );
        })}
        <button type="button" class="tabbar__item" aria-current={!TABS.some((p) => isActive(p, route.path)) ? 'page' : undefined} onClick={() => setMore(true)}>
          <LayoutGrid aria-hidden="true" />
          Más
        </button>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title="Más secciones">
        <div class="more-grid">
          {NAV.filter((n) => n.path && !TABS.includes(n.path)).map((n) => (
            <a class="more-tile" href={href(n.path)} onClick={() => setMore(false)}>
              <span><n.icon aria-hidden="true" /></span>
              <span>{n.label}</span>
            </a>
          ))}
          <a class="more-tile" href="index.html" target="_blank" rel="noopener"><span><Store aria-hidden="true" /></span><span>Ver la tienda</span></a>
          <button type="button" class="more-tile" onClick={() => { setMore(false); logout(); }}><span><LogOut aria-hidden="true" /></span><span>Cerrar sesión</span></button>
        </div>
      </Sheet>

    </div>
  );
}
