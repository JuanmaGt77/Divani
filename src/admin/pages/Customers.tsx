/** Clientes: se arman solas con los pedidos (por teléfono o nombre), con segmentos para darles seguimiento. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useStore } from '@nanostores/react';
import {
  ChevronRight,
  Clock,
  Crown,
  Download,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingBag,
  Sparkles,
  Users,
} from 'lucide-react';
import { dateMedium, phone as fmtPhone, money, moneyR, number, plural, relative } from '@/lib/format';
import { api } from '../api';
import { exportCsv, fileStamp } from '../lib/csv';
import { matches, useIsMobile, useSort } from '../lib/hooks';
import { useData } from '../lib/query';
import { customersFrom, type CustomerSummary } from '../lib/reports';
import { settingsStore } from '../lib/session';
import { waLink } from '../lib/whatsapp';
import { Button, SearchField, Segmented } from '../ui/controls';
import { Sheet } from '../ui/overlays';
import { Avatar, Badge, Card, Empty, PageHeader, SkeletonRows, Stat, StatusBadge } from '../ui/surfaces';
import { SortTh } from '../ui/table';

const DAY = 864e5;
type Segment = 'todas' | 'frecuentes' | 'nuevas' | 'reactivar';
const SEGMENTS = [
  { value: 'todas' as Segment, label: 'Todas' },
  { value: 'frecuentes' as Segment, label: 'Frecuentes', icon: Crown },
  { value: 'nuevas' as Segment, label: 'Nuevas', icon: Sparkles },
  { value: 'reactivar' as Segment, label: 'Por reactivar', icon: Clock },
];

const inSegment = (segment: Segment, c: CustomerSummary, now: number): boolean =>
  segment === 'frecuentes'
    ? c.count >= 3
    : segment === 'nuevas'
      ? now - new Date(c.first).getTime() < 30 * DAY
      : segment === 'reactivar'
        ? c.count > 0 && now - new Date(c.last).getTime() > 45 * DAY
        : true;

export default function Customers() {
  const settings = useStore(settingsStore);
  const prefix = settings?.public?.region?.phonePrefix || '502';
  const mobile = useIsMobile();
  const { data: orders, loading } = useData(['orders', 'all'], () => api.orders.list({}), ['orders']);
  const [q, setQ] = useState('');
  const [segment, setSegment] = useState<Segment>('todas');
  const [open, setOpen] = useState<CustomerSummary | null>(null);
  const [now] = useState(() => Date.now());

  const all = useMemo(
    () => customersFrom((orders || []).filter((o) => o.customer?.name || o.customer?.phone)),
    [orders],
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        SEGMENTS.map((s) => [s.value, all.filter((c) => inSegment(s.value, c, now)).length]),
      ) as Record<Segment, number>,
    [all, now],
  );
  const list = all.filter((c) => inSegment(segment, c, now) && matches(q, c.name, c.phone, c.city));
  const { rows, sort, setSort } = useSort(
    list,
    { key: 'last', dir: 'desc' },
    {
      last: (c) => new Date(c.last).getTime(),
      spent: (c) => c.spent,
      count: (c) => c.count,
      avg: (c) => c.avg,
      name: (c) => c.name,
    },
  );
  const totalSpent = all.reduce((a, c) => a + c.spent, 0);
  const repeat = all.filter((c) => c.count >= 2).length;

  const exportRows = () =>
    exportCsv<CustomerSummary>(`clientes-${fileStamp()}`, rows, [
      { label: 'Nombre', key: 'name' },
      { label: 'Teléfono', key: 'phone' },
      { label: 'Ciudad', key: 'city' },
      { label: 'Compras', key: 'count' },
      { label: 'Total gastado', key: 'spent' },
      { label: 'Ticket promedio', value: (c) => Math.round(c.avg) },
      { label: 'Primera compra', value: (c) => dateMedium(c.first) },
      { label: 'Última compra', value: (c) => dateMedium(c.last) },
    ]);

  const greet = (c: CustomerSummary) =>
    `¡Hola ${String(c.name || '').split(' ')[0]}! Te escribimos de ${settings?.public?.store?.name || 'Divani'} 💛 `;

  return (
    <main className="page page--wide">
      <PageHeader
        title="Clientes"
        sub="Se registran solas con cada pedido. Úsalas para dar seguimiento y avisar de nuevos ingresos."
        actions={
          <Button icon={Download} onClick={exportRows} disabled={!rows.length}>
            Exportar
          </Button>
        }
      />

      <div className="grid stat-grid" style={{ '--cols': 3, '--cols-m': 1 }}>
        <Card bodyClass={false}>
          <Stat
            icon={Users}
            label="Clientes"
            value={number(all.length)}
            foot={`${plural(repeat, 'volvió', 'volvieron')} a comprar`}
          />
        </Card>
        <Card bodyClass={false}>
          <Stat
            icon={ShoppingBag}
            label="Compra promedio por cliente"
            value={moneyR(all.length ? totalSpent / all.length : 0)}
          />
        </Card>
        <Card bodyClass={false}>
          <Stat icon={Crown} label="Frecuentes" value={number(counts.frecuentes || 0)} foot="3 compras o más" />
        </Card>
      </div>

      <div className="toolbar">
        <SearchField value={q} onValue={setQ} placeholder="Nombre, teléfono o ciudad" />
        <Segmented
          value={segment}
          onChange={setSegment}
          label="Segmento"
          options={SEGMENTS.map((s) => ({ ...s, count: counts[s.value] }))}
        />
      </div>

      <Card bodyClass={false}>
        {loading ? (
          <SkeletonRows rows={8} />
        ) : !rows.length ? (
          <Empty icon={Users} title={all.length ? 'Nadie en este segmento' : 'Aún no hay clientes'}>
            {all.length
              ? 'Prueba con otro segmento o búsqueda.'
              : 'Cuando lleguen pedidos con nombre o teléfono aparecerán aquí.'}
          </Empty>
        ) : mobile ? (
          <div className="list">
            {rows.slice(0, 300).map((c) => (
              <button
                key={c.key}
                type="button"
                className="list__row"
                onClick={() => setOpen(c)}
                style={{ '--inset': '68px' }}
              >
                <Avatar name={c.name} />
                <span className="list__body">
                  <span className="list__title">{c.name}</span>
                  <span className="list__sub">
                    {plural(c.count, 'compra', 'compras')} · {relative(c.last)}
                  </span>
                </span>
                <span className="list__end">
                  <strong className="num">{moneyR(c.spent)}</strong>
                </span>
                <ChevronRight className="list__chev" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <SortTh label="Cliente" k="name" sort={sort} setSort={setSort} />
                  <th>Ciudad</th>
                  <SortTh label="Compras" k="count" sort={sort} setSort={setSort} num />
                  <SortTh label="Total gastado" k="spent" sort={sort} setSort={setSort} num />
                  <SortTh label="Ticket promedio" k="avg" sort={sort} setSort={setSort} num />
                  <SortTh label="Última compra" k="last" sort={sort} setSort={setSort} />
                  <th aria-label="WhatsApp" />
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 500).map((c) => (
                  <tr
                    key={c.key}
                    className="is-link"
                    onClick={(e) => {
                      if (!(e.target as Element).closest('a')) setOpen(c);
                    }}
                  >
                    <td>
                      <div className="cell-main">
                        <Avatar name={c.name} size={34} />
                        <div style={{ minWidth: 0 }}>
                          <div className="cell-title ellipsis">
                            {c.name}{' '}
                            {c.count >= 3 && (
                              <Badge tone="amber" icon={Crown}>
                                Frecuente
                              </Badge>
                            )}
                          </div>
                          <div className="cell-sub">{fmtPhone(c.phone) || 'Sin teléfono'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="muted small">{c.city || '—'}</td>
                    <td className="num">{c.count}</td>
                    <td className="num strong">{moneyR(c.spent)}</td>
                    <td className="num">{c.count ? moneyR(c.avg) : '—'}</td>
                    <td className="small muted">{relative(c.last)}</td>
                    <td className="end">
                      {c.phone && (
                        <a
                          className="icon-btn"
                          href={waLink(c.phone, greet(c), prefix)}
                          target="_blank"
                          rel="noopener"
                          aria-label={`Escribir a ${c.name} por WhatsApp`}
                          title="WhatsApp"
                        >
                          <MessageCircle aria-hidden="true" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Sheet
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.name || ''}
        sub={open ? `Cliente desde ${dateMedium(open.first)}` : ''}
      >
        {open && (
          <div className="stack">
            <div className="grid" style={{ '--cols': 3, '--cols-m': 3, '--gap': '8px' }}>
              <div className="mini-stat">
                <strong>{open.count}</strong>
                <span>compras</span>
              </div>
              <div className="mini-stat">
                <strong>{moneyR(open.spent)}</strong>
                <span>gastado</span>
              </div>
              <div className="mini-stat">
                <strong>{open.count ? moneyR(open.avg) : '—'}</strong>
                <span>promedio</span>
              </div>
            </div>
            <div className="stack" style={{ '--gap': '8px' }}>
              {open.phone && (
                <p className="row small">
                  <Phone className="ico-sm" aria-hidden="true" />
                  <a href={`tel:${open.phone}`}>{fmtPhone(open.phone)}</a>
                </p>
              )}
              {(open.city || open.address) && (
                <p className="row row--top small">
                  <MapPin className="ico-sm" aria-hidden="true" />
                  {[open.address, open.city].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
            {open.phone && (
              <a
                className="btn btn--wa btn--block"
                href={waLink(open.phone, greet(open), prefix)}
                target="_blank"
                rel="noopener"
              >
                <MessageCircle aria-hidden="true" />
                Escribir por WhatsApp
              </a>
            )}
            <div>
              <p className="field__label" style={{ marginBottom: '8px' }}>
                Pedidos
              </p>
              <div className="list card card--flat">
                {open.orders.map((o) => (
                  <Link key={o.id} className="list__row" to={`/pedidos/${o.id}`} onClick={() => setOpen(null)}>
                    <span className="list__body">
                      <span className="list__title mono">{o.number}</span>
                      <span className="list__sub">
                        {dateMedium(o.createdAt)} · {plural(o.itemsCount, 'pieza', 'piezas')}
                      </span>
                    </span>
                    <span className="list__end">
                      <StatusBadge status={o.status} />
                      <strong className="num">{money(o.total)}</strong>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </Sheet>
    </main>
  );
}
