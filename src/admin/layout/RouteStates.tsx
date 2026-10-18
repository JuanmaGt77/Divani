/** Estados de las rutas del panel: cargando, sección inexistente y error al abrir. */
import { useRouteError } from 'react-router';
import { Button, RouteButton } from '../ui/controls';
import { Empty, SkeletonRows } from '../ui/surfaces';

export function PageSkeleton() {
  return (
    <main className="page">
      <div className="card">
        <SkeletonRows rows={7} />
      </div>
    </main>
  );
}

export function NotFound() {
  return (
    <main className="page">
      <Empty
        title="Esta sección no existe"
        action={
          <RouteButton variant="primary" to="/">
            Ir al resumen
          </RouteButton>
        }
      >
        Revisa la dirección o vuelve al inicio del panel.
      </Empty>
    </main>
  );
}

export function RouteError() {
  const error = useRouteError();
  console.error(error);
  return (
    <main className="page">
      <Empty
        title="No se pudo abrir esta sección"
        action={
          <Button variant="primary" onClick={() => location.reload()}>
            Volver a intentar
          </Button>
        }
      >
        Revisa tu conexión a internet.
      </Empty>
    </main>
  );
}
