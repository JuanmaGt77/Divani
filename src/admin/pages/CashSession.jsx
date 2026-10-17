/** Corte de caja: resumen del turno, arqueo, movimientos y ventas, listo para imprimir. */
import { Printer, Wallet, Banknote, ShoppingBag, Calculator } from 'lucide-preact';
import { api } from '../api/index.js';
import { useQuery } from '../lib/query.js';
import { navigate, href } from '../lib/router.js';
import { money, dateTime, time, dateLong, plural } from '../lib/format.js';
import { useStore } from '../lib/store.js';
import { settingsStore } from '../lib/session.js';
import { printCashReport } from '../lib/documents.js';
import { methodLabel } from '../../backend/model.js';
import { PageHeader, Card, Badge, Empty, SkeletonRows, KV } from '../ui/surfaces.jsx';
import { Button, cx } from '../ui/controls.jsx';
import { BarList } from '../ui/charts.jsx';
import { DiffBadge } from './Cash.jsx';

export default function CashSession({ params }) {
  const settings = useStore(settingsStore);
  const { data: view, loading } = useQuery(`cash:session:${params.id}`, () => api.cash.session(params.id), ['cash', 'orders']);
  if (loading) return <main class="page"><div class="card"><SkeletonRows rows={6} thumb={false} /></div></main>;
  if (!view) return <main class="page"><Empty icon={Wallet} title="No encontramos ese corte" action={<Button variant="primary" onClick={() => navigate('/caja')}>Ir a caja</Button>} /></main>;
  const { session: s, summary: live, movements, orders } = view;
  const open = s.status === 'abierta';
  const sum = open ? live : (s.summary || live);
  const expected = open ? live.expected : s.expectedCash;
  const breakdown = s.breakdown ? Object.entries(s.breakdown).filter(([, n]) => Number(n) > 0).sort((a, b) => Number(b[0]) - Number(a[0])) : [];

  return (
    <main class="page">
      <PageHeader
        back={{ to: '/caja', label: 'Caja' }}
        title={`Corte de caja #${s.number}`}
        sub={dateLong(s.openedAt)}
        actions={<Button icon={Printer} onClick={() => printCashReport({ ...view, summary: sum }, settings, { partial: open })}>{open ? 'Imprimir corte X' : 'Imprimir corte'}</Button>}
      />

      <div class="grid" style={{ '--cols': 3 }}>
        <Card pad class="figure-card"><span>Debía haber</span><strong>{money(expected)}</strong></Card>
        <Card pad class="figure-card"><span>Se contó</span><strong>{open ? '—' : money(s.countedCash)}</strong></Card>
        <Card pad class={cx('figure-card', !open && s.difference < 0 && 'is-short', !open && s.difference > 0 && 'is-over')}>
          <span>Diferencia</span>
          <strong>{open ? 'Caja abierta' : <DiffBadge value={s.difference} />}</strong>
        </Card>
      </div>

      <div class="grid" style={{ '--cols': 2, marginTop: '20px' }}>
        <Card title="Efectivo" icon={Wallet}>
          <KV rows={[
            ['Apertura', `${dateTime(s.openedAt)}${s.openedByName ? ` · ${s.openedByName}` : ''}`],
            !open && ['Cierre', `${dateTime(s.closedAt)}${s.closedByName ? ` · ${s.closedByName}` : ''}`],
            ['Fondo inicial', money(s.openingAmount)],
            ['Ventas en efectivo', `+${money(sum.cashSales)}`],
            ['Ingresos', `+${money(sum.movements?.ingreso || 0)}`],
            ['Retiros', `−${money(sum.movements?.retiro || 0)}`],
            ['Gastos', `−${money(sum.movements?.gasto || 0)}`],
            ['Efectivo esperado', <strong>{money(expected)}</strong>, 'total'],
          ]} />
          {s.closeNotes && <p class="small muted" style={{ marginTop: '12px' }}>Notas: {s.closeNotes}</p>}
        </Card>
        <Card title="Ventas del turno" icon={Banknote}>
          <div class="stack">
            <KV rows={[
              ['Ventas', plural(sum.salesCount, 'venta', 'ventas')],
              ['Total vendido', <strong>{money(sum.salesTotal)}</strong>],
              ['Piezas', sum.items],
              sum.cancelled ? ['Canceladas', sum.cancelled] : null,
            ]} />
            <BarList rows={Object.entries(sum.byMethod || {}).map(([m, v]) => ({ key: m, label: methodLabel(m), value: v })).sort((a, b) => b.value - a.value)} format={(v) => money(v)} />
          </div>
        </Card>
      </div>

      {breakdown.length > 0 && (
        <Card title="Arqueo" icon={Calculator} bodyClass={false} style={{ marginTop: '20px' }}>
          <div class="table-wrap">
            <table class="table table--compact">
              <thead><tr><th>Denominación</th><th class="num">Cantidad</th><th class="num">Importe</th></tr></thead>
              <tbody>{breakdown.map(([d, n]) => <tr><td>{money(Number(d), { cents: Number(d) % 1 !== 0 })}</td><td class="num">{n}</td><td class="num">{money(Number(d) * n)}</td></tr>)}</tbody>
              <tfoot><tr><td>Total contado</td><td /><td class="num">{money(s.countedCash)}</td></tr></tfoot>
            </table>
          </div>
        </Card>
      )}

      {movements.length > 0 && (
        <Card title="Movimientos de efectivo" icon={Wallet} bodyClass={false} style={{ marginTop: '20px' }}>
          <div class="list">
            {movements.map((m) => (
              <div class="list__row">
                <span class="list__body"><span class="list__title">{m.reason || m.type}</span><span class="list__sub">{m.type === 'ingreso' ? 'Ingreso' : m.type === 'retiro' ? 'Retiro' : 'Gasto'} · {time(m.createdAt)}</span></span>
                <span class={cx('list__end num strong', m.type === 'ingreso' ? 'tone-up' : 'tone-down')}>{m.type === 'ingreso' ? '+' : '−'}{money(m.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title={`Ventas (${orders.length})`} icon={ShoppingBag} bodyClass={false} style={{ marginTop: '20px' }}>
        {orders.length ? (
          <div class="list">
            {orders.map((o) => (
              <a class="list__row" href={href(`/pedidos/${o.id}`)}>
                <span class="list__body">
                  <span class="list__title">{o.number}</span>
                  <span class="list__sub">{time(o.paidAt || o.createdAt)} · {methodLabel(o.paymentMethod)} · {plural(o.itemsCount, 'pieza', 'piezas')}</span>
                </span>
                <span class="list__end">{o.status === 'cancelado' && <Badge tone="red">Cancelada</Badge>}<strong class="num">{money(o.total)}</strong></span>
              </a>
            ))}
          </div>
        ) : <Empty title="Sin ventas en este turno" />}
      </Card>
    </main>
  );
}
