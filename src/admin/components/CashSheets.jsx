/** Hojas de caja: abrir, registrar ingreso/retiro/gasto y cerrar con arqueo por denominaciones. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Receipt, Lock, Calculator } from 'lucide-preact';
import { api } from '../api/index.js';
import { invalidate } from '../lib/query.js';
import { money } from '../lib/format.js';
import { useStore } from '../lib/store.js';
import { settingsStore } from '../lib/session.js';
import { REGION_PRESETS, CASH_MOVEMENT_TYPES, round2 } from '../../backend/model.js';
import { Button, Field, MoneyInput, Segmented, TextField, Stepper, Chip, cx } from '../ui/controls.jsx';
import { Sheet, toast, toastError } from '../ui/overlays.jsx';

export function useDenominations() {
  const settings = useStore(settingsStore);
  return settings?.private?.cash?.denominations || REGION_PRESETS[settings?.public?.region?.preset || 'mx']?.denominations || REGION_PRESETS.mx.denominations;
}

export function OpenCashSheet({ open, onClose, onDone }) {
  const settings = useStore(settingsStore);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setAmount(settings?.private?.cash?.suggestedFloat ?? 500); setNotes(''); } }, [open]);
  const save = async () => {
    setBusy(true);
    try {
      await api.cash.open({ amount: Number(amount) || 0, notes });
      invalidate('cash', 'orders');
      toast({ title: 'Caja abierta', sub: `Fondo inicial ${money(Number(amount) || 0)}` });
      onDone?.();
      onClose();
    } catch (err) { toastError(err); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} size="sm" title="Abrir caja" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" icon={Wallet} loading={busy} onClick={save}>Abrir caja</Button></>}>
      <div class="stack">
        <p class="muted small">Cuenta el efectivo con el que empiezas el día (el cambio que dejas en la caja).</p>
        <Field label="Fondo inicial"><MoneyInput big value={amount} onValue={setAmount} data-autofocus /></Field>
        <TextField label="Nota" optional value={notes} onValue={setNotes} placeholder="Ej. Turno de la mañana" />
      </div>
    </Sheet>
  );
}

const QUICK_REASONS = {
  ingreso: ['Cambio adicional', 'Préstamo a caja', 'Otro ingreso'],
  retiro: ['Depósito al banco', 'Resguardo', 'Pago a proveedor'],
  gasto: ['Envío por paquetería', 'Bolsas y empaque', 'Papelería', 'Limpieza', 'Comida'],
};

export function MovementSheet({ open, initialType = 'gasto', expected = 0, onClose, onDone }) {
  const [type, setType] = useState(initialType);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setType(initialType); setAmount(''); setReason(''); } }, [open, initialType]);
  const info = CASH_MOVEMENT_TYPES.find((t) => t.id === type);
  const over = type !== 'ingreso' && Number(amount) > expected + 0.001;
  const save = async () => {
    setBusy(true);
    try {
      await api.cash.movement({ type, amount: Number(amount) || 0, reason });
      invalidate('cash');
      toast({ title: `${info.label} registrado`, sub: `${money(Number(amount) || 0)}${reason ? ` · ${reason}` : ''}` });
      onDone?.();
      onClose();
    } catch (err) { toastError(err); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} size="sm" title="Movimiento de efectivo" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} disabled={!(Number(amount) > 0) || over} onClick={save}>Registrar {info?.label.toLowerCase()}</Button></>}>
      <div class="stack">
        <Segmented block value={type} onChange={setType} options={[
          { value: 'ingreso', label: 'Ingreso', icon: ArrowDownToLine },
          { value: 'retiro', label: 'Retiro', icon: ArrowUpFromLine },
          { value: 'gasto', label: 'Gasto', icon: Receipt },
        ]} />
        <p class="muted small">{info?.hint}</p>
        <Field label="Importe" error={over ? `En caja debería haber ${money(expected)}.` : null}><MoneyInput big value={amount} onValue={setAmount} data-autofocus /></Field>
        <TextField label="Motivo" value={reason} onValue={setReason} placeholder="¿Para qué fue?" />
        <div class="chips">{QUICK_REASONS[type].map((r) => <Chip size="sm" pressed={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}</div>
      </div>
    </Sheet>
  );
}

/** Conteo por denominaciones: { '500': 2, '0.5': 4 } */
export function DenominationCounter({ value, onChange }) {
  const den = useDenominations();
  const all = [...den.bills.map((d) => ({ d, kind: 'Billetes' })), ...den.coins.map((d) => ({ d, kind: 'Monedas' }))];
  const total = all.reduce((a, { d }) => a + d * (Number(value[d]) || 0), 0);
  let lastKind = '';
  return (
    <div class="denoms">
      {all.map(({ d, kind }) => {
        const head = kind !== lastKind;
        lastKind = kind;
        return (
          <>
            {head && <p class="denoms__kind">{kind}</p>}
            <div class={cx('denom', Number(value[d]) > 0 && 'is-set')}>
              <span class="denom__face">{money(d, { cents: d % 1 !== 0 })}</span>
              <Stepper size="sm" value={Number(value[d]) || 0} min={0} max={9999} onChange={(n) => onChange({ ...value, [d]: n })} label={`Cantidad de ${money(d)}`} />
              <span class="denom__sum num">{money(d * (Number(value[d]) || 0), { cents: d % 1 !== 0 })}</span>
            </div>
          </>
        );
      })}
      <div class="denoms__total"><span>Total contado</span><strong>{money(round2(total), { cents: 'auto' })}</strong></div>
    </div>
  );
}

export function CloseCashSheet({ open, view, onClose, onDone }) {
  const [mode, setMode] = useState('denoms');
  const [counts, setCounts] = useState({});
  const [manual, setManual] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setCounts({}); setManual(''); setNotes(''); setMode('denoms'); } }, [open]);
  const counted = useMemo(() => (mode === 'denoms'
    ? round2(Object.entries(counts).reduce((a, [d, n]) => a + Number(d) * (Number(n) || 0), 0))
    : Number(manual) || 0), [mode, counts, manual]);
  const expected = view?.summary?.expected ?? 0;
  const diff = round2(counted - expected);
  const save = async () => {
    setBusy(true);
    try {
      const session = await api.cash.close({ counted, breakdown: mode === 'denoms' ? Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0)) : null, notes });
      invalidate('cash', 'orders');
      toast({ title: 'Caja cerrada', sub: diff === 0 ? 'El corte cuadró perfecto.' : diff > 0 ? `Sobrante de ${money(diff)}` : `Faltante de ${money(-diff)}` });
      onDone?.(session);
      onClose();
    } catch (err) { toastError(err); } finally { setBusy(false); }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title="Cerrar caja · corte Z"
      sub="Cuenta el efectivo que hay en la caja. Comparamos lo contado con lo que debería haber."
      footer={(
        <>
          <span class={cx('grow close-diff', diff > 0 && 'is-over', diff < 0 && 'is-short')}>
            {counted || mode === 'manual' ? (diff === 0 ? 'Cuadra exacto' : diff > 0 ? `Sobrante ${money(diff)}` : `Faltante ${money(-diff)}`) : 'Cuenta el efectivo'}
          </span>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={Lock} loading={busy} onClick={save}>Cerrar caja</Button>
        </>
      )}
    >
      <div class="close-grid">
        <div class="stack">
          <Segmented block value={mode} onChange={setMode} options={[{ value: 'denoms', label: 'Contar billetes y monedas', icon: Calculator }, { value: 'manual', label: 'Escribir el total' }]} />
          {mode === 'denoms'
            ? <DenominationCounter value={counts} onChange={setCounts} />
            : <Field label="Efectivo contado"><MoneyInput big value={manual} onValue={setManual} data-autofocus /></Field>}
        </div>
        <div class="stack close-summary">
          <div class="close-figure"><span>Debería haber</span><strong>{money(expected)}</strong></div>
          <div class="close-figure"><span>Contaste</span><strong>{money(counted)}</strong></div>
          <div class={cx('close-figure close-figure--diff', diff > 0 && 'is-over', diff < 0 && 'is-short')}>
            <span>Diferencia</span>
            <strong>{diff > 0 ? '+' : ''}{money(diff)}</strong>
            <small>{diff === 0 ? 'Cuadra' : diff > 0 ? 'Sobrante' : 'Faltante'}</small>
          </div>
          <TextField label="Notas del corte" optional multiline rows={3} value={notes} onValue={setNotes} placeholder="Ej. Faltante por cambio mal dado" />
        </div>
      </div>
    </Sheet>
  );
}
