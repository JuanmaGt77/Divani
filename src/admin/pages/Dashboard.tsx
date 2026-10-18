/**
 * Resumen: lo importante del día de un vistazo — ventas con su tendencia, pedidos por atender,
 * caja, lo más vendido, canales, formas de pago y alertas de inventario.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useStore } from '@nanostores/react';
import {
  Boxes,
  ChevronRight,
  CircleAlert,
  Globe,
  Package,
  Plus,
  Receipt,
  ScanBarcode,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  dateLong,
  dateShort,
  delta,
  greeting,
  money,
  moneyCompact,
  moneyR,
  monthYear,
  number,
  plural,
  relative,
  weekday,
} from '@/lib/format';
import { productStock } from '@/lib/model';
import { api } from '../api';
import { addDays, endOfDay, previousRange, rangeFor, startOfDay, startOfMonth } from '../lib/dates';
import { navigate } from '../lib/navigation';
import { useData } from '../lib/query';
import { byChannel, byPayment, byProduct, inventoryValue, salesIn, series, summarize } from '../lib/reports';
import { session, settingsStore } from '../lib/session';
import { AreaChart, BarList, Legend, MUTED, Sparkline, StackedBar, seriesColor } from '../ui/charts';
import { Button, Segmented } from '../ui/controls';
import { Banner, Card, Empty, PageHeader, Skeleton, Stat, StatusBadge, Thumb } from '../ui/surfaces';

const PERIODS = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
];

export default function Dashboard() {
  const settings = useStore(settingsStore);
  const user = useStore(session).user;
  const [period, setPeriod] = useState('30d');
  const [now] = useState(() => new Date());
  const from = addDays(startOfDay(now), -190);
  const { data: orders } = useData(
    ['orders', 'dashboard', from.toISOString()],
    () => api.orders.list({ from, to: endOfDay(now) }),
    ['orders'],
  );
  const { data: products } = useData(['products'], () => api.catalog.products(), ['products', 'inventory']);
  const { data: cash } = useData(['cash', 'current'], () => api.cash.current(), ['cash', 'orders']);

  const k = useMemo(() => {
    if (!orders) return null;
    const today = { from: startOfDay(now), to: endOfDay(now) };
    const yesterday = { from: addDays(today.from, -1), to: new Date(now.getTime() - 864e5) };
    const mtd = { from: startOfMonth(now), to: endOfDay(now) };
    const pmStart = startOfMonth(addDays(startOfMonth(now), -1));
    const pm = { from: pmStart, to: endOfDay(addDays(pmStart, now.getDate() - 1)) };
    const d30 = rangeFor('30d', now);
    const p30 = previousRange(d30);
    const s = (r: { from: Date; to: Date }) => summarize(salesIn(orders, r));
    const last14Range = { from: addDays(today.from, -13), to: today.to };
    const last14 = series(salesIn(orders, last14Range), last14Range, 'day').points.map((p) => p.total);
    const open = orders.filter((o) => ['nuevo', 'confirmado', 'preparando', 'enviado'].includes(o.status));
    return {
      today: s(today),
      yesterday: s(yesterday),
      mtd: s(mtd),
      pm: s(pm),
      d30: s(d30),
      p30: s(p30),
      last14,
      open,
      newCount: open.filter((o) => o.status === 'nuevo').length,
      toCollect: open.filter((o) => o.paymentStatus === 'pendiente').reduce((a, o) => a + o.total, 0),
      sales30: salesIn(orders, d30),
    };
  }, [orders, now]);

  const chart = useMemo(() => {
    if (!orders) return null;
    const range = rangeFor(period, now);
    const prev = previousRange(range);
    const cur = series(salesIn(orders, range), range, 'day');
    const before = series(salesIn(orders, prev), prev, 'day');
    return {
      range,
      cur,
      before,
      total: summarize(salesIn(orders, range)),
      prevTotal: summarize(salesIn(orders, prev)),
    };
  }, [orders, period, now]);

  const top = useMemo(() => (k ? byProduct(k.sales30).slice(0, 6) : []), [k]);
  const channels = useMemo(() => (k ? byChannel(k.sales30) : []), [k]);
  const payments = useMemo(() => (k ? byPayment(k.sales30) : []), [k]);
  const inv = useMemo(() => inventoryValue(products || []), [products]);
  const lastPieces = settings?.private?.inventory?.lastPieces ?? 2;
  const almostOut = useMemo(
    () =>
      (products || [])
        .filter((p) => p.status === 'activo')
        .map((p) => ({ p, s: productStock(p) }))
        .filter((x) => x.s > 0 && x.s <= lastPieces)
        .sort((a, b) => a.s - b.s),
    [products, lastPieces],
  );
  const soldOut = useMemo(
    () => (products || []).filter((p) => p.status === 'activo' && productStock(p) <= 0),
    [products],
  );

  const name = user?.name && user.name !== 'Administración' ? `, ${user.name.split(' ')[0]}` : '';

  return (
    <main className="page page--wide dashboard">
      <PageHeader
        eyebrow={dateLong(now)}
        title={`${greeting(now)}${name}`}
        sub="Así va tu tienda hoy."
        actions={
          <>
            <Button icon={Plus} onClick={() => navigate('/productos/nuevo')}>
              Nuevo producto
            </Button>
            <Button variant="primary" icon={ScanBarcode} onClick={() => navigate('/vender')}>
              Nueva venta
            </Button>
          </>
        }
      />

      <div className="alerts">
        {k && k.newCount > 0 && (
          <Banner
            tone="info"
            icon={ShoppingBag}
            action={
              <Button size="sm" variant="primary" onClick={() => navigate('/pedidos?estado=nuevo')}>
                Ver pedidos
              </Button>
            }
          >
            <strong>{plural(k.newCount, 'pedido nuevo', 'pedidos nuevos')}</strong>{' '}
            {k.newCount === 1 ? 'espera' : 'esperan'} tu confirmación por WhatsApp.
          </Banner>
        )}
        {cash !== undefined && !cash?.session && (
          <Banner
            icon={Wallet}
            action={
              <Button size="sm" onClick={() => navigate('/caja')}>
                Ir a caja
              </Button>
            }
          >
            <strong>La caja está cerrada.</strong> Ábrela para vender en mostrador.
          </Banner>
        )}
      </div>

      <div className="grid kpis" style={{ '--cols': 4, '--cols-m': 2 }}>
        <Card bodyClass={false}>
          {k ? (
            <Stat
              icon={TrendingUp}
              label="Ventas de hoy"
              value={moneyR(k.today.total)}
              delta={delta(k.today.total, k.yesterday.total)}
              foot="vs. ayer a esta hora"
            >
              <Sparkline values={k.last14} />
            </Stat>
          ) : (
            <StatSkeleton />
          )}
        </Card>
        <Card bodyClass={false}>
          {k ? (
            <Stat
              icon={Sparkles}
              label={`Ventas de ${monthYear(now).split(' ')[0]}`}
              value={moneyR(k.mtd.total)}
              delta={delta(k.mtd.total, k.pm.total)}
              foot="vs. mismo periodo del mes pasado"
            />
          ) : (
            <StatSkeleton />
          )}
        </Card>
        <Card bodyClass={false}>
          {k ? (
            <Stat
              icon={Receipt}
              label="Ticket promedio"
              value={moneyR(k.d30.avgTicket)}
              delta={delta(k.d30.avgTicket, k.p30.avgTicket)}
              foot={`${number(k.d30.count)} ventas en 30 días`}
            />
          ) : (
            <StatSkeleton />
          )}
        </Card>
        <Card bodyClass={false} className="kpi-link" onClick={() => navigate('/pedidos')}>
          {k ? (
            <Stat
              icon={ShoppingBag}
              label="Pedidos por atender"
              value={number(k.open.length)}
              foot={k.toCollect ? `${moneyR(k.toCollect)} por cobrar` : 'Todo cobrado'}
            />
          ) : (
            <StatSkeleton />
          )}
        </Card>
      </div>

      <Card
        className="sales-card"
        title="Ventas"
        icon={TrendingUp}
        actions={<Segmented value={period} onChange={setPeriod} options={PERIODS} label="Periodo de la gráfica" />}
      >
        {chart ? (
          <div className="stack" style={{ '--gap': '14px' }}>
            <div className="sales-head">
              <div>
                <p className="sales-head__value">{moneyR(chart.total.total)}</p>
                <p className="muted small">
                  {plural(chart.total.count, 'venta', 'ventas')} · {plural(chart.total.items, 'pieza', 'piezas')} ·
                  utilidad {moneyR(chart.total.profit)}
                </p>
              </div>
              <div className="sales-head__end">
                <Legend
                  items={[
                    { label: 'Este periodo', color: seriesColor(0), line: true },
                    { label: 'Periodo anterior', color: MUTED, line: true },
                  ]}
                />
                <span className="small muted">
                  {delta(chart.total.total, chart.prevTotal.total).text} vs. {moneyR(chart.prevTotal.total)}
                </span>
              </div>
            </div>
            <AreaChart
              points={chart.cur.points.map((p) => ({ ...p, value: p.total, label: dateShort(p.date) }))}
              compare={chart.before.points.map((p) => ({ value: p.total }))}
              format={(v) => moneyR(v)}
              formatAxis={moneyCompact}
              tickLabel={(p) => (period === '7d' ? weekday(p.date) : dateShort(p.date))}
              tipTitle={(p) => `${weekday(p.date)} ${dateShort(p.date)}`}
              countLabel="ventas"
              seriesLabel="Ventas"
              height={260}
            />
          </div>
        ) : (
          <Skeleton h={300} r="14px" />
        )}
      </Card>

      <div className="grid dash-row" style={{ '--cols': 2 }}>
        <Card
          title="Pedidos recientes"
          icon={ShoppingBag}
          bodyClass={false}
          actions={
            <Link className="link-btn small" to="/pedidos">
              Ver todos <ChevronRight aria-hidden="true" />
            </Link>
          }
        >
          {!orders ? (
            <div style={{ padding: '18px 20px' }}>
              <Skeleton h={220} />
            </div>
          ) : !orders.length ? (
            <Empty icon={ShoppingBag} title="Aún no hay pedidos" />
          ) : (
            <div className="list">
              {orders.slice(0, 6).map((o) => (
                <Link key={o.id} className="list__row" to={`/pedidos/${o.id}`} style={{ '--inset': '70px' }}>
                  <span className="list__icon">
                    {o.channel === 'tienda' ? <Store aria-hidden="true" /> : <Globe aria-hidden="true" />}
                  </span>
                  <span className="list__body">
                    <span className="list__title">
                      {o.customer?.name || (o.channel === 'tienda' ? 'Venta de mostrador' : 'Sin nombre')}
                    </span>
                    <span className="list__sub">
                      <span className="mono">{o.number}</span> · {relative(o.createdAt)}
                    </span>
                  </span>
                  <span className="list__end dash-order-end">
                    <strong className="num">{money(o.total)}</strong>
                    <StatusBadge status={o.status} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card title="Lo más vendido" sub="Últimos 30 días, por ventas" icon={Package}>
          {!k ? (
            <Skeleton h={240} />
          ) : (
            <BarList
              rows={top.map((r) => ({
                key: r.key,
                productId: r.productId,
                label: r.name,
                value: r.revenue,
                sub: plural(r.units, 'pz', 'pzs'),
                media: <Thumb src={r.image} size={30} />,
              }))}
              format={(v) => moneyR(v)}
              onSelect={(r) => r.productId && navigate(`/productos/${r.productId}`)}
            />
          )}
        </Card>
      </div>

      <div className="grid dash-row" style={{ '--cols': 3 }}>
        <Card title="Por canal" sub="Últimos 30 días" icon={Store}>
          {!k ? (
            <Skeleton h={120} />
          ) : (
            <StackedBar
              format={(v) => moneyR(v)}
              segments={channels.map((c, i) => ({
                key: c.key,
                label: c.key === 'tienda' ? 'Mostrador' : c.name,
                value: c.amount,
                color: seriesColor(i),
              }))}
            />
          )}
        </Card>
        <Card title="Formas de pago" sub="Últimos 30 días" icon={Wallet}>
          {!k ? (
            <Skeleton h={120} />
          ) : (
            <BarList
              rows={payments.map((p) => ({
                key: p.key,
                label: p.name,
                value: p.amount,
                sub: plural(p.count, 'pago', 'pagos'),
              }))}
              format={(v) => moneyR(v)}
            />
          )}
        </Card>
        <Card
          title="Inventario"
          icon={Boxes}
          actions={
            <Link className="link-btn small" to="/inventario">
              Abrir <ChevronRight aria-hidden="true" />
            </Link>
          }
        >
          {!products ? (
            <Skeleton h={160} />
          ) : (
            <div className="stack" style={{ '--gap': '12px' }}>
              <div className="inv-mini">
                <div>
                  <strong>{number(inv.units)}</strong>
                  <span>piezas</span>
                </div>
                <div>
                  <strong>{moneyCompact(inv.retail)}</strong>
                  <span>valor de venta</span>
                </div>
                <div>
                  <strong>{number(soldOut.length)}</strong>
                  <span>agotados</span>
                </div>
              </div>
              {almostOut.length > 0 ? (
                <div className="stack" style={{ '--gap': '8px' }}>
                  <p className="small muted row">
                    <CircleAlert aria-hidden="true" className="ico-sm" style={{ color: 'var(--amber)' }} />
                    Últimas piezas
                  </p>
                  {almostOut.slice(0, 4).map(({ p, s }) => (
                    <Link key={p.id} className="row mini-row" to={`/productos/${p.id}`}>
                      <Thumb src={p.colors[0]?.images?.[0]} size={28} />
                      <span className="grow ellipsis small">{p.name}</span>
                      <span className="small strong">{s}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="small muted">Ningún producto está por agotarse.</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}

function StatSkeleton() {
  return (
    <div className="stat">
      <Skeleton h={13} w="55%" />
      <Skeleton h={30} w="70%" />
      <Skeleton h={12} w="40%" />
    </div>
  );
}
