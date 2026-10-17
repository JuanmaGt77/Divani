/** Clientes: se arman solas con los pedidos (por teléfono o nombre), con segmentos para darles seguimiento. */
import { useMemo, useState } from 'preact/hooks';
import { Users, Download, MessageCircle, Phone, MapPin, ShoppingBag, Crown, Sparkles, Clock, ChevronRight } from 'lucide-preact';
import { api } from '../api/index.js';
import { useQuery } from '../lib/query.js';
import { href } from '../lib/router.js';
import { money, moneyR, relative, phone as fmtPhone, plural, dateMedium, number } from '../lib/format.js';
import { customersFrom } from '../lib/reports.js';
import { useSort, matches, useIsMobile } from '../lib/hooks.js';
import { exportCsv, fileStamp } from '../lib/csv.js';
import { waLink } from '../lib/whatsapp.js';
import { useStore } from '../lib/store.js';
import { settingsStore } from '../lib/session.js';
import { PageHeader, Card, Avatar, Badge, Empty, SkeletonRows, StatusBadge, Stat } from '../ui/surfaces.jsx';
import { Button, SearchField, Segmented } from '../ui/controls.jsx';
import { SortTh } from '../ui/table.jsx';
import { Sheet } from '../ui/overlays.jsx';

const DAY = 864e5;
const SEGMENTS = [
  { value: 'todas', label: 'Todas' },
  { value: 'frecuentes', label: 'Frecuentes', icon: Crown },
  { value: 'nuevas', label: 'Nuevas', icon: Sparkles },
  { value: 'reactivar', label: 'Por reactivar', icon: Clock },
];

export default function Customers() {
  const settings = useStore(settingsStore);
  const prefix = settings?.public?.region?.phonePrefix || '52';
  const mobile = useIsMobile();
  const { data: orders, loading } = useQuery('orders:all', () => api.orders.list({}), ['orders']);
  const [q, setQ] = useState('');
  const [segment, setSegment] = useState('todas');
  const [open, setOpen] = useState(null);

  const all = useMemo(() => customersFrom((orders || []).filter((o) => o.customer?.name || o.customer?.phone)), [orders]);
  const now = Date.now();
  const inSeg = (c) => (segment === 'frecuentes' ? c.count >= 3
    : segment === 'nuevas' ? now - new Date(c.first).getTime() < 30 * DAY
      : segment === 'reactivar' ? c.count > 0 && now - new Date(c.last).getTime() > 45 * DAY : true);
  const counts = useMemo(() => Object.fromEntries(SEGMENTS.map((s) => [s.value, all.filter((c) => (s.value === 'frecuentes' ? c.count >= 3 : s.value === 'nuevas' ? now - new Date(c.first).getTime() < 30 * DAY : s.value === 'reactivar' ? c.count > 0 && now - new Date(c.last).getTime() > 45 * DAY : true)).length])), [all]);
  const list = all.filter((c) => inSeg(c) && matches(q, c.name, c.phone, c.city));
  const { rows, sort, setSort } = useSort(list, { key: 'last', dir: 'desc' }, {
    last: (c) => new Date(c.last).getTime(), spent: (c) => c.spent, count: (c) => c.count, avg: (c) => c.avg, name: (c) => c.name,
  });
  const totalSpent = all.reduce((a, c) => a + c.spent, 0);
  const repeat = all.filter((c) => c.count >= 2).length;

  const exportRows = () => exportCsv(`clientes-${fileStamp()}`, rows, [
    { label: 'Nombre', key: 'name' }, { label: 'Teléfono', key: 'phone' }, { label: 'Ciudad', key: 'city' },
    { label: 'Compras', key: 'count' }, { label: 'Total gastado', key: 'spent' }, { label: 'Ticket promedio', value: (c) => Math.round(c.avg) },
    { label: 'Primera compra', value: (c) => dateMedium(c.first) }, { label: 'Última compra', value: (c) => dateMedium(c.last) },
  ]);

  const greet = (c) => `¡Hola ${String(c.name || '').split(' ')[0]}! Te escribimos de ${settings?.public?.store?.name || 'Divani'} 💛 `;

  return (
    <main class="page page--wide">
      <PageHeader
        title="Clientes"
        sub="Se registran solas con cada pedido. Úsalas para dar seguimiento y avisar de nuevos ingresos."
        actions={<Button icon={Download} onClick={exportRows} disabled={!rows.length}>Exportar</Button>}
      />

      <div class="grid stat-grid" style={{ '--cols': 3, '--cols-m': 1 }}>
        <Card bodyClass={false}><Stat icon={Users} label="Clientes" value={number(all.length)} foot={`${plural(repeat, 'volvió', 'volvieron')} a comprar`} /></Card>
        <Card bodyClass={false}><Stat icon={ShoppingBag} label="Compra promedio por cliente" value={moneyR(all.length ? totalSpent / all.length : 0)} /></Card>
        <Card bodyClass={false}><Stat icon={Crown} label="Frecuentes" value={number(counts.frecuentes || 0)} foot="3 compras o más" /></Card>
      </div>

      <div class="toolbar">
        <SearchField value={q} onValue={setQ} placeholder="Nombre, teléfono o ciudad" />
        <Segmented value={segment} onChange={setSegment} label="Segmento" options={SEGMENTS.map((s) => ({ ...s, count: counts[s.value] }))} />
      </div>

      <Card bodyClass={false}>
        {loading ? <SkeletonRows rows={8} /> : !rows.length ? (
          <Empty icon={Users} title={all.length ? 'Nadie en este segmento' : 'Aún no hay clientes'}>
            {all.length ? 'Prueba con otro segmento o búsqueda.' : 'Cuando lleguen pedidos con nombre o teléfono aparecerán aquí.'}
          </Empty>
        ) : mobile ? (
          <div class="list">
            {rows.slice(0, 300).map((c) => (
              <button type="button" class="list__row" onClick={() => setOpen(c)} style={{ '--inset': '68px' }}>
                <Avatar name={c.name} />
                <span class="list__body">
                  <span class="list__title">{c.name}</span>
                  <span class="list__sub">{plural(c.count, 'compra', 'compras')} · {relative(c.last)}</span>
                </span>
                <span class="list__end"><strong class="num">{moneyR(c.spent)}</strong></span>
                <ChevronRight class="list__chev" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <div class="table-wrap">
            <table class="table">
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
                  <tr class="is-link" onClick={(e) => { if (!e.target.closest('a')) setOpen(c); }}>
                    <td>
                      <div class="cell-main">
                        <Avatar name={c.name} size={34} />
                        <div style={{ minWidth: 0 }}>
                          <div class="cell-title ellipsis">{c.name} {c.count >= 3 && <Badge tone="amber" icon={Crown}>Frecuente</Badge>}</div>
                          <div class="cell-sub">{fmtPhone(c.phone) || 'Sin teléfono'}</div>
                        </div>
                      </div>
                    </td>
                    <td class="muted small">{c.city || '—'}</td>
                    <td class="num">{c.count}</td>
                    <td class="num strong">{moneyR(c.spent)}</td>
                    <td class="num">{c.count ? moneyR(c.avg) : '—'}</td>
                    <td class="small muted">{relative(c.last)}</td>
                    <td class="end">{c.phone && <a class="icon-btn" href={waLink(c.phone, greet(c), prefix)} target="_blank" rel="noopener" aria-label={`Escribir a ${c.name} por WhatsApp`} title="WhatsApp"><MessageCircle aria-hidden="true" /></a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name || ''} sub={open ? `Cliente desde ${dateMedium(open.first)}` : ''}>
        {open && (
          <div class="stack">
            <div class="grid" style={{ '--cols': 3, '--cols-m': 3, '--gap': '8px' }}>
              <div class="mini-stat"><strong>{open.count}</strong><span>compras</span></div>
              <div class="mini-stat"><strong>{moneyR(open.spent)}</strong><span>gastado</span></div>
              <div class="mini-stat"><strong>{open.count ? moneyR(open.avg) : '—'}</strong><span>promedio</span></div>
            </div>
            <div class="stack" style={{ '--gap': '8px' }}>
              {open.phone && <p class="row small"><Phone class="ico-sm" aria-hidden="true" /><a href={`tel:${open.phone}`}>{fmtPhone(open.phone)}</a></p>}
              {(open.city || open.address) && <p class="row row--top small"><MapPin class="ico-sm" aria-hidden="true" />{[open.address, open.city].filter(Boolean).join(', ')}</p>}
            </div>
            {open.phone && <a class="btn btn--wa btn--block" href={waLink(open.phone, greet(open), prefix)} target="_blank" rel="noopener"><MessageCircle aria-hidden="true" />Escribir por WhatsApp</a>}
            <div>
              <p class="field__label" style={{ marginBottom: '8px' }}>Pedidos</p>
              <div class="list card card--flat">
                {open.orders.map((o) => (
                  <a class="list__row" href={href(`/pedidos/${o.id}`)} onClick={() => setOpen(null)}>
                    <span class="list__body">
                      <span class="list__title mono">{o.number}</span>
                      <span class="list__sub">{dateMedium(o.createdAt)} · {plural(o.itemsCount, 'pieza', 'piezas')}</span>
                    </span>
                    <span class="list__end"><StatusBadge status={o.status} /><strong class="num">{money(o.total)}</strong></span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </Sheet>
    </main>
  );
}
