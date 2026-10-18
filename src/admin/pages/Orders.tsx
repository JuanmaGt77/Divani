/** Pedidos: los de la tienda en línea y las ventas de mostrador, con filtros por estado, canal y pago. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useStore } from '@nanostores/react';
import { ChevronRight, Download, Globe, ScanBarcode, ShoppingBag, Store } from 'lucide-react';
import { dateTime, money, phone, plural, relative } from '@/lib/format';
import { ORDER_STATUSES, channelInfo, paymentInfo, statusInfo } from '@/lib/model';
import type { Order } from '@/lib/types';
import { api } from '../api';
import { exportCsv, fileStamp } from '../lib/csv';
import { matches, useIsMobile } from '../lib/hooks';
import { navigate, useSearch } from '../lib/navigation';
import { deliveryName, paymentName } from '../lib/orders';
import { useData } from '../lib/query';
import { settingsStore } from '../lib/session';
import { Button, Chip, SearchField, Segmented } from '../ui/controls';
import { DateRangePicker, resolveRange, type RangeValue } from '../ui/pickers';
import { Card, Empty, PageHeader, PaymentBadge, SkeletonRows, StatusBadge, Thumb } from '../ui/surfaces';

export function ChannelIcon({ channel }: { channel: string }) {
  return channel === 'tienda' ? <Store aria-hidden="true" /> : <Globe aria-hidden="true" />;
}

export default function Orders() {
  const settings = useStore(settingsStore);
  const mobile = useIsMobile();
  const { query, setQuery } = useSearch();
  const [range, setRange] = useState<RangeValue>({ preset: '90d' });
  const [q, setQ] = useState(query.q || '');
  const status = query.estado || 'todos';
  const channel = query.canal || '';
  const pay = query.pago || '';
  const r = resolveRange(range);
  const {
    data: orders,
    loading,
    refreshing,
  } = useData(
    ['orders', 'list', r.from.toISOString(), r.to.toISOString()],
    () => api.orders.list({ from: r.from, to: r.to }),
    ['orders'],
  );

  const base = useMemo(
    () =>
      (orders || []).filter(
        (o) =>
          (!channel || (channel === 'web' ? o.channel !== 'tienda' : o.channel === channel)) &&
          (!pay || o.paymentStatus === pay),
      ),
    [orders, channel, pay],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: base.length };
    for (const s of ORDER_STATUSES) c[s.id] = 0;
    for (const o of base) c[o.status] = (c[o.status] || 0) + 1;
    return c;
  }, [base]);
  const rows = useMemo(
    () =>
      base.filter(
        (o) =>
          (status === 'todos' || o.status === status) &&
          matches(
            q,
            o.number,
            o.customer?.name,
            o.customer?.phone,
            o.customer?.city,
            o.items.map((i) => `${i.name} ${i.sku}`),
          ),
      ),
    [base, status, q],
  );
  const pending = rows
    .filter((o) => o.status !== 'cancelado' && o.paymentStatus === 'pendiente')
    .reduce((a, o) => a + o.total, 0);

  const exportRows = () =>
    exportCsv<Order>(`pedidos-${fileStamp()}`, rows, [
      { label: 'Folio', value: (o) => o.number },
      { label: 'Fecha', value: (o) => dateTime(o.createdAt) },
      { label: 'Canal', value: (o) => channelInfo(o.channel).label },
      { label: 'Estado', value: (o) => statusInfo(o.status).label },
      { label: 'Pago', value: (o) => paymentInfo(o.paymentStatus).label },
      { label: 'Método de pago', value: (o) => paymentName(o.paymentMethod, settings) },
      { label: 'Entrega', value: (o) => deliveryName(o.deliveryMethod, settings) },
      { label: 'Cliente', value: (o) => o.customer?.name },
      { label: 'Teléfono', value: (o) => o.customer?.phone },
      { label: 'Ciudad', value: (o) => o.customer?.city },
      { label: 'Piezas', value: (o) => o.itemsCount },
      { label: 'Subtotal', value: (o) => o.subtotal },
      { label: 'Descuento', value: (o) => o.discount + o.items.reduce((a, i) => a + (i.discount || 0), 0) },
      { label: 'Envío', value: (o) => o.shipping },
      { label: 'Total', value: (o) => o.total },
    ]);

  return (
    <main className="page page--wide">
      <PageHeader
        title="Pedidos"
        sub="Pedidos de la tienda en línea y ventas de mostrador en un solo lugar."
        actions={
          <>
            <Button icon={Download} onClick={exportRows} disabled={!rows.length}>
              Exportar
            </Button>
            <Button variant="primary" icon={ScanBarcode} onClick={() => navigate('/vender')}>
              Nueva venta
            </Button>
          </>
        }
      />

      <div className="toolbar">
        <Segmented
          label="Estado del pedido"
          value={status}
          onChange={(v) => setQuery({ estado: v === 'todos' ? '' : v })}
          options={[
            { value: 'todos', label: 'Todos', count: counts.todos },
            ...ORDER_STATUSES.map((s) => ({ value: s.id as string, label: s.label, count: counts[s.id] || 0 })),
          ]}
        />
      </div>
      <div className="toolbar">
        <SearchField
          value={q}
          onValue={(v) => {
            setQ(v);
            setQuery({ q: v });
          }}
          placeholder="Folio, cliente, teléfono o prenda"
        />
        <DateRangePicker value={range} onChange={setRange} />
        <div className="chips">
          <Chip pressed={!channel} onClick={() => setQuery({ canal: '' })}>
            Todos
          </Chip>
          <Chip pressed={channel === 'web'} icon={Globe} onClick={() => setQuery({ canal: 'web' })}>
            En línea
          </Chip>
          <Chip pressed={channel === 'tienda'} icon={Store} onClick={() => setQuery({ canal: 'tienda' })}>
            Mostrador
          </Chip>
        </div>
        <select
          className="input input--sm filter-select"
          value={pay}
          onChange={(e) => setQuery({ pago: e.currentTarget.value })}
          aria-label="Pago"
        >
          <option value="">Cualquier pago</option>
          <option value="pendiente">Pago pendiente</option>
          <option value="pagado">Pagado</option>
          <option value="reembolsado">Reembolsado</option>
        </select>
      </div>
      {orders && (
        <p className="muted small" style={{ margin: '-4px 0 12px' }}>
          {plural(rows.length, 'pedido', 'pedidos')} ·{' '}
          {money(rows.filter((o) => o.status !== 'cancelado').reduce((a, o) => a + o.total, 0))}
          {pending > 0 && (
            <>
              {' '}
              · <span style={{ color: 'var(--amber)' }}>{money(pending)} por cobrar</span>
            </>
          )}
        </p>
      )}

      <Card bodyClass={false} className={refreshing && orders ? 'is-refreshing' : ''}>
        {loading ? (
          <SkeletonRows rows={8} />
        ) : !rows.length ? (
          <Empty
            icon={ShoppingBag}
            title={orders?.length ? 'Ningún pedido coincide' : 'Aún no hay pedidos en este periodo'}
          >
            {orders?.length
              ? 'Prueba con otro estado, canal o búsqueda.'
              : 'Cuando una clienta envíe su pedido desde la tienda aparecerá aquí al instante.'}
          </Empty>
        ) : mobile ? (
          <div className="list">
            {rows.slice(0, 300).map((o) => (
              <Link key={o.id} className="list__row order-row" to={`/pedidos/${o.id}`}>
                <span className="list__body">
                  <span className="list__title">
                    {o.customer?.name || (o.channel === 'tienda' ? 'Venta de mostrador' : 'Sin nombre')}
                  </span>
                  <span className="list__sub">
                    <span className="mono">{o.number}</span> · {relative(o.createdAt)} · {o.itemsCount} pz
                  </span>
                  <span className="row" style={{ '--gap': '6px', marginTop: '5px' }}>
                    <StatusBadge status={o.status} />
                    <PaymentBadge status={o.paymentStatus} short />
                  </span>
                </span>
                <span className="list__end">
                  <strong className="num">{money(o.total)}</strong>
                </span>
                <ChevronRight className="list__chev" aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Prendas</th>
                  <th className="num">Total</th>
                  <th>Pago</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 400).map((o) => (
                  <tr key={o.id} className="is-link" onClick={() => navigate(`/pedidos/${o.id}`)}>
                    <td>
                      <div className="order-num">
                        <span className="order-num__icon" title={channelInfo(o.channel).label}>
                          <ChannelIcon channel={o.channel} />
                        </span>
                        <span className="mono strong">{o.number}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-title">
                        {o.customer?.name || (
                          <span className="muted">{o.channel === 'tienda' ? 'Mostrador' : 'Sin nombre'}</span>
                        )}
                      </div>
                      <div className="cell-sub">
                        {[o.customer?.phone && phone(o.customer.phone), o.customer?.city].filter(Boolean).join(' · ') ||
                          channelInfo(o.channel).label}
                      </div>
                    </td>
                    <td>
                      <div className="thumb-stack">
                        {o.items.slice(0, 3).map((i) => (
                          <Thumb key={i.id} src={i.image} size={30} />
                        ))}
                        <span className="small muted">{o.itemsCount} pz</span>
                      </div>
                    </td>
                    <td className="num strong">{money(o.total)}</td>
                    <td>
                      <PaymentBadge status={o.paymentStatus} short />
                    </td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="small muted" style={{ whiteSpace: 'nowrap' }}>
                      {relative(o.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}
