/** Arranque del panel: sesión, rutas (cada sección se carga al abrirla) y avisos en vivo. */
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';
import { useStore } from '@nanostores/react';
import { ShoppingBag } from 'lucide-react';
import { money } from '@/lib/format';
import { api } from './api';
import { invalidate, queryClient } from './lib/query';
import { boot, session } from './lib/session';
import { navigate } from './lib/navigation';
import { router } from './routes';
import Login from './pages/Login';
import { AlertHost, ToastHost, toast } from './ui/overlays';

export default function AdminApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  );
}

function Root() {
  const s = useStore(session);

  useEffect(() => {
    void boot();
  }, []);

  // Pedidos nuevos de la tienda en línea y cambios hechos desde otra pestaña o dispositivo
  useEffect(() => {
    if (s.status !== 'signedIn') return undefined;
    return api.subscribe((topic, meta) => {
      if (!meta.remote) return;
      invalidate(topic, 'inventory', 'products', 'cash');
      if (meta.newOrder) {
        const order = meta.newOrder;
        toast({
          title: `Nuevo pedido ${order.number}`,
          sub: [order.name, money(order.total)].filter(Boolean).join(' · '),
          icon: ShoppingBag,
          tone: 'info',
          duration: 9000,
          action: { label: 'Ver', onClick: () => navigate(`/pedidos/${order.id}`) },
        });
      }
    });
  }, [s.status]);

  return (
    <>
      <div className="app-bg" aria-hidden="true" />
      {s.status === 'loading' && (
        <div className="boot" aria-busy="true" aria-label="Cargando">
          <img src="/brand/logo-mark.svg" alt="" width="64" height="68" />
        </div>
      )}
      {(s.status === 'signedOut' || (s.status === 'signedIn' && s.recovery)) && <Login />}
      {s.status === 'signedIn' && !s.recovery && <RouterProvider router={router} />}
      <AlertHost />
      <ToastHost />
    </>
  );
}
