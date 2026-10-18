/** Corte de caja: resumen del turno, arqueo, movimientos y ventas, listo para imprimir. */
import { Link, useParams } from 'react-router';
import { useStore } from '@nanostores/react';
import { Banknote, Calculator, Printer, ShoppingBag, Wallet } from 'lucide-react';
import { dateLong, dateTime, money, plural, time } from '@/lib/format';
import { methodLabel } from '@/lib/model';
import { api } from '../api';
import { printCashReport } from '../lib/documents';
import { navigate } from '../lib/navigation';
import { useData } from '../lib/query';
import { settingsStore } from '../lib/session';
import { BarList } from '../ui/charts';
import { Button, cx } from '../ui/controls';
import { Badge, Card, Empty, KV, PageHeader, SkeletonRows } from '../ui/surfaces';
import { DiffBadge } from './Cash';

const MOVEMENT_LABEL = { ingreso: 'Ingreso', retiro: 'Retiro', gasto: 'Gasto' } as const;

export default function CashSession() {
  const { id = '' } = useParams();
  const settings = useStore(settingsStore);
  const { data: view, loading } = useData(['cash', 'session', id], () => api.cash.session(id), ['cash', 'orders']);
  if (loading) {
    return (
      <main className="page">
        <div className="card">
          <SkeletonRows rows={6} thumb={false} />
        </div>
      </main>
    );
  }
  if (!view) {
    return (
      <main className="page">
        <Empty
          icon={Wallet}
          title="No encontramos ese corte"
          action={
            <Button variant="primary" onClick={() => navigate('/caja')}>
              Ir a caja
            </Button>
          }
        />
      </main>
    );
  }
  const { session: s, summary: live, movements, orders } = view;
  const open = s.status === 'abierta';
  const sum = open ? live : s.summary || live;
  const expected = open ? live.expected : s.expectedCash;
  const breakdown = s.breakdown
    ? Object.entries(s.breakdown)
        .filter(([, n]) => Number(n) > 0)
        .sort((a, b) => Number(b[0]) - Number(a[0]))
    : [];

  return (
    <main className="page">
      <PageHeader
        back={{ to: '/caja', label: 'Caja' }}
        title={`Corte de caja #${s.number}`}
        sub={dateLong(s.openedAt)}
        actions={
          <Button
            icon={Printer}
            onClick={() => printCashReport({ ...view, summary: sum }, settings, { partial: open })}
          >
            {open ? 'Imprimir corte X' : 'Imprimir corte'}
          </Button>
        }
      />

      <div className="grid" style={{ '--cols': 3 }}>
        <Card pad className="figure-card">
          <span>Debía haber</span>
          <strong>{money(expected)}</strong>
        </Card>
        <Card pad className="figure-card">
          <span>Se contó</span>
          <strong>{open ? '—' : money(s.countedCash)}</strong>
        </Card>
        <Card
          pad
          className={cx(
            'figure-card',
            !open && (s.difference ?? 0) < 0 && 'is-short',
            !open && (s.difference ?? 0) > 0 && 'is-over',
          )}
        >
          <span>Diferencia</span>
          <strong>{open ? 'Caja abierta' : <DiffBadge value={s.difference} />}</strong>
        </Card>
      </div>

      <div className="grid" style={{ '--cols': 2, marginTop: '20px' }}>
        <Card title="Efectivo" icon={Wallet}>
          <KV
            rows={[
              ['Apertura', `${dateTime(s.openedAt)}${s.openedByName ? ` · ${s.openedByName}` : ''}`],
              !open && s.closedAt
                ? ['Cierre', `${dateTime(s.closedAt)}${s.closedByName ? ` · ${s.closedByName}` : ''}`]
                : null,
              ['Fondo inicial', money(s.openingAmount)],
              ['Ventas en efectivo', `+${money(sum.cashSales)}`],
              ['Ingresos', `+${money(sum.movements?.ingreso || 0)}`],
              ['Retiros', `−${money(sum.movements?.retiro || 0)}`],
              ['Gastos', `−${money(sum.movements?.gasto || 0)}`],
              ['Efectivo esperado', <strong key="e">{money(expected)}</strong>, 'total'],
            ]}
          />
          {s.closeNotes && (
            <p className="small muted" style={{ marginTop: '12px' }}>
              Notas: {s.closeNotes}
            </p>
          )}
        </Card>
        <Card title="Ventas del turno" icon={Banknote}>
          <div className="stack">
            <KV
              rows={[
                ['Ventas', plural(sum.salesCount, 'venta', 'ventas')],
                ['Total vendido', <strong key="t">{money(sum.salesTotal)}</strong>],
                ['Piezas', sum.items],
                sum.cancelled ? ['Canceladas', sum.cancelled] : null,
              ]}
            />
            <BarList
              rows={Object.entries(sum.byMethod || {})
                .map(([m, v]) => ({ key: m, label: methodLabel(m), value: v }))
                .sort((a, b) => b.value - a.value)}
              format={(v) => money(v)}
            />
          </div>
        </Card>
      </div>

      {breakdown.length > 0 && (
        <Card title="Arqueo" icon={Calculator} bodyClass={false} style={{ marginTop: '20px' }}>
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Denominación</th>
                  <th className="num">Cantidad</th>
                  <th className="num">Importe</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map(([d, n]) => (
                  <tr key={d}>
                    <td>{money(Number(d), { cents: Number(d) % 1 !== 0 })}</td>
                    <td className="num">{n}</td>
                    <td className="num">{money(Number(d) * n)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total contado</td>
                  <td />
                  <td className="num">{money(s.countedCash)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {movements.length > 0 && (
        <Card title="Movimientos de efectivo" icon={Wallet} bodyClass={false} style={{ marginTop: '20px' }}>
          <div className="list">
            {movements.map((m) => (
              <div key={m.id} className="list__row">
                <span className="list__body">
                  <span className="list__title">{m.reason || m.type}</span>
                  <span className="list__sub">
                    {MOVEMENT_LABEL[m.type]} · {time(m.createdAt)}
                  </span>
                </span>
                <span className={cx('list__end num strong', m.type === 'ingreso' ? 'tone-up' : 'tone-down')}>
                  {m.type === 'ingreso' ? '+' : '−'}
                  {money(m.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title={`Ventas (${orders.length})`} icon={ShoppingBag} bodyClass={false} style={{ marginTop: '20px' }}>
        {orders.length ? (
          <div className="list">
            {orders.map((o) => (
              <Link key={o.id} className="list__row" to={`/pedidos/${o.id}`}>
                <span className="list__body">
                  <span className="list__title">{o.number}</span>
                  <span className="list__sub">
                    {time(o.paidAt || o.createdAt)} · {methodLabel(o.paymentMethod)} ·{' '}
                    {plural(o.itemsCount, 'pieza', 'piezas')}
                  </span>
                </span>
                <span className="list__end">
                  {o.status === 'cancelado' && <Badge tone="red">Cancelada</Badge>}
                  <strong className="num">{money(o.total)}</strong>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="Sin ventas en este turno" />
        )}
      </Card>
    </main>
  );
}
