/** Caja: turno abierto con efectivo esperado, movimientos, ventas del turno, corte X y corte Z. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useStore } from '@nanostores/react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  Clock,
  History,
  Lock,
  Printer,
  Receipt,
  ScanBarcode,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { dateShort, dateTime, money, plural, relative, time, weekday } from '@/lib/format';
import { methodLabel } from '@/lib/model';
import type { CashMovementType } from '@/lib/types';
import { api } from '../api';
import { CloseCashSheet, MovementSheet, OpenCashSheet } from '../components/CashSheets';
import { printCashReport } from '../lib/documents';
import { useIsMobile } from '../lib/hooks';
import { navigate } from '../lib/navigation';
import { useData } from '../lib/query';
import { settingsStore } from '../lib/session';
import { BarList } from '../ui/charts';
import { Button, cx } from '../ui/controls';
import { DateRangePicker, resolveRange, type RangeValue } from '../ui/pickers';
import { Badge, Card, Empty, PageHeader, SkeletonRows, Stat } from '../ui/surfaces';

export function DiffBadge({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="faint">—</span>;
  if (Math.abs(value) < 0.005) return <Badge tone="green">Cuadró</Badge>;
  return (
    <Badge tone={value > 0 ? 'blue' : 'red'}>
      {value > 0 ? 'Sobrante' : 'Faltante'} {money(Math.abs(value))}
    </Badge>
  );
}

const MOVEMENT_LABEL: Record<CashMovementType, string> = { ingreso: 'Ingreso', retiro: 'Retiro', gasto: 'Gasto' };

export default function Cash() {
  const settings = useStore(settingsStore);
  const mobile = useIsMobile();
  const { data: view, loading } = useData(['cash', 'current'], () => api.cash.current(), ['cash', 'orders']);
  const [range, setRange] = useState<RangeValue>({ preset: '30d' });
  const r = resolveRange(range);
  const { data: sessions, loading: loadingHistory } = useData(
    ['cash', 'sessions', r.from.toISOString(), r.to.toISOString()],
    () => api.cash.sessions({ from: r.from, to: r.to }),
    ['cash'],
  );
  const [opening, setOpening] = useState(false);
  const [moving, setMoving] = useState<CashMovementType | null>(null);
  const [closing, setClosing] = useState(false);

  const s = view?.session;
  const sum = view?.summary;
  const closed = (sessions || []).filter((x) => x.status === 'cerrada');
  const last = closed[0];

  return (
    <main className="page page--wide">
      <PageHeader
        title="Caja"
        sub="El efectivo del mostrador: apertura, entradas y salidas, y el corte del día."
        actions={
          view ? (
            <>
              <Button icon={Printer} onClick={() => printCashReport(view, settings, { partial: true })}>
                Corte X
              </Button>
              <Button variant="primary" icon={Lock} onClick={() => setClosing(true)}>
                Cerrar caja
              </Button>
            </>
          ) : (
            !loading && (
              <Button variant="primary" icon={Wallet} onClick={() => setOpening(true)}>
                Abrir caja
              </Button>
            )
          )
        }
      />

      {loading ? (
        <Card bodyClass={false}>
          <SkeletonRows rows={5} thumb={false} />
        </Card>
      ) : view && s && sum ? (
        <>
          <div className="cash-top">
            <section className="cash-hero card card--hero">
              <p className="cash-hero__label">Efectivo que debe haber en la caja</p>
              <p className="cash-hero__value">{money(sum.expected)}</p>
              <p className="cash-hero__meta">
                <Clock aria-hidden="true" />
                Caja #{s.number} abierta {relative(s.openedAt)}
                {s.openedByName ? ` por ${s.openedByName}` : ''}
              </p>
              <div className="cash-hero__breakdown">
                <span>
                  Fondo <strong>{money(s.openingAmount)}</strong>
                </span>
                <span>
                  Ventas en efectivo <strong>+{money(sum.cashSales)}</strong>
                </span>
                {sum.movements.ingreso > 0 && (
                  <span>
                    Ingresos <strong>+{money(sum.movements.ingreso)}</strong>
                  </span>
                )}
                {sum.movements.retiro > 0 && (
                  <span>
                    Retiros <strong>−{money(sum.movements.retiro)}</strong>
                  </span>
                )}
                {sum.movements.gasto > 0 && (
                  <span>
                    Gastos <strong>−{money(sum.movements.gasto)}</strong>
                  </span>
                )}
              </div>
              <div className="cash-hero__actions">
                <button type="button" className="hero-pill" onClick={() => setMoving('ingreso')}>
                  <ArrowDownToLine aria-hidden="true" />
                  Ingreso
                </button>
                <button type="button" className="hero-pill" onClick={() => setMoving('retiro')}>
                  <ArrowUpFromLine aria-hidden="true" />
                  Retiro
                </button>
                <button type="button" className="hero-pill" onClick={() => setMoving('gasto')}>
                  <Receipt aria-hidden="true" />
                  Gasto
                </button>
              </div>
            </section>
            <div className="cash-stats">
              <Card bodyClass={false}>
                <Stat
                  icon={ShoppingBag}
                  label="Ventas del turno"
                  value={money(sum.salesTotal)}
                  foot={plural(sum.salesCount, 'venta', 'ventas')}
                />
              </Card>
              <Card bodyClass={false}>
                <Stat
                  icon={Receipt}
                  label="Ticket promedio"
                  value={money(sum.salesCount ? sum.salesTotal / sum.salesCount : 0)}
                  foot={`${plural(sum.items, 'pieza', 'piezas')} vendidas`}
                />
              </Card>
              <Button variant="secondary" size="lg" block icon={ScanBarcode} onClick={() => navigate('/vender')}>
                Ir al punto de venta
              </Button>
            </div>
          </div>

          <div className="grid" style={{ '--cols': 2, marginTop: '20px' }}>
            <Card title="Por forma de pago" icon={Banknote}>
              <BarList
                rows={Object.entries(sum.byMethod || {})
                  .map(([m, v]) => ({ key: m, label: methodLabel(m), value: v }))
                  .sort((a, b) => b.value - a.value)}
                format={(v) => money(v)}
                empty="Todavía no hay ventas en este turno."
              />
            </Card>
            <Card title="Movimientos de efectivo" icon={Wallet} bodyClass={false}>
              <div className="list">
                <div className="list__row">
                  <span className="list__body">
                    <span className="list__title">Fondo inicial</span>
                    <span className="list__sub">{time(s.openedAt)}</span>
                  </span>
                  <span className="list__end num strong">{money(s.openingAmount)}</span>
                </div>
                {view.movements.map((m) => (
                  <div key={m.id} className="list__row">
                    <span className="list__body">
                      <span className="list__title">{m.reason || MOVEMENT_LABEL[m.type]}</span>
                      <span className="list__sub">
                        {MOVEMENT_LABEL[m.type]} · {time(m.createdAt)}
                        {m.createdByName ? ` · ${m.createdByName}` : ''}
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
          </div>

          <Card
            title={`Ventas de este turno (${view.orders.length})`}
            icon={ShoppingBag}
            bodyClass={false}
            style={{ marginTop: '20px' }}
          >
            {view.orders.length ? (
              <div className="list">
                {view.orders.map((o) => (
                  <Link
                    key={o.id}
                    className={cx('list__row', o.status === 'cancelado' && 'is-cancelled')}
                    to={`/pedidos/${o.id}`}
                  >
                    <span className="list__body">
                      <span className="list__title">
                        {o.number} · {plural(o.itemsCount, 'pieza', 'piezas')}
                      </span>
                      <span className="list__sub">
                        {time(o.paidAt || o.createdAt)} · {methodLabel(o.paymentMethod)}
                        {o.channel !== 'tienda' ? ' · pedido en línea' : ''}
                        {o.customer?.name ? ` · ${o.customer.name}` : ''}
                      </span>
                    </span>
                    <span className="list__end">
                      {o.status === 'cancelado' ? <Badge tone="red">Cancelada</Badge> : null}
                      <strong className="num">{money(o.total)}</strong>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                icon={ScanBarcode}
                title="Aún no hay ventas"
                action={
                  <Button variant="primary" icon={ScanBarcode} onClick={() => navigate('/vender')}>
                    Hacer una venta
                  </Button>
                }
              >
                Las ventas del punto de venta aparecen aquí y suman al corte.
              </Empty>
            )}
          </Card>
        </>
      ) : (
        <section className="cash-closed card">
          <span className="cash-closed__icon">
            <Lock aria-hidden="true" />
          </span>
          <h2>La caja está cerrada</h2>
          <p className="muted">
            Ábrela con el efectivo con el que empiezas (tu fondo) para registrar ventas de mostrador.
          </p>
          <Button variant="primary" size="lg" icon={Wallet} onClick={() => setOpening(true)}>
            Abrir caja
          </Button>
          {last && (
            <p className="small muted">
              Último corte: {last.closedAt ? dateTime(last.closedAt) : '—'} · <DiffBadge value={last.difference} />
            </p>
          )}
        </section>
      )}

      <div className="section-title">
        <h2>
          <History aria-hidden="true" />
          Cortes anteriores
        </h2>
        <DateRangePicker value={range} onChange={setRange} align="right" />
      </div>
      <Card bodyClass={false}>
        {loadingHistory ? (
          <SkeletonRows rows={5} thumb={false} />
        ) : !closed.length ? (
          <Empty icon={History} title="Sin cortes en este periodo">
            Cada vez que cierres la caja quedará aquí su corte para consultarlo o imprimirlo.
          </Empty>
        ) : mobile ? (
          <div className="list">
            {closed.map((x) => (
              <Link key={x.id} className="list__row" to={`/caja/${x.id}`}>
                <span className="list__body">
                  <span className="list__title">
                    #{x.number} · {weekday(x.openedAt)} {dateShort(x.openedAt)}
                  </span>
                  <span className="list__sub">
                    {money(x.summary?.salesTotal || 0)} en {plural(x.summary?.salesCount || 0, 'venta', 'ventas')}
                  </span>
                </span>
                <span className="list__end">
                  <DiffBadge value={x.difference} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Caja</th>
                  <th>Día</th>
                  <th>Horario</th>
                  <th className="num">Ventas</th>
                  <th className="num">Esperado</th>
                  <th className="num">Contado</th>
                  <th>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((x) => (
                  <tr key={x.id} className="is-link" onClick={() => navigate(`/caja/${x.id}`)}>
                    <td className="strong">#{x.number}</td>
                    <td>
                      {weekday(x.openedAt)} {dateShort(x.openedAt)}
                    </td>
                    <td className="muted small">
                      {time(x.openedAt)} – {x.closedAt ? time(x.closedAt) : ''}
                    </td>
                    <td className="num">
                      {money(x.summary?.salesTotal || 0)}
                      <div className="cell-sub">{plural(x.summary?.salesCount || 0, 'venta', 'ventas')}</div>
                    </td>
                    <td className="num">{money(x.expectedCash)}</td>
                    <td className="num">{money(x.countedCash)}</td>
                    <td>
                      <DiffBadge value={x.difference} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <OpenCashSheet open={opening} onClose={() => setOpening(false)} />
      <MovementSheet
        open={!!moving}
        initialType={moving || 'gasto'}
        expected={sum?.expected || 0}
        onClose={() => setMoving(null)}
      />
      <CloseCashSheet
        open={closing}
        view={view}
        onClose={() => setClosing(false)}
        onDone={(session) => session?.id && navigate(`/caja/${session.id}`)}
      />
    </main>
  );
}
