/**
 * Reportes: ventas, productos, categorías, pagos, inventario y cortes de caja, con filtros
 * por periodo, canal, categoría y forma de pago; comparación con el periodo anterior;
 * exportación a CSV (Excel) e impresión / PDF.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useStore } from '@nanostores/react';
import {
  Boxes,
  ChartColumn,
  Coins,
  Download,
  Globe,
  Layers,
  Lock,
  Package,
  Percent,
  Printer,
  Receipt,
  Shirt,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  dateMedium,
  dateShort,
  dateTime,
  delta,
  money,
  moneyCompact,
  moneyR,
  monthYear,
  number,
  percent,
  plural,
  time,
  weekday,
  type Delta,
} from '@/lib/format';
import { PAYMENT_METHODS, methodLabel, productStock, round2, saleDate } from '@/lib/model';
import type { CashSession, Category, Department, Order, Product, Settings } from '@/lib/types';
import { api } from '../api';
import { exportCsv, fileStamp } from '../lib/csv';
import { granularity, previousRange, startOfWeek, type DateRange, type Unit } from '../lib/dates';
import { printReport } from '../lib/documents';
import { matches, useIsMobile, useSort } from '../lib/hooks';
import { navigate, useSearch } from '../lib/navigation';
import { useData } from '../lib/query';
import {
  byCategory,
  byChannel,
  byPayment,
  byProduct,
  inventoryValue,
  salesIn,
  series,
  summarize,
  type Summary,
} from '../lib/reports';
import { settingsStore } from '../lib/session';
import { AreaChart, BarList, Legend, MUTED, StackedBar, seriesColor } from '../ui/charts';
import { Button, Chip, SearchField, Switch } from '../ui/controls';
import { DateRangePicker, rangeLabel, resolveRange, type RangeValue } from '../ui/pickers';
import { Badge, Card, Empty, PageHeader, Skeleton, SkeletonRows, Stat, Tabs, Thumb } from '../ui/surfaces';
import { SortTh } from '../ui/table';
import { DiffBadge } from './Cash';

type Tab = 'ventas' | 'productos' | 'categorias' | 'pagos' | 'inventario' | 'cortes';

const TABS = [
  { value: 'ventas' as Tab, label: 'Ventas', icon: TrendingUp },
  { value: 'productos' as Tab, label: 'Productos', icon: Shirt },
  { value: 'categorias' as Tab, label: 'Categorías', icon: Layers },
  { value: 'pagos' as Tab, label: 'Pagos y canales', icon: Wallet },
  { value: 'inventario' as Tab, label: 'Inventario', icon: Boxes },
  { value: 'cortes' as Tab, label: 'Cortes de caja', icon: Lock },
];

/** Restringe cada venta a las prendas de una categoría (y reparte el descuento general). */
function onlyCategory(orders: Order[], slug: string, catOf: Map<string, string | null>): Order[] {
  return orders
    .map((o) => {
      const items = o.items.filter((i) => i.productId && catOf.get(i.productId) === slug);
      if (!items.length) return null;
      const base = o.items.reduce((a, i) => a + i.total, 0) || 1;
      const kept = items.reduce((a, i) => a + i.total, 0);
      const share = round2((kept / base) * (o.discount || 0));
      const subtotal = round2(items.reduce((a, i) => a + i.unitPrice * i.qty, 0));
      return {
        ...o,
        items,
        subtotal,
        discount: share,
        shipping: 0,
        total: round2(kept - share),
        costTotal: round2(items.reduce((a, i) => a + (i.unitCost || 0) * i.qty, 0)),
        itemsCount: items.reduce((a, i) => a + i.qty, 0),
      };
    })
    .filter((o): o is Order => o !== null);
}

const unitLabel = (unit: Unit, d: Date): string =>
  unit === 'day' ? `${weekday(d)} ${dateShort(d)}` : unit === 'week' ? `Semana del ${dateShort(d)}` : monthYear(d);

export default function Reports() {
  const settings = useStore(settingsStore);
  const { query, setQuery } = useSearch();
  const tab: Tab = TABS.some((t) => t.value === query.tipo) ? (query.tipo as Tab) : 'ventas';
  const [range, setRange] = useState<RangeValue>({ preset: '30d' });
  const [channel, setChannel] = useState('');
  const [category, setCategory] = useState('');
  const [method, setMethod] = useState('');
  const [compare, setCompare] = useState(true);
  const r = resolveRange(range);
  const prev = previousRange(r);
  const {
    data: orders,
    loading,
    refreshing,
  } = useData(
    ['orders', 'report', prev.from.toISOString(), r.to.toISOString()],
    () => api.orders.list({ from: prev.from, to: r.to }),
    ['orders'],
  );
  const { data: products } = useData(['products'], () => api.catalog.products(), ['products', 'inventory']);
  const { data: tax } = useData(['taxonomy'], () => api.catalog.taxonomy(), ['taxonomy']);
  const { data: sessions } = useData(
    ['cash', 'sessions', r.from.toISOString(), r.to.toISOString()],
    () => api.cash.sessions({ from: r.from, to: r.to }),
    ['cash'],
    { enabled: tab === 'cortes' },
  );

  const catOf = useMemo(() => new Map((products || []).map((p) => [p.id, p.category])), [products]);
  const cats = tax?.categories || [];
  const deps = tax?.departments || [];

  const filtered = useMemo(() => {
    if (!orders) return null;
    let list = orders.filter(
      (o) =>
        (!channel || (channel === 'web' ? o.channel !== 'tienda' : o.channel === channel)) &&
        (!method || (o.payments?.length ? o.payments.some((p) => p.method === method) : o.paymentMethod === method)),
    );
    if (category) list = onlyCategory(list, category, catOf);
    return list;
  }, [orders, channel, method, category, catOf]);

  const rFrom = r.from.getTime();
  const rTo = r.to.getTime();
  const prevFrom = prev.from.getTime();
  const cur = useMemo(
    () => (filtered ? salesIn(filtered, { from: new Date(rFrom), to: new Date(rTo) }) : []),
    [filtered, rFrom, rTo],
  );
  const before = useMemo(
    () => (filtered ? salesIn(filtered, { from: new Date(prevFrom), to: new Date(rFrom - 1) }) : []),
    [filtered, prevFrom, rFrom],
  );
  const S = useMemo(() => summarize(cur), [cur]);
  const P = useMemo(() => summarize(before), [before]);

  const period = rangeLabel(range);
  const filterLabels = [
    channel && (channel === 'web' ? 'Tienda en línea' : 'Mostrador'),
    category && `Categoría: ${cats.find((c) => c.slug === category)?.name || category}`,
    method && `Pago: ${methodLabel(method)}`,
  ].filter(Boolean) as string[];

  const dd = (a: number, b: number): Delta | null => (compare ? delta(a, b) : null);

  return (
    <main className="page page--wide">
      <PageHeader
        title="Reportes"
        sub="Analiza tus ventas con los filtros que necesites, compáralas con el periodo anterior y expórtalas."
        actions={
          <>
            <Button
              icon={Download}
              onClick={() => exportTab({ tab, cur, products, cats, deps, sessions })}
              disabled={!orders}
            >
              Exportar CSV
            </Button>
            <Button
              icon={Printer}
              onClick={() =>
                printTab({ tab, cur, S, P, products, cats, deps, sessions, r, period, filterLabels, settings, compare })
              }
              disabled={!orders}
            >
              Imprimir / PDF
            </Button>
          </>
        }
      />

      <div className="report-filters card">
        <DateRangePicker value={range} onChange={setRange} />
        <div className="chips">
          <Chip pressed={!channel} onClick={() => setChannel('')}>
            Todos los canales
          </Chip>
          <Chip pressed={channel === 'web'} icon={Globe} onClick={() => setChannel('web')}>
            En línea
          </Chip>
          <Chip pressed={channel === 'tienda'} icon={Store} onClick={() => setChannel('tienda')}>
            Mostrador
          </Chip>
        </div>
        <select
          className="input input--sm filter-select"
          value={category}
          onChange={(e) => setCategory(e.currentTarget.value)}
          aria-label="Categoría"
        >
          <option value="">Todas las categorías</option>
          {deps.map((d) => (
            <optgroup key={d.slug} label={d.name}>
              {cats
                .filter((c) => c.department === d.slug)
                .map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <select
          className="input input--sm filter-select"
          value={method}
          onChange={(e) => setMethod(e.currentTarget.value)}
          aria-label="Forma de pago"
        >
          <option value="">Cualquier forma de pago</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <label className="row compare-toggle">
          <Switch checked={compare} onChange={setCompare} label="Comparar con el periodo anterior" />
          <span className="small">Comparar con el periodo anterior</span>
        </label>
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={(v) => setQuery({ tipo: v === 'ventas' ? '' : v })}
        items={TABS}
        label="Tipo de reporte"
      />

      {loading || !filtered ? (
        <Card>
          <Skeleton h={320} r="14px" />
        </Card>
      ) : (
        <div className={refreshing ? 'is-refreshing-block' : ''}>
          {tab === 'ventas' && (
            <SalesReport cur={cur} before={before} S={S} P={P} r={r} prev={prev} dd={dd} compare={compare} />
          )}
          {tab === 'productos' && <ProductsReport cur={cur} products={products} />}
          {tab === 'categorias' && <CategoriesReport cur={cur} products={products} cats={cats} deps={deps} S={S} />}
          {tab === 'pagos' && <PaymentsReport cur={cur} />}
          {tab === 'inventario' && <InventoryReport products={products} cats={cats} deps={deps} />}
          {tab === 'cortes' && <CutsReport sessions={sessions} />}
        </div>
      )}
    </main>
  );
}

/* ---------- Ventas ---------- */
function SalesReport({
  cur,
  before,
  S,
  P,
  r,
  prev,
  dd,
  compare,
}: {
  cur: Order[];
  before: Order[];
  S: Summary;
  P: Summary;
  r: DateRange;
  prev: DateRange;
  dd: (a: number, b: number) => Delta | null;
  compare: boolean;
}) {
  const unit = granularity(r);
  const s1 = series(cur, r, unit);
  const s0 = series(before, prev, unit);
  const [showSales, setShowSales] = useState(false);
  return (
    <div className="stack" style={{ '--gap': '20px' }}>
      <div className="grid" style={{ '--cols': 3, '--cols-m': 2 }}>
        <Card bodyClass={false}>
          <Stat
            icon={TrendingUp}
            label="Ventas netas"
            value={moneyR(S.net)}
            delta={dd(S.net, P.net)}
            foot={compare ? `vs. ${moneyR(P.net)}` : 'sin envíos'}
          />
        </Card>
        <Card bodyClass={false}>
          <Stat
            icon={Receipt}
            label="Número de ventas"
            value={number(S.count)}
            delta={dd(S.count, P.count)}
            foot={compare ? `vs. ${number(P.count)}` : ''}
          />
        </Card>
        <Card bodyClass={false}>
          <Stat
            icon={Coins}
            label="Ticket promedio"
            value={moneyR(S.avgTicket)}
            delta={dd(S.avgTicket, P.avgTicket)}
            foot={`${number(S.unitsPerSale, 1)} piezas por venta`}
          />
        </Card>
        <Card bodyClass={false}>
          <Stat icon={Package} label="Piezas vendidas" value={number(S.items)} delta={dd(S.items, P.items)} />
        </Card>
        <Card bodyClass={false}>
          <Stat
            icon={Percent}
            label="Descuentos"
            value={moneyR(S.discounts)}
            foot={S.gross ? `${percent(S.discounts / S.gross, 1)} de la venta bruta` : ''}
          />
        </Card>
        <Card bodyClass={false}>
          <Stat
            icon={ChartColumn}
            label="Utilidad bruta"
            value={moneyR(S.profit)}
            delta={dd(S.profit, P.profit)}
            foot={`Margen ${percent(S.margin, 1)}`}
          />
        </Card>
      </div>

      <Card
        title="Ventas en el tiempo"
        icon={TrendingUp}
        sub={unit === 'day' ? 'Por día' : unit === 'week' ? 'Por semana' : 'Por mes'}
        actions={
          compare && (
            <Legend
              items={[
                { label: 'Este periodo', color: seriesColor(0), line: true },
                { label: 'Periodo anterior', color: MUTED, line: true },
              ]}
            />
          )
        }
      >
        {S.count || P.count ? (
          <AreaChart
            points={s1.points.map((p) => ({ ...p, value: p.total, label: unitLabel(unit, p.date) }))}
            compare={compare ? s0.points.map((p) => ({ value: p.total })) : null}
            format={(v) => moneyR(v)}
            formatAxis={moneyCompact}
            tickLabel={(p) =>
              unit === 'month' ? (monthYear(p.date).split(' ')[0] || '').slice(0, 3) : dateShort(p.date)
            }
            tipTitle={(p) => unitLabel(unit, p.date)}
            height={280}
          />
        ) : (
          <Empty icon={TrendingUp} title="Sin ventas en este periodo">
            Cambia el periodo o quita filtros.
          </Empty>
        )}
      </Card>

      <Card title="Detalle por periodo" icon={Receipt} bodyClass={false}>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Periodo</th>
                <th className="num">Total cobrado</th>
                <th className="num">Ventas</th>
                <th className="num">Piezas</th>
                <th className="num">Ticket prom.</th>
              </tr>
            </thead>
            <tbody>
              {[...s1.points].reverse().map((p) => {
                const list = cur.filter((o) => {
                  const d = new Date(saleDate(o));
                  return unit === 'day'
                    ? d.toDateString() === p.date.toDateString()
                    : unit === 'week'
                      ? startOfWeek(d).getTime() === p.date.getTime()
                      : d.getMonth() === p.date.getMonth() && d.getFullYear() === p.date.getFullYear();
                });
                const items = list.reduce((a, o) => a + (o.itemsCount || 0), 0);
                return (
                  <tr key={p.key}>
                    <td>{unitLabel(unit, p.date)}</td>
                    <td className="num strong">{moneyR(p.total)}</td>
                    <td className="num">{p.count}</td>
                    <td className="num">{items}</td>
                    <td className="num">{p.count ? moneyR(p.total / p.count) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{moneyR(S.total)}</td>
                <td className="num">{S.count}</td>
                <td className="num">{S.items}</td>
                <td className="num">{moneyR(S.avgTicket)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card
        title={`Ventas del periodo (${cur.length})`}
        icon={Receipt}
        bodyClass={false}
        actions={
          <Button size="sm" variant="ghost" onClick={() => setShowSales(!showSales)}>
            {showSales ? 'Ocultar' : 'Ver todas'}
          </Button>
        }
      >
        {showSales && (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Fecha</th>
                  <th>Canal</th>
                  <th>Cliente</th>
                  <th>Pago</th>
                  <th className="num">Piezas</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...cur]
                  .sort((a, b) => new Date(saleDate(b)).getTime() - new Date(saleDate(a)).getTime())
                  .map((o) => (
                    <tr key={o.id} className="is-link" onClick={() => navigate(`/pedidos/${o.id}`)}>
                      <td className="mono">{o.number}</td>
                      <td className="small">
                        {dateShort(saleDate(o))} {time(saleDate(o))}
                      </td>
                      <td className="small">{o.channel === 'tienda' ? 'Mostrador' : 'En línea'}</td>
                      <td className="small">{o.customer?.name || '—'}</td>
                      <td className="small">{methodLabel(o.paymentMethod)}</td>
                      <td className="num">{o.itemsCount}</td>
                      <td className="num strong">{money(o.total)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Productos ---------- */
function ProductsReport({ cur, products }: { cur: Order[]; products: Product[] | undefined }) {
  const mobile = useIsMobile();
  const [q, setQ] = useState('');
  const rows = useMemo(
    () =>
      byProduct(cur).map((r) => {
        const p = (products || []).find((x) => x.id === r.productId);
        return { ...r, code: p?.code || '', stock: p ? productStock(p) : null };
      }),
    [cur, products],
  );
  const shown = rows.filter((r) => matches(q, r.name, r.code));
  const { rows: sorted, sort, setSort } = useSort(shown, { key: 'revenue', dir: 'desc' });
  const total = rows.reduce((a, r) => a + r.revenue, 0);
  if (!rows.length) {
    return (
      <Card>
        <Empty icon={Shirt} title="Sin ventas en este periodo" />
      </Card>
    );
  }
  return (
    <div className="stack" style={{ '--gap': '20px' }}>
      <Card title="Top 10 por ventas" icon={TrendingUp}>
        <BarList
          rows={rows.slice(0, 10).map((r) => ({
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
      </Card>
      <Card
        title={`Todos los productos vendidos (${rows.length})`}
        icon={Shirt}
        bodyClass={false}
        actions={<SearchField value={q} onValue={setQ} placeholder="Buscar producto" className="report-search" />}
      >
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <SortTh label="Producto" k="name" sort={sort} setSort={setSort} />
                <SortTh label="Piezas" k="units" sort={sort} setSort={setSort} num />
                <SortTh label="Ventas" k="revenue" sort={sort} setSort={setSort} num />
                {!mobile && <SortTh label="Costo" k="cost" sort={sort} setSort={setSort} num />}
                <SortTh label="Utilidad" k="profit" sort={sort} setSort={setSort} num />
                {!mobile && <SortTh label="Margen" k="margin" sort={sort} setSort={setSort} num />}
                {!mobile && <th className="num">% ventas</th>}
                {!mobile && <th className="num">Quedan</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.key}
                  className={r.productId ? 'is-link' : ''}
                  onClick={() => r.productId && navigate(`/productos/${r.productId}`)}
                >
                  <td>
                    <div className="cell-main">
                      <Thumb src={r.image} size={32} />
                      <div style={{ minWidth: 0 }}>
                        <div className="cell-title ellipsis">{r.name}</div>
                        <div className="cell-sub mono">{r.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num">{r.units}</td>
                  <td className="num strong">{moneyR(r.revenue)}</td>
                  {!mobile && <td className="num muted">{moneyR(r.cost)}</td>}
                  <td className="num">{moneyR(r.profit)}</td>
                  {!mobile && <td className="num">{r.cost ? percent(r.margin) : '—'}</td>}
                  {!mobile && <td className="num muted">{total ? percent(r.revenue / total, 1) : '—'}</td>}
                  {!mobile && <td className="num">{r.stock ?? '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Categorías ---------- */
function CategoriesReport({
  cur,
  products,
  cats,
  deps,
  S,
}: {
  cur: Order[];
  products: Product[] | undefined;
  cats: Category[];
  deps: Department[];
  S: Summary;
}) {
  const rows = byCategory(cur, products || [], cats);
  if (!rows.length) {
    return (
      <Card>
        <Empty icon={Layers} title="Sin ventas en este periodo" />
      </Card>
    );
  }
  const depName = (slug: string) => deps.find((d) => d.slug === slug)?.name || '—';
  const byDep = deps
    .map((d, i) => ({
      key: d.slug,
      label: d.name,
      value: rows.filter((r) => r.department === d.slug).reduce((a, r) => a + r.revenue, 0),
      color: seriesColor(i),
    }))
    .filter((x) => x.value > 0);
  return (
    <div className="stack" style={{ '--gap': '20px' }}>
      <div className="grid" style={{ '--cols': 2 }}>
        <Card title="Ventas por categoría" icon={Layers}>
          <BarList
            rows={rows.map((r) => ({ key: r.key, label: r.name, value: r.revenue, sub: depName(r.department) }))}
            format={(v) => moneyR(v)}
          />
        </Card>
        <Card title="Por departamento" icon={Layers}>
          {byDep.length <= 3 ? (
            <StackedBar segments={byDep} format={(v) => moneyR(v)} />
          ) : (
            <BarList rows={byDep} format={(v) => moneyR(v)} />
          )}
        </Card>
      </div>
      <Card title="Detalle" icon={Layers} bodyClass={false}>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Departamento</th>
                <th className="num">Piezas</th>
                <th className="num">Ventas</th>
                <th className="num">Utilidad</th>
                <th className="num">% del total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="strong">{r.name}</td>
                  <td className="muted">{depName(r.department)}</td>
                  <td className="num">{r.units}</td>
                  <td className="num strong">{moneyR(r.revenue)}</td>
                  <td className="num">{moneyR(r.profit)}</td>
                  <td className="num">{S.net ? percent(r.revenue / S.net, 1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Pagos y canales ---------- */
function PaymentsReport({ cur }: { cur: Order[] }) {
  const pays = byPayment(cur);
  const chans = byChannel(cur);
  if (!cur.length) {
    return (
      <Card>
        <Empty icon={Wallet} title="Sin ventas en este periodo" />
      </Card>
    );
  }
  const total = pays.reduce((a, p) => a + p.amount, 0);
  return (
    <div className="stack" style={{ '--gap': '20px' }}>
      <div className="grid" style={{ '--cols': 2 }}>
        <Card title="Formas de pago" icon={Wallet}>
          <BarList
            rows={pays.map((p) => ({
              key: p.key,
              label: p.name,
              value: p.amount,
              sub: plural(p.count, 'pago', 'pagos'),
            }))}
            format={(v) => moneyR(v)}
          />
        </Card>
        <Card title="Canales de venta" icon={Store}>
          <StackedBar
            segments={chans.map((c, i) => ({
              key: c.key,
              label: c.key === 'tienda' ? 'Mostrador' : c.name,
              value: c.amount,
              color: seriesColor(i),
            }))}
            format={(v) => moneyR(v)}
          />
        </Card>
      </div>
      <Card title="Detalle" icon={Wallet} bodyClass={false}>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Forma de pago</th>
                <th className="num">Pagos</th>
                <th className="num">Importe</th>
                <th className="num">%</th>
              </tr>
            </thead>
            <tbody>
              {pays.map((p) => (
                <tr key={p.key}>
                  <td className="strong">{p.name}</td>
                  <td className="num">{p.count}</td>
                  <td className="num strong">{money(p.amount)}</td>
                  <td className="num">{total ? percent(p.amount / total, 1) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{pays.reduce((a, p) => a + p.count, 0)}</td>
                <td className="num">{money(total)}</td>
                <td className="num">100 %</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Inventario (fotografía actual) ---------- */
function InventoryReport({
  products,
  cats,
  deps,
}: {
  products: Product[] | undefined;
  cats: Category[];
  deps: Department[];
}) {
  if (!products) {
    return (
      <Card>
        <SkeletonRows rows={5} />
      </Card>
    );
  }
  const v = inventoryValue(products);
  const rows = cats
    .map((c) => {
      const ps = products.filter((p) => p.category === c.slug && p.status !== 'archivado');
      const val = inventoryValue(ps);
      return { ...c, ...val, count: ps.length };
    })
    .filter((r) => r.count);
  const out = products.filter((p) => p.status === 'activo' && productStock(p) <= 0);
  return (
    <div className="stack" style={{ '--gap': '20px' }}>
      <p className="muted small">Fotografía del inventario al día de hoy (no depende del periodo elegido).</p>
      <div className="grid" style={{ '--cols': 4, '--cols-m': 2 }}>
        <Card bodyClass={false}>
          <Stat icon={Boxes} label="Piezas" value={number(v.units)} />
        </Card>
        <Card bodyClass={false}>
          <Stat icon={Coins} label="Valor al costo" value={moneyR(v.cost)} />
        </Card>
        <Card bodyClass={false}>
          <Stat
            icon={TrendingUp}
            label="Valor de venta"
            value={moneyR(v.retail)}
            foot={`Utilidad posible ${moneyR(v.retail - v.cost)}`}
          />
        </Card>
        <Card bodyClass={false}>
          <Stat icon={Package} label="Productos agotados" value={number(out.length)} />
        </Card>
      </div>
      <Card title="Por categoría" icon={Layers} bodyClass={false}>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Departamento</th>
                <th className="num">Productos</th>
                <th className="num">Piezas</th>
                <th className="num">Valor al costo</th>
                <th className="num">Valor de venta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug}>
                  <td className="strong">{r.name}</td>
                  <td className="muted">{deps.find((d) => d.slug === r.department)?.name}</td>
                  <td className="num">{r.count}</td>
                  <td className="num">{r.units}</td>
                  <td className="num">{moneyR(r.cost)}</td>
                  <td className="num strong">{moneyR(r.retail)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td />
                <td className="num">{rows.reduce((a, r) => a + r.count, 0)}</td>
                <td className="num">{v.units}</td>
                <td className="num">{moneyR(v.cost)}</td>
                <td className="num">{moneyR(v.retail)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      {out.length > 0 && (
        <Card title={`Agotados (${out.length})`} icon={Package} bodyClass={false}>
          <div className="list">
            {out.map((p) => (
              <Link key={p.id} className="list__row" to={`/productos/${p.id}`}>
                <Thumb src={p.colors[0]?.images?.[0]} size={36} />
                <span className="list__body">
                  <span className="list__title">{p.name}</span>
                  <span className="list__sub mono">{p.code}</span>
                </span>
                <Badge tone="red">Agotado</Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------- Cortes de caja ---------- */
function CutsReport({ sessions }: { sessions: CashSession[] | undefined }) {
  if (!sessions) {
    return (
      <Card>
        <SkeletonRows rows={5} thumb={false} />
      </Card>
    );
  }
  const closed = sessions.filter((s) => s.status === 'cerrada');
  if (!closed.length) {
    return (
      <Card>
        <Empty icon={Lock} title="Sin cortes en este periodo" />
      </Card>
    );
  }
  const over = closed.filter((s) => (s.difference ?? 0) > 0).reduce((a, s) => a + (s.difference ?? 0), 0);
  const short = closed.filter((s) => (s.difference ?? 0) < 0).reduce((a, s) => a + (s.difference ?? 0), 0);
  const sales = closed.reduce((a, s) => a + (s.summary?.salesTotal || 0), 0);
  return (
    <div className="stack" style={{ '--gap': '20px' }}>
      <div className="grid" style={{ '--cols': 4, '--cols-m': 2 }}>
        <Card bodyClass={false}>
          <Stat icon={Lock} label="Cortes" value={number(closed.length)} />
        </Card>
        <Card bodyClass={false}>
          <Stat icon={TrendingUp} label="Vendido en caja" value={moneyR(sales)} />
        </Card>
        <Card bodyClass={false}>
          <Stat icon={Coins} label="Sobrantes" value={money(over)} />
        </Card>
        <Card bodyClass={false}>
          <Stat icon={Coins} label="Faltantes" value={money(Math.abs(short))} />
        </Card>
      </div>
      <Card title="Detalle de cortes" icon={Lock} bodyClass={false}>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Caja</th>
                <th>Día</th>
                <th className="num">Ventas</th>
                <th className="num">Efectivo esperado</th>
                <th className="num">Contado</th>
                <th>Diferencia</th>
                <th>Cerró</th>
              </tr>
            </thead>
            <tbody>
              {closed.map((s) => (
                <tr key={s.id} className="is-link" onClick={() => navigate(`/caja/${s.id}`)}>
                  <td className="strong">#{s.number}</td>
                  <td>
                    {weekday(s.openedAt)} {dateShort(s.openedAt)}
                  </td>
                  <td className="num">{moneyR(s.summary?.salesTotal || 0)}</td>
                  <td className="num">{money(s.expectedCash)}</td>
                  <td className="num">{money(s.countedCash)}</td>
                  <td>
                    <DiffBadge value={s.difference} />
                  </td>
                  <td className="small muted">{s.closedByName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Exportar e imprimir ---------- */
interface ExportArgs {
  tab: Tab;
  cur: Order[];
  products: Product[] | undefined;
  cats: Category[];
  deps: Department[];
  sessions: CashSession[] | undefined;
}

function exportTab({ tab, cur, products, cats, deps, sessions }: ExportArgs): void {
  const stamp = fileStamp();
  if (tab === 'ventas') {
    exportCsv<Order>(
      `ventas-${stamp}`,
      [...cur].sort((a, b) => new Date(saleDate(a)).getTime() - new Date(saleDate(b)).getTime()),
      [
        { label: 'Folio', value: (o) => o.number },
        { label: 'Fecha', value: (o) => dateTime(saleDate(o)) },
        { label: 'Canal', value: (o) => (o.channel === 'tienda' ? 'Mostrador' : 'En línea') },
        { label: 'Cliente', value: (o) => o.customer?.name || '' },
        { label: 'Forma de pago', value: (o) => methodLabel(o.paymentMethod) },
        { label: 'Piezas', value: (o) => o.itemsCount },
        { label: 'Subtotal', value: (o) => o.subtotal },
        {
          label: 'Descuentos',
          value: (o) => round2((o.discount || 0) + o.items.reduce((a, i) => a + (i.discount || 0), 0)),
        },
        { label: 'Envío', value: (o) => o.shipping || 0 },
        { label: 'Total', value: (o) => o.total },
        { label: 'Costo', value: (o) => o.costTotal || 0 },
      ],
    );
    return;
  }
  if (tab === 'productos') {
    exportCsv(`ventas-por-producto-${stamp}`, byProduct(cur), [
      { label: 'Producto', key: 'name' },
      { label: 'Piezas', key: 'units' },
      { label: 'Ventas', key: 'revenue' },
      { label: 'Costo', key: 'cost' },
      { label: 'Utilidad', key: 'profit' },
      { label: 'Margen %', value: (r) => round2(r.margin * 100) },
    ]);
    return;
  }
  if (tab === 'categorias') {
    exportCsv(`ventas-por-categoria-${stamp}`, byCategory(cur, products || [], cats), [
      { label: 'Categoría', key: 'name' },
      { label: 'Departamento', value: (r) => deps.find((d) => d.slug === r.department)?.name || '' },
      { label: 'Piezas', key: 'units' },
      { label: 'Ventas', key: 'revenue' },
      { label: 'Utilidad', key: 'profit' },
    ]);
    return;
  }
  if (tab === 'pagos') {
    exportCsv(`ventas-por-pago-${stamp}`, byPayment(cur), [
      { label: 'Forma de pago', key: 'name' },
      { label: 'Pagos', key: 'count' },
      { label: 'Importe', key: 'amount' },
    ]);
    return;
  }
  if (tab === 'inventario') {
    const rows = [];
    for (const p of products || [])
      for (const v of p.variants) rows.push({ p, v, c: p.colors.find((x) => x.id === v.colorId) });
    exportCsv(`inventario-${stamp}`, rows, [
      { label: 'Producto', value: (r) => r.p.name },
      { label: 'Color', value: (r) => r.c?.name },
      { label: 'Talla', value: (r) => r.v.size },
      { label: 'SKU', value: (r) => r.v.sku },
      { label: 'Existencias', value: (r) => r.v.stock },
      { label: 'Costo', value: (r) => r.p.cost },
      { label: 'Precio', value: (r) => r.p.price },
    ]);
    return;
  }
  exportCsv<CashSession>(
    `cortes-${stamp}`,
    (sessions || []).filter((s) => s.status === 'cerrada'),
    [
      { label: 'Caja', key: 'number' },
      { label: 'Apertura', value: (s) => dateTime(s.openedAt) },
      { label: 'Cierre', value: (s) => (s.closedAt ? dateTime(s.closedAt) : '') },
      { label: 'Ventas', value: (s) => s.summary?.salesTotal || 0 },
      { label: 'Esperado', key: 'expectedCash' },
      { label: 'Contado', key: 'countedCash' },
      { label: 'Diferencia', key: 'difference' },
    ],
  );
}

interface PrintArgs extends ExportArgs {
  S: Summary;
  P: Summary;
  r: DateRange;
  period: string;
  filterLabels: string[];
  settings: Settings | null;
  compare: boolean;
}

function printTab({
  tab,
  cur,
  S,
  P,
  products,
  cats,
  deps,
  sessions,
  r,
  period,
  filterLabels,
  settings,
  compare,
}: PrintArgs): void {
  const titles: Record<Tab, string> = {
    ventas: 'Reporte de ventas',
    productos: 'Ventas por producto',
    categorias: 'Ventas por categoría',
    pagos: 'Pagos y canales',
    inventario: 'Inventario',
    cortes: 'Cortes de caja',
  };
  const title = titles[tab];
  const base = {
    title,
    period:
      tab === 'inventario' ? `Al ${dateMedium(new Date())}` : `${period} · ${dateMedium(r.from)} – ${dateMedium(r.to)}`,
    filters: filterLabels,
  };
  const d = (a: number, b: number) => (compare && b ? ` (${delta(a, b).text})` : '');
  if (tab === 'ventas') {
    const unit = granularity(r);
    const pts = series(cur, r, unit).points.filter((p) => p.count);
    printReport(
      {
        ...base,
        kpis: [
          { label: 'Ventas netas', value: moneyR(S.net) + d(S.net, P.net) },
          { label: 'Número de ventas', value: number(S.count) + d(S.count, P.count) },
          { label: 'Ticket promedio', value: moneyR(S.avgTicket) },
          { label: 'Piezas vendidas', value: number(S.items) },
          { label: 'Descuentos', value: moneyR(S.discounts) },
          { label: 'Utilidad bruta', value: moneyR(S.profit), sub: `Margen ${percent(S.margin, 1)}` },
        ],
        sections: [
          {
            title: 'Por periodo',
            columns: [{ label: 'Periodo' }, { label: 'Ventas', num: true }, { label: 'Núm.', num: true }],
            rows: pts.map((p) => [unitLabel(unit, p.date), moneyR(p.total), p.count]),
            foot: ['Total', moneyR(S.total), S.count],
          },
        ],
      },
      settings,
    );
    return;
  }
  if (tab === 'productos') {
    const rows = byProduct(cur);
    printReport(
      {
        ...base,
        sections: [
          {
            title: 'Productos',
            columns: [
              { label: 'Producto' },
              { label: 'Piezas', num: true },
              { label: 'Ventas', num: true },
              { label: 'Utilidad', num: true },
            ],
            rows: rows.map((x) => [x.name, x.units, moneyR(x.revenue), moneyR(x.profit)]),
          },
        ],
      },
      settings,
    );
    return;
  }
  if (tab === 'categorias') {
    const rows = byCategory(cur, products || [], cats);
    printReport(
      {
        ...base,
        sections: [
          {
            title: 'Categorías',
            columns: [
              { label: 'Categoría' },
              { label: 'Departamento' },
              { label: 'Piezas', num: true },
              { label: 'Ventas', num: true },
            ],
            rows: rows.map((x) => [
              x.name,
              deps.find((dd) => dd.slug === x.department)?.name || '',
              x.units,
              moneyR(x.revenue),
            ]),
          },
        ],
      },
      settings,
    );
    return;
  }
  if (tab === 'pagos') {
    printReport(
      {
        ...base,
        sections: [
          {
            title: 'Formas de pago',
            columns: [{ label: 'Forma de pago' }, { label: 'Pagos', num: true }, { label: 'Importe', num: true }],
            rows: byPayment(cur).map((x) => [x.name, x.count, money(x.amount)]),
          },
          {
            title: 'Canales',
            columns: [{ label: 'Canal' }, { label: 'Ventas', num: true }, { label: 'Importe', num: true }],
            rows: byChannel(cur).map((x) => [x.key === 'tienda' ? 'Mostrador' : x.name, x.count, money(x.amount)]),
          },
        ],
      },
      settings,
    );
    return;
  }
  if (tab === 'inventario') {
    const v = inventoryValue(products || []);
    const rows = cats
      .map((c) => ({ c, v: inventoryValue((products || []).filter((p) => p.category === c.slug)) }))
      .filter((x) => x.v.units);
    printReport(
      {
        ...base,
        kpis: [
          { label: 'Piezas', value: number(v.units) },
          { label: 'Valor al costo', value: moneyR(v.cost) },
          { label: 'Valor de venta', value: moneyR(v.retail) },
        ],
        sections: [
          {
            title: 'Por categoría',
            columns: [
              { label: 'Categoría' },
              { label: 'Piezas', num: true },
              { label: 'Costo', num: true },
              { label: 'Venta', num: true },
            ],
            rows: rows.map((x) => [x.c.name, x.v.units, moneyR(x.v.cost), moneyR(x.v.retail)]),
          },
        ],
      },
      settings,
    );
    return;
  }
  const closed = (sessions || []).filter((s) => s.status === 'cerrada');
  printReport(
    {
      ...base,
      sections: [
        {
          title: 'Cortes',
          columns: [
            { label: 'Caja' },
            { label: 'Día' },
            { label: 'Ventas', num: true },
            { label: 'Esperado', num: true },
            { label: 'Contado', num: true },
            { label: 'Diferencia', num: true },
          ],
          rows: closed.map((s) => [
            `#${s.number}`,
            `${weekday(s.openedAt)} ${dateShort(s.openedAt)}`,
            moneyR(s.summary?.salesTotal || 0),
            money(s.expectedCash),
            money(s.countedCash),
            money(s.difference),
          ]),
        },
      ],
    },
    settings,
  );
}
