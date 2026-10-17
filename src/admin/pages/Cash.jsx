/** Caja: turno abierto con efectivo esperado, movimientos, ventas del turno, corte X y corte Z. */
import { useState } from 'preact/hooks';
import { useIsMobile } from '../lib/hooks.js';
import {
  Wallet, Lock, Printer, ArrowDownToLine, ArrowUpFromLine, Receipt, Clock, ShoppingBag, History, ScanBarcode, Banknote,
} from 'lucide-preact';
import { api } from '../api/index.js';
import { useQuery } from '../lib/query.js';
import { navigate, href } from '../lib/router.js';
import { money, time, dateTime, dateShort, plural, relative, weekday } from '../lib/format.js';
import { useStore } from '../lib/store.js';
import { settingsStore } from '../lib/session.js';
import { printCashReport } from '../lib/documents.js';
import { methodLabel } from '../../backend/model.js';
import { PageHeader, Card, Badge, Empty, SkeletonRows, Stat } from '../ui/surfaces.jsx';
import { Button, cx } from '../ui/controls.jsx';
import { BarList } from '../ui/charts.jsx';
import { DateRangePicker, resolveRange } from '../ui/pickers.jsx';
import { OpenCashSheet, MovementSheet, CloseCashSheet } from '../components/CashSheets.jsx';

export function DiffBadge({ value }) {
  if (value == null) return <span class="faint">—</span>;
  if (Math.abs(value) < 0.005) return <Badge tone="green">Cuadró</Badge>;
  return <Badge tone={value > 0 ? 'blue' : 'red'}>{value > 0 ? 'Sobrante' : 'Faltante'} {money(Math.abs(value))}</Badge>;
}

export default function Cash() {
  const settings = useStore(settingsStore);
  const mobile = useIsMobile();
  const { data: view, loading } = useQuery('cash:current', () => api.cash.current(), ['cash', 'orders']);
  const [range, setRange] = useState({ preset: '30d' });
  const r = resolveRange(range);
  const { data: sessions, loading: loadingHistory } = useQuery(`cash:sessions:${r.from.toISOString()}:${r.to.toISOString()}`, () => api.cash.sessions({ from: r.from, to: r.to }), ['cash']);
  const [opening, setOpening] = useState(false);
  const [moving, setMoving] = useState(null);
  const [closing, setClosing] = useState(false);

  const s = view?.session;
  const sum = view?.summary;
  const closed = (sessions || []).filter((x) => x.status === 'cerrada');
  const last = closed[0];

  return (
    <main class="page page--wide">
      <PageHeader
        title="Caja"
        sub="El efectivo del mostrador: apertura, entradas y salidas, y el corte del día."
        actions={s ? (
          <>
            <Button icon={Printer} onClick={() => printCashReport(view, settings, { partial: true })}>Corte X</Button>
            <Button variant="primary" icon={Lock} onClick={() => setClosing(true)}>Cerrar caja</Button>
          </>
        ) : !loading && <Button variant="primary" icon={Wallet} onClick={() => setOpening(true)}>Abrir caja</Button>}
      />

      {loading ? <Card bodyClass={false}><SkeletonRows rows={5} thumb={false} /></Card> : s ? (
        <>
          <div class="cash-top">
            <section class="cash-hero card card--hero">
              <p class="cash-hero__label">Efectivo que debe haber en la caja</p>
              <p class="cash-hero__value">{money(sum.expected)}</p>
              <p class="cash-hero__meta"><Clock aria-hidden="true" />Caja #{s.number} abierta {relative(s.openedAt)}{s.openedByName ? ` por ${s.openedByName}` : ''}</p>
              <div class="cash-hero__breakdown">
                <span>Fondo <strong>{money(s.openingAmount)}</strong></span>
                <span>Ventas en efectivo <strong>+{money(sum.cashSales)}</strong></span>
                {sum.movements.ingreso > 0 && <span>Ingresos <strong>+{money(sum.movements.ingreso)}</strong></span>}
                {sum.movements.retiro > 0 && <span>Retiros <strong>−{money(sum.movements.retiro)}</strong></span>}
                {sum.movements.gasto > 0 && <span>Gastos <strong>−{money(sum.movements.gasto)}</strong></span>}
              </div>
              <div class="cash-hero__actions">
                <button type="button" class="hero-pill" onClick={() => setMoving('ingreso')}><ArrowDownToLine aria-hidden="true" />Ingreso</button>
                <button type="button" class="hero-pill" onClick={() => setMoving('retiro')}><ArrowUpFromLine aria-hidden="true" />Retiro</button>
                <button type="button" class="hero-pill" onClick={() => setMoving('gasto')}><Receipt aria-hidden="true" />Gasto</button>
              </div>
            </section>
            <div class="cash-stats">
              <Card bodyClass={false}><Stat icon={ShoppingBag} label="Ventas del turno" value={money(sum.salesTotal)} foot={plural(sum.salesCount, 'venta', 'ventas')} /></Card>
              <Card bodyClass={false}><Stat icon={Receipt} label="Ticket promedio" value={money(sum.salesCount ? sum.salesTotal / sum.salesCount : 0)} foot={`${plural(sum.items, 'pieza', 'piezas')} vendidas`} /></Card>
              <Button variant="secondary" size="lg" block icon={ScanBarcode} onClick={() => navigate('/vender')}>Ir al punto de venta</Button>
            </div>
          </div>

          <div class="grid" style={{ '--cols': 2, marginTop: '20px' }}>
            <Card title="Por forma de pago" icon={Banknote}>
              <BarList rows={Object.entries(sum.byMethod || {}).map(([m, v]) => ({ key: m, label: methodLabel(m), value: v })).sort((a, b) => b.value - a.value)} format={(v) => money(v)} empty="Todavía no hay ventas en este turno." />
            </Card>
            <Card title="Movimientos de efectivo" icon={Wallet} bodyClass={false}>
              <div class="list">
                <div class="list__row"><span class="list__body"><span class="list__title">Fondo inicial</span><span class="list__sub">{time(s.openedAt)}</span></span><span class="list__end num strong">{money(s.openingAmount)}</span></div>
                {view.movements.map((m) => (
                  <div class="list__row">
                    <span class="list__body"><span class="list__title">{m.reason || methodLabel(m.type)}</span><span class="list__sub">{m.type === 'ingreso' ? 'Ingreso' : m.type === 'retiro' ? 'Retiro' : 'Gasto'} · {time(m.createdAt)}{m.createdByName ? ` · ${m.createdByName}` : ''}</span></span>
                    <span class={cx('list__end num strong', m.type === 'ingreso' ? 'tone-up' : 'tone-down')}>{m.type === 'ingreso' ? '+' : '−'}{money(m.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card title={`Ventas de este turno (${view.orders.length})`} icon={ShoppingBag} bodyClass={false} style={{ marginTop: '20px' }}>
            {view.orders.length ? (
              <div class="list">
                {view.orders.map((o) => (
                  <a class={cx('list__row', o.status === 'cancelado' && 'is-cancelled')} href={href(`/pedidos/${o.id}`)}>
                    <span class="list__body">
                      <span class="list__title">{o.number} · {plural(o.itemsCount, 'pieza', 'piezas')}</span>
                      <span class="list__sub">{time(o.paidAt || o.createdAt)} · {methodLabel(o.paymentMethod)}{o.channel !== 'tienda' ? ' · pedido en línea' : ''}{o.customer?.name ? ` · ${o.customer.name}` : ''}</span>
                    </span>
                    <span class="list__end">{o.status === 'cancelado' ? <Badge tone="red">Cancelada</Badge> : null}<strong class="num">{money(o.total)}</strong></span>
                  </a>
                ))}
              </div>
            ) : <Empty icon={ScanBarcode} title="Aún no hay ventas" action={<Button variant="primary" icon={ScanBarcode} onClick={() => navigate('/vender')}>Hacer una venta</Button>}>Las ventas del punto de venta aparecen aquí y suman al corte.</Empty>}
          </Card>
        </>
      ) : (
        <section class="cash-closed card">
          <span class="cash-closed__icon"><Lock aria-hidden="true" /></span>
          <h2>La caja está cerrada</h2>
          <p class="muted">Ábrela con el efectivo con el que empiezas (tu fondo) para registrar ventas de mostrador.</p>
          <Button variant="primary" size="lg" icon={Wallet} onClick={() => setOpening(true)}>Abrir caja</Button>
          {last && <p class="small muted">Último corte: {dateTime(last.closedAt)} · <DiffBadge value={last.difference} /></p>}
        </section>
      )}

      <div class="section-title">
        <h2><History aria-hidden="true" />Cortes anteriores</h2>
        <DateRangePicker value={range} onChange={setRange} align="right" />
      </div>
      <Card bodyClass={false}>
        {loadingHistory ? <SkeletonRows rows={5} thumb={false} /> : !closed.length ? (
          <Empty icon={History} title="Sin cortes en este periodo">Cada vez que cierres la caja quedará aquí su corte para consultarlo o imprimirlo.</Empty>
        ) : mobile ? (
          <div class="list">
            {closed.map((x) => (
              <a class="list__row" href={href(`/caja/${x.id}`)}>
                <span class="list__body">
                  <span class="list__title">#{x.number} · {weekday(x.openedAt)} {dateShort(x.openedAt)}</span>
                  <span class="list__sub">{money(x.summary?.salesTotal || 0)} en {plural(x.summary?.salesCount || 0, 'venta', 'ventas')}</span>
                </span>
                <span class="list__end"><DiffBadge value={x.difference} /></span>
              </a>
            ))}
          </div>
        ) : (
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Caja</th><th>Día</th><th>Horario</th><th class="num">Ventas</th><th class="num">Esperado</th><th class="num">Contado</th><th>Diferencia</th></tr></thead>
              <tbody>
                {closed.map((x) => (
                  <tr class="is-link" onClick={() => navigate(`/caja/${x.id}`)}>
                    <td class="strong">#{x.number}</td>
                    <td>{weekday(x.openedAt)} {dateShort(x.openedAt)}</td>
                    <td class="muted small">{time(x.openedAt)} – {time(x.closedAt)}</td>
                    <td class="num">{money(x.summary?.salesTotal || 0)}<div class="cell-sub">{plural(x.summary?.salesCount || 0, 'venta', 'ventas')}</div></td>
                    <td class="num">{money(x.expectedCash)}</td>
                    <td class="num">{money(x.countedCash)}</td>
                    <td><DiffBadge value={x.difference} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <OpenCashSheet open={opening} onClose={() => setOpening(false)} />
      <MovementSheet open={!!moving} initialType={moving || 'gasto'} expected={sum?.expected || 0} onClose={() => setMoving(null)} />
      <CloseCashSheet open={closing} view={view} onClose={() => setClosing(false)} onDone={(session) => session?.id && navigate(`/caja/${session.id}`)} />
    </main>
  );
}
