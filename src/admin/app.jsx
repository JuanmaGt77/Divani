/** Arranque del panel: sesión, rutas (cada sección se carga al abrirla) y avisos en vivo. */
import { useEffect, useState } from 'preact/hooks';
import { ShoppingBag } from 'lucide-preact';
import { useRoute, match, navigate } from './lib/router.js';
import { useStore } from './lib/store.js';
import { session, boot } from './lib/session.js';
import { invalidate } from './lib/query.js';
import { money } from './lib/format.js';
import { api } from './api/index.js';
import { Shell } from './layout/Shell.jsx';
import { AlertHost, ToastHost, toast } from './ui/overlays.jsx';
import { SkeletonRows, Empty } from './ui/surfaces.jsx';
import Login from './pages/Login.jsx';

const ROUTES = [
  ['/', () => import('./pages/Dashboard.jsx')],
  ['/pedidos', () => import('./pages/Orders.jsx')],
  ['/pedidos/:id', () => import('./pages/OrderDetail.jsx')],
  ['/vender', () => import('./pages/Pos.jsx')],
  ['/caja', () => import('./pages/Cash.jsx')],
  ['/caja/:id', () => import('./pages/CashSession.jsx')],
  ['/productos', () => import('./pages/Products.jsx')],
  ['/productos/nuevo', () => import('./pages/ProductEditor.jsx')],
  ['/productos/:id', () => import('./pages/ProductEditor.jsx')],
  ['/inventario', () => import('./pages/Inventory.jsx')],
  ['/clientes', () => import('./pages/Customers.jsx')],
  ['/reportes', () => import('./pages/Reports.jsx')],
  ['/sitio', () => import('./pages/Website.jsx')],
  ['/ajustes', () => import('./pages/Settings.jsx')],
];

const loaded = new Map();

function resolve(path) {
  for (const [pattern, load] of ROUTES) {
    const params = match(pattern, path);
    if (params) return { pattern, load, params };
  }
  return null;
}

function Page({ route }) {
  const hit = resolve(route.path);
  const [, rerender] = useState(0);
  const [failed, setFailed] = useState(null);
  useEffect(() => {
    if (!hit || loaded.has(hit.pattern)) return;
    setFailed(null);
    hit.load()
      .then((m) => { loaded.set(hit.pattern, m.default); rerender((v) => v + 1); })
      .catch((err) => { console.error(err); setFailed(hit.pattern); });
  }, [hit?.pattern]);
  if (!hit) {
    return (
      <main class="page">
        <Empty title="Esta sección no existe" action={<a class="btn btn--primary" href="#/">Ir al resumen</a>}>Revisa la dirección o vuelve al inicio del panel.</Empty>
      </main>
    );
  }
  if (failed === hit.pattern) {
    return <main class="page"><Empty title="No se pudo abrir esta sección" action={<button class="btn btn--primary" onClick={() => location.reload()}>Volver a intentar</button>}>Revisa tu conexión a internet.</Empty></main>;
  }
  const Comp = loaded.get(hit.pattern);
  if (!Comp) return <main class="page"><div class="card"><SkeletonRows rows={7} /></div></main>;
  return <Comp params={hit.params} query={route.query} key={route.path} />;
}

export function App() {
  const s = useStore(session);
  const route = useRoute();

  useEffect(() => { boot(); }, []);

  // Cambios que llegan de otras pestañas (demostración) o de Supabase en tiempo real
  useEffect(() => {
    if (s.status !== 'signedIn') return undefined;
    return api.subscribe((topic, meta = {}) => {
      if (!meta.remote) return;
      invalidate(topic === 'data' || topic === 'reset' ? '*' : topic);
      if (topic === 'orders' || topic === 'data') invalidate('orders', 'inventory', 'products', 'cash');
      if (meta.newOrder) {
        toast({
          title: `Nuevo pedido ${meta.newOrder.number}`,
          sub: [meta.newOrder.name, money(meta.newOrder.total)].filter(Boolean).join(' · '),
          icon: ShoppingBag,
          tone: 'info',
          duration: 9000,
          action: { label: 'Ver', onClick: () => navigate(`/pedidos/${meta.newOrder.id}`) },
        });
      }
    });
  }, [s.status]);

  return (
    <>
      <div class="app-bg" aria-hidden="true" />
      {s.status === 'loading' && (
        <div class="boot" aria-busy="true" aria-label="Cargando">
          <img src="brand/logo-mark.svg" alt="" width="64" height="68" />
        </div>
      )}
      {(s.status === 'signedOut' || (s.status === 'signedIn' && s.recovery)) && <Login />}
      {s.status === 'signedIn' && !s.recovery && (
        <Shell route={route}>
          <Page route={route} />
        </Shell>
      )}
      <AlertHost />
      <ToastHost />
    </>
  );
}
