/**
 * Rutas del panel (/admin/…). Cada sección se descarga al abrirla por primera vez.
 */
import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { Shell } from './layout/Shell';
import { NotFound, PageSkeleton, RouteError } from './layout/RouteStates';
import { setRouter } from './lib/navigation';

const page = (load: () => Promise<{ default: ComponentType }>): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await load()).default }),
});

const routes: RouteObject[] = [
  {
    path: '/',
    Component: Shell,
    HydrateFallback: PageSkeleton,
    children: [
      {
        // Si una sección falla, el error se muestra dentro del panel (el menú sigue disponible)
        errorElement: <RouteError />,
        children: [
          { index: true, ...page(() => import('./pages/Dashboard')) },
          { path: 'pedidos', ...page(() => import('./pages/Orders')) },
          { path: 'pedidos/:id', ...page(() => import('./pages/OrderDetail')) },
          { path: 'vender', ...page(() => import('./pages/Pos')) },
          { path: 'caja', ...page(() => import('./pages/Cash')) },
          { path: 'caja/:id', ...page(() => import('./pages/CashSession')) },
          { path: 'productos', ...page(() => import('./pages/Products')) },
          { path: 'productos/nuevo', ...page(() => import('./pages/ProductEditor')) },
          { path: 'productos/:id', ...page(() => import('./pages/ProductEditor')) },
          { path: 'inventario', ...page(() => import('./pages/Inventory')) },
          { path: 'clientes', ...page(() => import('./pages/Customers')) },
          { path: 'reportes', ...page(() => import('./pages/Reports')) },
          { path: 'sitio', ...page(() => import('./pages/Website')) },
          { path: 'ajustes', ...page(() => import('./pages/Settings')) },
          { path: '*', Component: NotFound },
        ],
      },
    ],
  },
];

// Direcciones del panel anterior (#/pedidos/123) → /admin/pedidos/123
if (location.hash.startsWith('#/')) {
  history.replaceState(null, '', `/admin${location.hash.slice(1)}`);
}

export const router = createBrowserRouter(routes, { basename: '/admin' });
setRouter(router);
