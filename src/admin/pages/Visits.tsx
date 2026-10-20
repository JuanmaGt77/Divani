/**
 * Visitas: cuántas personas entran a la tienda en línea, de dónde llegan (Instagram, WhatsApp…),
 * desde qué ciudad y dispositivo, a qué hora y qué prendas miran más. Todo es anónimo: no hay
 * nombres, teléfonos ni direcciones IP. El equipo (navegadores con el panel abierto) no se cuenta.
 */
import { useMemo, useState } from 'react';
import {
  Clock,
  DoorOpen,
  Eye,
  FileText,
  MapPin,
  Share2,
  Shirt,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Users,
} from 'lucide-react';
import { dateShort, delta, getRegion, monthYear, number, percent, plural, weekday } from '@/lib/format';
import type { VisitsSummary } from '@/lib/types';
import { VISIT_DEVICES, deviceLabel, placeLabel, sourceLabel } from '@/lib/visits';
import { api } from '../api';
import { LiveNow } from '../components/VisitsToday';
import { bucketKey, buckets, granularity, previousRange, type DateRange, type Unit } from '../lib/dates';
import { useIsMobile } from '../lib/hooks';
import { navigate } from '../lib/navigation';
import { useData } from '../lib/query';
import { AreaChart, BarList, Legend, MUTED, StackedBar, seriesColor } from '../ui/charts';
import { DateRangePicker, rangeLabel, resolveRange, type RangeValue } from '../ui/pickers';
import { Card, Empty, PageHeader, Skeleton, Stat, Thumb } from '../ui/surfaces';

const unitLabel = (unit: Unit, d: Date): string =>
  unit === 'day' ? `${weekday(d)} ${dateShort(d)}` : unit === 'week' ? `Semana del ${dateShort(d)}` : monthYear(d);

/** «8 p. m.» con el idioma de la región. */
const hourLabel = (h: number): string =>
  new Date(2000, 0, 1, h).toLocaleTimeString(getRegion().locale, { hour: 'numeric' });

/** Un día del servidor («2026-10-20») como fecha local. */
const dayDate = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y || 2000, (m || 1) - 1, d || 1);
};

/** Visitas por día, semana o mes (según el periodo), con los días sin visitas en cero. */
function seriesOf(byDay: { day: string; visits: number; visitors?: number }[], range: DateRange, unit: Unit) {
  const points = buckets(range, unit).map((b) => ({
    key: b.key,
    date: b.date,
    label: unitLabel(unit, b.date),
    value: 0,
    // Personas distintas solo por día (sumar días contaría dos veces a quien volvió)
    count: unit === 'day' ? 0 : undefined,
  }));
  const index = new Map(points.map((p, i) => [p.key, i]));
  for (const d of byDay) {
    const p = points[index.get(bucketKey(dayDate(d.day), unit)) ?? -1];
    if (!p) continue;
    p.value += d.visits;
    if (p.count !== undefined) p.count += d.visitors || 0;
  }
  return points;
}

/** Nombre amable de una página de la tienda. */
function pageName(path: string, products: Map<string, string>): string {
  if (path === '/') return 'Inicio';
  if (path === '/tienda') return 'Tienda';
  if (path === '/aviso-de-privacidad') return 'Aviso de privacidad';
  const slug = /^\/producto\/([^/]+)/.exec(path)?.[1];
  if (slug) {
    const name = products.get(safeDecode(slug));
    return name ? `Prenda: ${name}` : 'Página de una prenda';
  }
  return path;
}

const safeDecode = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Mensaje claro cuando falta activar el contador en Supabase. */
function errorText(error: Error): string {
  return /no está actualizada|schema cache|does not exist|Could not find the function/i.test(error.message)
    ? 'Falta activar el contador de visitas en la base de datos (Supabase). Cuando esté activo, aquí aparecerán.'
    : error.message;
}

export default function Visits() {
  const mobile = useIsMobile();
  const [range, setRange] = useState<RangeValue>({ preset: '30d' });
  const r = resolveRange(range);
  const prev = previousRange(r);
  const { data, loading, error, refreshing } = useData(
    ['visits', 'summary', r.from.toISOString(), r.to.toISOString()],
    () => api.visits.summary(r, prev),
    ['visits'],
  );
  const { data: products } = useData(['products'], () => api.catalog.products(), ['products', 'inventory']);
  const empty = data && !data.totals.visits && !data.previous.visits;

  return (
    <main className="page page--wide">
      <PageHeader
        title="Visitas"
        sub="Cuántas personas entran a tu tienda en línea, de dónde llegan y qué prendas miran."
        actions={
          <>
            <DateRangePicker value={range} onChange={setRange} align={mobile ? 'left' : 'right'} />
            <LiveNow short={mobile} />
          </>
        }
      />

      {error ? (
        <Card>
          <Empty icon={DoorOpen} title="No pudimos cargar las visitas">
            {errorText(error)}
          </Empty>
        </Card>
      ) : loading || !data ? (
        <VisitsSkeleton />
      ) : empty ? (
        <Card>
          <Empty icon={DoorOpen} title="Todavía no hay visitas en este periodo">
            Comparte el enlace de tu tienda en Instagram, Facebook o WhatsApp: aquí verás cuántas personas entran, de
            dónde llegan y qué prendas miran.
          </Empty>
        </Card>
      ) : (
        <div className={refreshing ? 'is-refreshing-block' : ''}>
          <VisitsReport
            data={data}
            r={r}
            prev={prev}
            period={rangeLabel(range)}
            names={new Map((products || []).map((p) => [p.slug, p.name]))}
            ids={new Map((products || []).map((p) => [p.slug, p.id]))}
          />
        </div>
      )}

      <p className="visits-note">
        Las visitas se cuentan sin cookies ni datos personales. No se cuentan tus visitas, las del equipo (los
        navegadores donde se abrió el panel) ni las de robots. Las ciudades son aproximadas.
      </p>
    </main>
  );
}

function VisitsReport({
  data,
  r,
  prev,
  period,
  names,
  ids,
}: {
  data: VisitsSummary;
  r: DateRange;
  prev: DateRange;
  period: string;
  names: Map<string, string>;
  ids: Map<string, string>;
}) {
  const T = data.totals;
  const P = data.previous;
  const conv = T.visits ? Math.min(1, T.orders / T.visits) : 0;
  const convPrev = P.visits ? Math.min(1, P.orders / P.visits) : 0;
  const unit = granularity(r);
  const points = seriesOf(data.byDay, r, unit);
  const compare = seriesOf(data.previousByDay, prev, unit);
  const share = (v: number) => (T.visits ? percent(v / T.visits) : '');

  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, h) => data.byHour.find((x) => x.hour === h)?.visits || 0),
    [data.byHour],
  );
  const most = Math.max(...hours);
  const peak = most > 0 ? hours.indexOf(most) : -1;
  const topSource = data.sources[0];
  const mobile = data.devices.find((d) => d.device === 'celular')?.visits || 0;
  // País de la tienda (es-GT → GT): las visitas de ahí no repiten el país
  const home = getRegion().locale.split('-')[1] || 'GT';

  return (
    <div className="stack" style={{ '--gap': '20px' }}>
      <div className="grid kpis" style={{ '--cols': 4, '--cols-m': 2 }}>
        <Card bodyClass={false}>
          <Stat
            icon={DoorOpen}
            label="Visitas"
            value={number(T.visits)}
            delta={delta(T.visits, P.visits)}
            foot={`vs. ${number(P.visits)}`}
          />
        </Card>
        <Card bodyClass={false}>
          <Stat
            icon={Users}
            label="Personas"
            value={number(T.visitors)}
            delta={delta(T.visitors, P.visitors)}
            foot={plural(T.newVisitors, 'nueva', 'nuevas')}
          />
        </Card>
        <Card bodyClass={false}>
          <Stat
            icon={Eye}
            label="Páginas vistas"
            value={number(T.pageViews)}
            delta={delta(T.pageViews, P.pageViews)}
            foot={T.visits ? `${number(T.pageViews / T.visits, 1)} por visita` : ''}
          />
        </Card>
        <Card bodyClass={false}>
          <Stat
            icon={ShoppingBag}
            label="Hacen pedido"
            value={percent(conv, conv && conv < 0.1 ? 1 : 0)}
            delta={P.visits ? delta(conv, convPrev) : null}
            foot={plural(T.orders, 'pedido', 'pedidos')}
          />
        </Card>
      </div>

      <Card
        title="Visitas en el tiempo"
        sub={`${period} · ${unit === 'day' ? 'por día' : unit === 'week' ? 'por semana' : 'por mes'}`}
        icon={TrendingUp}
        actions={
          <Legend
            items={[
              { label: 'Este periodo', color: seriesColor(0), line: true },
              { label: 'Periodo anterior', color: MUTED, line: true },
            ]}
          />
        }
      >
        <AreaChart
          points={points}
          compare={compare}
          format={(v) => number(v)}
          tickLabel={(p) =>
            unit === 'month' ? (monthYear(p.date).split(' ')[0] || '').slice(0, 3) : dateShort(p.date)
          }
          tipTitle={(p) => p.label}
          seriesLabel="visitas"
          countLabel="personas"
          height={260}
        />
      </Card>

      <div className="grid dash-row" style={{ '--cols': 2 }}>
        <Card
          title="De dónde llegan"
          sub={
            topSource
              ? `La mayoría llega desde ${topSource.source === 'directo' ? 'un enlace directo' : sourceLabel(topSource.source)}`
              : 'La app o página desde la que entraron'
          }
          icon={Share2}
        >
          <BarList
            rows={data.sources.map((s) => ({
              key: s.source,
              label: sourceLabel(s.source),
              sub: share(s.visits),
              value: s.visits,
            }))}
            format={(v) => number(v)}
          />
          {data.sources.some((s) => s.source === 'directo') && (
            <p className="visits-hint">
              «Directo»: escribieron la dirección o abrieron un enlace sin origen (por ejemplo, desde un chat).
            </p>
          )}
        </Card>
        <Card
          title="Dispositivo"
          sub={T.visits ? `${percent(mobile / T.visits)} entra desde el celular` : 'Desde dónde navegan'}
          icon={Smartphone}
        >
          <StackedBar
            format={(v) => number(v)}
            segments={VISIT_DEVICES.map((d, i) => ({
              key: d.id,
              label: deviceLabel(d.id),
              value: data.devices.find((x) => x.device === d.id)?.visits || 0,
              color: seriesColor(i),
            }))}
          />
        </Card>
      </div>

      <div className="grid dash-row" style={{ '--cols': 2 }}>
        <Card title="Desde dónde" sub="Ciudad aproximada de cada visita" icon={MapPin}>
          <BarList
            rows={data.places.map((p, i) => {
              const place = placeLabel(p, home);
              return {
                key: `${p.country}-${p.region}-${p.city}-${i}`,
                label: place.label,
                sub: place.sub,
                value: p.visits,
              };
            })}
            format={(v) => number(v)}
          />
        </Card>
        <Card
          title="Horas con más visitas"
          sub={peak >= 0 ? `Más visitas a las ${hourLabel(peak)}: buen momento para publicar` : 'Hora de cada visita'}
          icon={Clock}
        >
          <HourChart hours={hours} peak={peak} />
        </Card>
      </div>

      <div className="grid dash-row" style={{ '--cols': 2 }}>
        <Card title="Prendas más vistas" sub="En su página o en la vista rápida" icon={Shirt}>
          <BarList
            rows={data.products.map((p) => ({
              key: p.slug,
              label: p.name,
              value: p.views,
              media: <Thumb src={p.image} size={30} />,
            }))}
            format={(v) => number(v)}
            empty="Todavía nadie ha abierto una prenda en este periodo"
            onSelect={(row) => {
              const id = ids.get(row.key);
              if (id) navigate(`/productos/${id}`);
            }}
          />
        </Card>
        <Card title="Páginas más vistas" sub="Dónde pasan más tiempo" icon={FileText}>
          <BarList
            rows={data.pages.map((p) => ({ key: p.path, label: pageName(p.path, names), value: p.views }))}
            format={(v) => number(v)}
          />
        </Card>
      </div>
    </div>
  );
}

/** 24 barras, una por hora; la hora con más visitas resalta. */
function HourChart({ hours, peak }: { hours: number[]; peak: number }) {
  const max = Math.max(1, ...hours);
  const label =
    peak >= 0
      ? `Visitas por hora. La hora con más visitas es ${hourLabel(peak)}, con ${plural(hours[peak] || 0, 'visita', 'visitas')}.`
      : 'Todavía no hay visitas por hora.';
  return (
    <div className="hours" role="img" aria-label={label}>
      <div className="hours__bars">
        {hours.map((v, h) => (
          <span
            key={h}
            className={h === peak ? 'hours__bar is-peak' : v ? 'hours__bar' : 'hours__bar is-zero'}
            style={{ '--h': `${Math.max(4, Math.round((v / max) * 100))}%` }}
            title={`${hourLabel(h)}: ${plural(v, 'visita', 'visitas')}`}
          />
        ))}
      </div>
      <div className="hours__axis" aria-hidden="true">
        {[0, 6, 12, 18].map((h) => (
          <span key={h}>{hourLabel(h)}</span>
        ))}
      </div>
    </div>
  );
}

function VisitsSkeleton() {
  return (
    <div className="stack" style={{ '--gap': '20px' }} aria-busy="true" aria-label="Cargando visitas">
      <div className="grid kpis" style={{ '--cols': 4, '--cols-m': 2 }}>
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} bodyClass={false}>
            <div className="stat">
              <Skeleton h={13} w="55%" />
              <Skeleton h={30} w="60%" />
              <Skeleton h={12} w="40%" />
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <Skeleton h={260} r="14px" />
      </Card>
      <div className="grid dash-row" style={{ '--cols': 2 }}>
        <Card>
          <Skeleton h={180} r="14px" />
        </Card>
        <Card>
          <Skeleton h={180} r="14px" />
        </Card>
      </div>
    </div>
  );
}
