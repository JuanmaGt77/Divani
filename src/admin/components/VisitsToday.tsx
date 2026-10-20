/**
 * Visitas en vivo para el panel: la píldora «personas en la tienda ahora» y la franja del Resumen
 * (visitas de hoy contra ayer a la misma hora, tendencia de 14 días). Llevan a Panel → Visitas.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, DoorOpen } from 'lucide-react';
import { delta, number, plural } from '@/lib/format';
import { api } from '../api';
import { addDays, dayKey, endOfDay, startOfDay } from '../lib/dates';
import { useData } from '../lib/query';
import { Sparkline } from '../ui/charts';
import { Delta, Skeleton } from '../ui/surfaces';

/** Personas en la tienda en este momento (vistas de los últimos 5 minutos; se actualiza sola). */
export function LiveNow({ short }: { short?: boolean }) {
  const { data, error } = useData(['visits', 'live'], () => api.visits.live(), ['visits'], { refetchInterval: 30_000 });
  if (error || !data) return null;
  const n = data.now;
  return (
    <span className={n ? 'live-pill' : 'live-pill is-quiet'} role="status" title="Personas viendo la tienda ahora">
      <span className="live-pill__dot" aria-hidden="true" />
      {n ? (
        <span>
          <strong className="num">{number(n)}</strong>{' '}
          {short ? 'ahora' : n === 1 ? 'persona en la tienda' : 'personas en la tienda'}
        </span>
      ) : (
        <span>{short ? 'Nadie ahora' : 'Nadie en la tienda ahora'}</span>
      )}
    </span>
  );
}

/** Franja del Resumen. Si el contador no está activo en la base de datos, no se muestra. */
export function VisitsToday() {
  const [now] = useState(() => new Date());
  const today = startOfDay(now);
  const { data, error } = useData(
    ['visits', 'today', dayKey(now)],
    () =>
      api.visits.summary(
        { from: addDays(today, -13), to: endOfDay(now) },
        // Ayer, desde las 0:00 hasta esta misma hora
        { from: addDays(today, -1), to: new Date(Date.now() - 864e5) },
      ),
    ['visits'],
    { refetchInterval: 60_000 },
  );
  if (error) return null;
  if (!data) {
    return (
      <div className="card visits-strip" aria-hidden="true">
        <Skeleton h={40} w={40} r="12px" />
        <div className="stack" style={{ '--gap': '8px' }}>
          <Skeleton h={12} w="40%" />
          <Skeleton h={22} w="55%" />
        </div>
      </div>
    );
  }
  const todayRow = data.byDay.find((d) => d.day === dayKey(now));
  const visits = todayRow?.visits || 0;
  const people = todayRow?.visitors || 0;
  const last14 = Array.from(
    { length: 14 },
    (_, i) => data.byDay.find((d) => d.day === dayKey(addDays(today, i - 13)))?.visits || 0,
  );
  return (
    <Link className="card visits-strip" to="/visitas">
      <span className="visits-strip__icon" aria-hidden="true">
        <DoorOpen />
      </span>
      <span className="visits-strip__text">
        <span className="visits-strip__label">Visitas de hoy a la tienda en línea</span>
        <span className="visits-strip__value">
          <strong className="num">{number(visits)}</strong>
          <span>
            {visits === 1 ? 'visita' : 'visitas'} · {plural(people, 'persona', 'personas')}
          </span>
        </span>
        <span className="visits-strip__foot">
          <Delta d={delta(visits, data.previous.visits)} />
          vs. ayer a esta hora
        </span>
      </span>
      <span className="visits-strip__spark" title="Visitas de los últimos 14 días">
        <Sparkline values={last14} height={40} />
      </span>
      <span className="visits-strip__end">
        <LiveNow short />
        <ChevronRight className="visits-strip__chev" aria-hidden="true" />
      </span>
    </Link>
  );
}
