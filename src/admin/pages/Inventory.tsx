/**
 * Inventario: existencias por color y talla, ajustes con motivo, entradas de mercancía
 * (compatibles con lector de código de barras), kardex de movimientos y etiquetas.
 */
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { useStore } from '@nanostores/react';
import {
  Boxes,
  Coins,
  Download,
  History,
  Minus,
  PackagePlus,
  PackageX,
  Plus,
  Printer,
  ScanBarcode,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
} from 'lucide-react';
import { dateTime, money, number, plural } from '@/lib/format';
import { ADJUST_REASONS, MOVEMENT_TYPES, lowStockOf, round2 } from '@/lib/model';
import type { InventoryMovement, ProductVariant, Tone } from '@/lib/types';
import { api } from '../api';
import {
  LABEL_FORMATS,
  findBySku,
  labelsDocument,
  searchVariants,
  variantIndex,
  type LabelItem,
  type VariantEntry,
} from '../lib/catalog';
import { exportCsv, fileStamp } from '../lib/csv';
import { useIsMobile } from '../lib/hooks';
import { useSearch } from '../lib/navigation';
import { printDocument } from '../lib/print';
import { invalidate, useData } from '../lib/query';
import { inventoryValue } from '../lib/reports';
import { settingsStore } from '../lib/session';
import {
  Button,
  Checkbox,
  Field,
  IconButton,
  MoneyInput,
  SearchField,
  Segmented,
  SelectField,
  Stepper,
  Switch,
  TextField,
  cx,
  type MoneyValue,
} from '../ui/controls';
import { Sheet, toast, toastError } from '../ui/overlays';
import { DateRangePicker, resolveRange, type RangeValue } from '../ui/pickers';
import { Badge, Card, Empty, PageHeader, SkeletonRows, Stat, Tabs, Thumb } from '../ui/surfaces';

const TYPE_TONE: Record<string, Tone> = {
  inicial: 'gray',
  entrada: 'green',
  venta: 'blue',
  ajuste: 'amber',
  devolucion: 'teal',
  cancelacion: 'plum',
};

function stockState(v: ProductVariant, min: number): { tone: Tone; label: string } | null {
  if (v.stock <= 0) return { tone: 'red', label: 'Agotado' };
  if (v.stock <= min) return { tone: 'amber', label: 'Bajo mínimo' };
  return null;
}

type View = 'existencias' | 'movimientos';

export default function Inventory() {
  const { query, setQuery } = useSearch();
  const view: View = query.vista === 'movimientos' ? 'movimientos' : 'existencias';
  const { data: products, loading } = useData(['products'], () => api.catalog.products(), ['products', 'inventory']);
  const settings = useStore(settingsStore);
  const minDefault = settings?.private?.inventory?.lowStock ?? 0;
  const [adjusting, setAdjusting] = useState<VariantEntry | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [labels, setLabels] = useState<LabelItem[] | null>(null);

  const index = useMemo(() => variantIndex(products || []), [products]);
  const value = useMemo(() => inventoryValue(products || []), [products]);

  return (
    <main className="page page--wide">
      <PageHeader
        title="Inventario"
        sub="Existencias por color y talla, entradas de mercancía y el historial de cada movimiento."
        actions={
          <>
            <Button icon={Printer} onClick={() => setLabels([])}>
              Etiquetas
            </Button>
            <Button variant="primary" icon={PackagePlus} onClick={() => setReceiving(true)}>
              Entrada de mercancía
            </Button>
          </>
        }
      />

      <div className="grid stat-grid" style={{ '--cols': 4, '--cols-m': 2 }}>
        <Card bodyClass={false}>
          <Stat
            icon={Boxes}
            label="Piezas en existencia"
            value={number(value.units)}
            foot={`${plural(value.products, 'producto', 'productos')} con existencias`}
          />
        </Card>
        <Card bodyClass={false}>
          <Stat icon={Coins} label="Valor al costo" value={money(value.cost)} foot="Lo que invertiste en lo que hay" />
        </Card>
        <Card bodyClass={false}>
          <Stat
            icon={Tag}
            label="Valor de venta"
            value={money(value.retail)}
            foot={value.retail ? `Ganancia posible ${money(round2(value.retail - value.cost))}` : '—'}
          />
        </Card>
        <Card bodyClass={false}>
          <Stat
            icon={PackageX}
            label="Tallas agotadas"
            value={number(value.outCount)}
            foot={`de ${number(value.variants)} combinaciones`}
          />
        </Card>
      </div>

      <Tabs<View>
        value={view}
        onChange={(v) => setQuery({ vista: v === 'existencias' ? '' : v })}
        items={[
          { value: 'existencias', label: 'Existencias', icon: Boxes },
          { value: 'movimientos', label: 'Movimientos', icon: History },
        ]}
      />

      {view === 'existencias' ? (
        <StockView
          index={index}
          loading={loading}
          minDefault={minDefault}
          onAdjust={setAdjusting}
          onLabels={(items) => setLabels(items)}
        />
      ) : (
        <MovementsView />
      )}

      <AdjustSheet item={adjusting} onClose={() => setAdjusting(null)} />
      <ReceiveSheet open={receiving} onClose={() => setReceiving(false)} index={index} />
      <LabelsSheet
        items={labels}
        onClose={() => setLabels(null)}
        index={index}
        storeName={settings?.public?.store?.name}
      />
    </main>
  );
}

/* ---------- Existencias ---------- */
type StockFilter = 'todas' | 'con' | 'bajo' | 'agotadas';

function StockView({
  index,
  loading,
  minDefault,
  onAdjust,
  onLabels,
}: {
  index: VariantEntry[];
  loading: boolean;
  minDefault: number;
  onAdjust: (x: VariantEntry) => void;
  onLabels: (items: LabelItem[]) => void;
}) {
  const mobile = useIsMobile();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<StockFilter>('todas');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [limit, setLimit] = useState(150);

  const counts = useMemo(() => {
    const c = { todas: index.length, con: 0, agotadas: 0, bajo: 0 };
    for (const x of index) {
      if (x.variant.stock > 0) c.con++;
      else c.agotadas++;
      if (x.variant.stock > 0 && x.variant.stock <= lowStockOf(x.variant, minDefault)) c.bajo++;
    }
    return c;
  }, [index, minDefault]);

  const rows = useMemo(() => {
    const base = q ? searchVariants(index, q, 10000) : index;
    return base.filter((x) => {
      if (filter === 'con') return x.variant.stock > 0;
      if (filter === 'agotadas') return x.variant.stock <= 0;
      if (filter === 'bajo') return x.variant.stock > 0 && x.variant.stock <= lowStockOf(x.variant, minDefault);
      return true;
    });
  }, [index, q, filter, minDefault]);

  const quick = async (x: VariantEntry, delta: number) => {
    try {
      await api.inventory.adjust({ variantId: x.variant.id, mode: 'delta', qty: delta, reason: 'Ajuste rápido' });
      invalidate('products', 'inventory');
    } catch (err) {
      toastError(err);
    }
  };
  const toggle = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const exportRows = () =>
    exportCsv(`inventario-${fileStamp()}`, rows, [
      { label: 'Producto', value: (x) => x.product.name },
      { label: 'Código', value: (x) => x.product.code },
      { label: 'Color', value: (x) => x.color?.name },
      { label: 'Talla', value: (x) => x.variant.size },
      { label: 'SKU', value: (x) => x.variant.sku },
      { label: 'Existencias', value: (x) => x.variant.stock },
      { label: 'Costo unitario', value: (x) => x.product.cost },
      { label: 'Precio', value: (x) => x.product.price },
      { label: 'Valor al costo', value: (x) => round2(Math.max(0, x.variant.stock) * x.product.cost) },
      { label: 'Valor de venta', value: (x) => round2(Math.max(0, x.variant.stock) * x.product.price) },
    ]);

  const shown = rows.slice(0, limit);
  return (
    <>
      <div className="toolbar">
        <SearchField value={q} onValue={setQ} placeholder="Buscar o escanear SKU" />
        <Segmented<StockFilter>
          value={filter}
          onChange={setFilter}
          label="Filtrar existencias"
          options={[
            { value: 'todas', label: 'Todas', count: counts.todas },
            { value: 'con', label: 'Con piezas', count: counts.con },
            { value: 'bajo', label: 'Bajo mínimo', count: counts.bajo },
            { value: 'agotadas', label: 'Agotadas', count: counts.agotadas },
          ]}
        />
        <span className="grow" />
        {selected.size > 0 && (
          <Button
            variant="tinted"
            icon={Printer}
            onClick={() =>
              onLabels(
                index.filter((x) => selected.has(x.key)).map((x) => ({ ...x, copies: Math.max(1, x.variant.stock) })),
              )
            }
          >
            Etiquetas de {selected.size}
          </Button>
        )}
        <Button icon={Download} onClick={exportRows} disabled={!rows.length}>
          Exportar
        </Button>
      </div>

      <Card bodyClass={false}>
        {loading ? (
          <SkeletonRows rows={8} />
        ) : !rows.length ? (
          <Empty icon={Boxes} title="Nada por aquí">
            {q ? 'Ninguna prenda coincide con tu búsqueda.' : 'No hay variantes con este filtro.'}
          </Empty>
        ) : mobile ? (
          <div className="list">
            {shown.map((x) => {
              const st = stockState(x.variant, lowStockOf(x.variant, minDefault));
              return (
                <div key={x.key} className="list__row" style={{ '--inset': '72px' }}>
                  <Thumb src={x.image} size={42} />
                  <span className="list__body">
                    <span className="list__title">{x.product.name}</span>
                    <span className="list__sub">
                      {x.label} · <span className="mono">{x.variant.sku}</span>
                    </span>
                    {st && (
                      <span style={{ marginTop: '4px' }}>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="stock-pill"
                    onClick={() => onAdjust(x)}
                    aria-label={`Ajustar existencias de ${x.product.name} ${x.label}`}
                  >
                    <strong>{x.variant.stock}</strong>
                    <span>pzs</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '44px' }}>
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todas"
                      checked={shown.length > 0 && shown.every((x) => selected.has(x.key))}
                      onChange={(e) =>
                        setSelected(e.currentTarget.checked ? new Set(shown.map((x) => x.key)) : new Set())
                      }
                    />
                  </th>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th className="num">Precio</th>
                  <th className="num">Costo</th>
                  <th>Existencias</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {shown.map((x) => {
                  const st = stockState(x.variant, lowStockOf(x.variant, minDefault));
                  return (
                    <tr key={x.key} className={cx(selected.has(x.key) && 'is-selected')}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(x.key)}
                          onChange={() => toggle(x.key)}
                          aria-label={`Seleccionar ${x.product.name} ${x.label}`}
                        />
                      </td>
                      <td>
                        <div className="cell-main">
                          <Thumb src={x.image} size={36} />
                          <div style={{ minWidth: 0 }}>
                            <Link className="cell-title ellipsis" to={`/productos/${x.product.id}`}>
                              {x.product.name}
                            </Link>
                            <div className="cell-sub">{x.label}</div>
                          </div>
                        </div>
                      </td>
                      <td className="mono small">{x.variant.sku}</td>
                      <td className="num">{money(x.product.price)}</td>
                      <td className="num muted">{x.product.cost ? money(x.product.cost) : '—'}</td>
                      <td>
                        <div className="qty-inline">
                          <IconButton
                            size="sm"
                            icon={Minus}
                            label="Restar una pieza"
                            disabled={x.variant.stock <= 0}
                            onClick={() => void quick(x, -1)}
                          />
                          <strong className="num">{x.variant.stock}</strong>
                          <IconButton size="sm" icon={Plus} label="Sumar una pieza" onClick={() => void quick(x, 1)} />
                        </div>
                      </td>
                      <td>{st ? <Badge tone={st.tone}>{st.label}</Badge> : <span className="faint small">—</span>}</td>
                      <td className="end">
                        <Button size="sm" variant="ghost" icon={SlidersHorizontal} onClick={() => onAdjust(x)}>
                          Ajustar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > limit && (
          <div className="card__foot">
            <span className="muted small">
              Mostrando {number(limit)} de {number(rows.length)}
            </span>
            <Button size="sm" onClick={() => setLimit(limit + 300)}>
              Mostrar más
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}

/* ---------- Ajuste ---------- */
type AdjustMode = 'set' | 'delta';

function AdjustSheet({ item, onClose }: { item: VariantEntry | null; onClose: () => void }) {
  const [mode, setMode] = useState<AdjustMode>('set');
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState(ADJUST_REASONS[0] || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const current = item?.variant.stock ?? 0;
  useLayoutEffect(() => {
    if (!item) return;
    setMode('set');
    setQty(item.variant.stock);
    setReason(ADJUST_REASONS[0] || '');
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key]);
  const result = mode === 'set' ? qty : current + qty;
  const save = async () => {
    if (!item) return;
    setBusy(true);
    try {
      await api.inventory.adjust({ variantId: item.variant.id, mode, qty, reason, note });
      invalidate('products', 'inventory');
      toast({ title: 'Inventario actualizado', sub: `${item.product.name} · ${item.label}: ${result} pzs` });
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={!!item}
      onClose={onClose}
      size="sm"
      title="Ajustar existencias"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={result < 0 || result === current}
            onClick={() => void save()}
          >
            Guardar ajuste
          </Button>
        </>
      }
    >
      {item && (
        <div className="stack">
          <div className="row" style={{ '--gap': '12px' }}>
            <Thumb src={item.image} size={48} />
            <div className="grow">
              <p className="strong">{item.product.name}</p>
              <p className="small muted">
                {item.label} · <span className="mono">{item.variant.sku}</span>
              </p>
            </div>
            <div className="adjust-now">
              <span>Ahora</span>
              <strong>{current}</strong>
            </div>
          </div>
          <Segmented<AdjustMode>
            block
            value={mode}
            onChange={(m) => {
              setMode(m);
              setQty(m === 'set' ? current : 0);
            }}
            options={[
              { value: 'set', label: 'Contar piezas' },
              { value: 'delta', label: 'Sumar o restar' },
            ]}
          />
          <div className="adjust-qty">
            {mode === 'set' ? (
              <Stepper value={qty} onChange={setQty} min={0} label="Piezas contadas" />
            ) : (
              <Stepper value={qty} onChange={setQty} min={-current} max={9999} label="Piezas a sumar o restar" />
            )}
            <p className="muted small">
              {mode === 'set' ? 'Escribe cuántas piezas hay físicamente.' : 'Usa números negativos para restar.'}
            </p>
          </div>
          <div className={cx('adjust-result', result < current && 'is-down', result > current && 'is-up')}>
            Quedarán <strong>{result}</strong> pieza{result === 1 ? '' : 's'}{' '}
            {result !== current && (
              <span>
                ({result > current ? '+' : ''}
                {result - current})
              </span>
            )}
          </div>
          <SelectField label="Motivo" value={reason} onValue={setReason} options={ADJUST_REASONS} />
          <TextField label="Nota" optional value={note} onValue={setNote} placeholder="Ej. Se manchó en el probador" />
        </div>
      )}
    </Sheet>
  );
}

/* ---------- Entrada de mercancía ---------- */
interface ReceiveLine {
  key: string;
  x: VariantEntry;
  qty: number;
  unitCost: MoneyValue;
}

function ReceiveSheet({ open, onClose, index }: { open: boolean; onClose: () => void; index: VariantEntry[] }) {
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [updateCost, setUpdateCost] = useState(true);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const results = q ? searchVariants(index, q, 12) : [];

  const add = (x: VariantEntry) => {
    setLines((ls) => {
      const found = ls.find((l) => l.key === x.key);
      if (found) return ls.map((l) => (l.key === x.key ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { key: x.key, x, qty: 1, unitCost: x.product.cost || '' }];
    });
    setQ('');
    input.current?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const hit = findBySku(index, q) || (results.length === 1 ? results[0] : null);
    if (hit) add(hit);
    else if (q) toast({ tone: 'error', title: 'No encontramos ese código', sub: q });
  };
  const units = lines.reduce((a, l) => a + l.qty, 0);
  const total = lines.reduce((a, l) => a + l.qty * (Number(l.unitCost) || 0), 0);
  const close = () => {
    setLines([]);
    setQ('');
    setReference('');
    setNote('');
    onClose();
  };
  const save = async () => {
    setBusy(true);
    try {
      await api.inventory.receive({
        items: lines.map((l) => ({ variantId: l.x.variant.id, qty: l.qty, unitCost: Number(l.unitCost) || 0 })),
        reference,
        note,
        updateCost,
      });
      invalidate('products', 'inventory');
      toast({ title: 'Entrada registrada', sub: `${plural(units, 'pieza', 'piezas')} agregadas al inventario` });
      close();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      size="lg"
      title="Entrada de mercancía"
      sub="Escanea o busca las prendas que llegaron y escribe cuántas piezas de cada una."
      footer={
        <>
          <span className="grow muted small">
            {lines.length
              ? `${plural(units, 'pieza', 'piezas')} · costo ${money(total)}`
              : 'Agrega al menos una prenda'}
          </span>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon={PackagePlus}
            loading={busy}
            disabled={!lines.length}
            onClick={() => void save()}
          >
            Registrar entrada
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="scan-box">
          <ScanBarcode aria-hidden="true" />
          <input
            ref={input}
            className="input"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            onKeyDown={onKey}
            placeholder="Escanea el código o escribe nombre, color, talla…"
            aria-label="Buscar prenda"
            data-autofocus
          />
        </div>
        {q && (
          <div className="pick-list">
            {results.length ? (
              results.map((x) => (
                <button key={x.key} type="button" className="pick-row" onClick={() => add(x)}>
                  <Thumb src={x.image} size={34} />
                  <span className="grow">
                    <strong>{x.product.name}</strong>
                    <small>
                      {x.label} · <span className="mono">{x.variant.sku}</span>
                    </small>
                  </span>
                  <span className="muted small">{x.variant.stock} en existencia</span>
                  <Plus aria-hidden="true" />
                </button>
              ))
            ) : (
              <p className="muted small" style={{ padding: '10px 4px' }}>
                Sin resultados. Si es una prenda nueva, primero créala en Productos.
              </p>
            )}
          </div>
        )}
        {lines.length > 0 && (
          <div className="receive-lines">
            {lines.map((l) => (
              <div key={l.key} className="receive-line">
                <Thumb src={l.x.image} size={38} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <p className="strong ellipsis">{l.x.product.name}</p>
                  <p className="small muted">
                    {l.x.label} · hay {l.x.variant.stock}
                  </p>
                </div>
                <Stepper
                  size="sm"
                  value={l.qty}
                  min={1}
                  onChange={(n) => setLines((ls) => ls.map((y) => (y.key === l.key ? { ...y, qty: n } : y)))}
                />
                <div style={{ width: '120px' }}>
                  <MoneyInput
                    value={l.unitCost}
                    onValue={(v) => setLines((ls) => ls.map((y) => (y.key === l.key ? { ...y, unitCost: v } : y)))}
                    aria-label="Costo unitario"
                  />
                </div>
                <IconButton
                  size="sm"
                  danger
                  icon={Trash2}
                  label="Quitar"
                  onClick={() => setLines((ls) => ls.filter((y) => y.key !== l.key))}
                />
              </div>
            ))}
          </div>
        )}
        {!lines.length && !q && (
          <div className="hint-box">
            <Search aria-hidden="true" />
            <p>
              Con una pistola lectora, apunta al código de la etiqueta: la prenda se agrega sola. Cada lectura suma una
              pieza.
            </p>
          </div>
        )}
        <div className="grid" style={{ '--cols': 2 }}>
          <TextField
            label="Referencia"
            optional
            value={reference}
            onValue={setReference}
            placeholder="Folio, lote o factura"
          />
          <TextField label="Nota" optional value={note} onValue={setNote} placeholder="Ej. Llegada de temporada" />
        </div>
        <Checkbox checked={updateCost} onChange={setUpdateCost}>
          Actualizar el costo de los productos con el de esta entrada
        </Checkbox>
      </div>
    </Sheet>
  );
}

/* ---------- Etiquetas ---------- */
function LabelsSheet({
  items,
  onClose,
  index,
  storeName,
}: {
  items: LabelItem[] | null;
  onClose: () => void;
  index: VariantEntry[];
  storeName: string | undefined;
}) {
  const [list, setList] = useState<LabelItem[]>([]);
  const [q, setQ] = useState('');
  const [format, setFormat] = useState('termica');
  const [showPrice, setShowPrice] = useState(true);
  useLayoutEffect(() => {
    if (items) {
      setList(items);
      setQ('');
    }
  }, [items]);
  const results = q ? searchVariants(index, q, 10) : [];
  const add = (x: VariantEntry) => {
    setList((l) => (l.some((y) => y.key === x.key) ? l : [...l, { ...x, copies: 1 }]));
    setQ('');
  };
  const count = list.reduce((a, x) => a + Math.max(1, x.copies || 1), 0);
  const print = () => {
    const doc = labelsDocument(list, { format, showPrice, storeName: storeName || 'Divani' });
    printDocument({ title: 'Etiquetas', body: doc.body, css: doc.css, page: 'custom' });
  };
  return (
    <Sheet
      open={!!items}
      onClose={onClose}
      size="lg"
      title="Imprimir etiquetas"
      sub="Con código de barras del SKU: el punto de venta lo lee con la pistola o la cámara."
      footer={
        <>
          <span className="grow muted small">{count ? `${plural(count, 'etiqueta', 'etiquetas')}` : ''}</span>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button variant="primary" icon={Printer} disabled={!list.length} onClick={print}>
            Imprimir
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="grid" style={{ '--cols': 2 }}>
          <SelectField
            label="Formato"
            value={format}
            onValue={setFormat}
            options={LABEL_FORMATS.map((f) => ({ value: f.id, label: f.name }))}
          />
          <Field label="Precio en la etiqueta">
            <label className="row" style={{ minHeight: '44px' }}>
              <Switch checked={showPrice} onChange={setShowPrice} label="Mostrar precio" />
              <span>{showPrice ? 'Se muestra' : 'Sin precio'}</span>
            </label>
          </Field>
        </div>
        <div className="scan-box">
          <Search aria-hidden="true" />
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            placeholder="Agregar prenda: nombre, color, talla o SKU"
            aria-label="Agregar prenda"
          />
        </div>
        {q && (
          <div className="pick-list">
            {results.map((x) => (
              <button key={x.key} type="button" className="pick-row" onClick={() => add(x)}>
                <Thumb src={x.image} size={34} />
                <span className="grow">
                  <strong>{x.product.name}</strong>
                  <small>
                    {x.label} · <span className="mono">{x.variant.sku}</span>
                  </small>
                </span>
                <Plus aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
        {list.length ? (
          <div className="receive-lines">
            {list.map((x) => (
              <div key={x.key} className="receive-line">
                <Thumb src={x.image} size={38} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <p className="strong ellipsis">{x.product.name}</p>
                  <p className="small muted">
                    {x.label} · <span className="mono">{x.variant.sku}</span>
                  </p>
                </div>
                <span className="small muted hide-mobile">Copias</span>
                <Stepper
                  size="sm"
                  value={x.copies || 1}
                  min={1}
                  max={200}
                  onChange={(n) => setList((l) => l.map((y) => (y.key === x.key ? { ...y, copies: n } : y)))}
                />
                <IconButton
                  size="sm"
                  danger
                  icon={Trash2}
                  label="Quitar"
                  onClick={() => setList((l) => l.filter((y) => y.key !== x.key))}
                />
              </div>
            ))}
          </div>
        ) : (
          <Empty icon={Printer} title="Elige qué etiquetar">
            Busca prendas arriba o selecciónalas en la tabla de existencias.
          </Empty>
        )}
      </div>
    </Sheet>
  );
}

/* ---------- Movimientos (kardex) ---------- */
type MovementFilter = 'todos' | 'entrada' | 'venta' | 'ajuste' | 'cancelacion';

function MovementsView() {
  const mobile = useIsMobile();
  const [range, setRange] = useState<RangeValue>({ preset: '30d' });
  const [type, setType] = useState<MovementFilter>('todos');
  const [q, setQ] = useState('');
  const r = resolveRange(range);
  const { data, loading } = useData(
    ['inventory', 'movements', r.from.toISOString(), r.to.toISOString()],
    () => api.inventory.movements({ from: r.from, to: r.to }),
    ['inventory', 'products', 'orders'],
  );
  const rows = useMemo(
    () =>
      (data || []).filter(
        (m) =>
          (type === 'todos' || m.type === type || (type === 'ajuste' && m.type === 'inicial')) &&
          (!q || `${m.productName} ${m.sku} ${m.reference} ${m.reason}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [data, type, q],
  );
  const totals = useMemo(
    () =>
      rows.reduce(
        (a, m) => {
          if (m.qty > 0) a.in += m.qty;
          else a.out -= m.qty;
          return a;
        },
        { in: 0, out: 0 },
      ),
    [rows],
  );

  const exportRows = () =>
    exportCsv<InventoryMovement>(`movimientos-${fileStamp()}`, rows, [
      { label: 'Fecha', value: (m) => dateTime(m.createdAt) },
      { label: 'Tipo', value: (m) => MOVEMENT_TYPES[m.type] || m.type },
      { label: 'Producto', value: (m) => m.productName },
      { label: 'Variante', value: (m) => m.variantLabel },
      { label: 'SKU', value: (m) => m.sku },
      { label: 'Cantidad', value: (m) => m.qty },
      { label: 'Existencia después', value: (m) => m.stockAfter ?? '' },
      { label: 'Costo unitario', value: (m) => m.unitCost },
      { label: 'Motivo', value: (m) => m.reason },
      { label: 'Referencia', value: (m) => m.reference },
      { label: 'Usuario', value: (m) => m.createdByName },
    ]);

  return (
    <>
      <div className="toolbar">
        <DateRangePicker value={range} onChange={setRange} />
        <Segmented<MovementFilter>
          value={type}
          onChange={setType}
          label="Tipo de movimiento"
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'entrada', label: 'Entradas' },
            { value: 'venta', label: 'Ventas' },
            { value: 'ajuste', label: 'Ajustes' },
            { value: 'cancelacion', label: 'Cancelaciones' },
          ]}
        />
        <SearchField value={q} onValue={setQ} placeholder="Producto, SKU o referencia" />
        <span className="grow" />
        <Button icon={Download} onClick={exportRows} disabled={!rows.length}>
          Exportar
        </Button>
      </div>
      <p className="muted small" style={{ margin: '-4px 0 12px' }}>
        {plural(rows.length, 'movimiento', 'movimientos')} ·{' '}
        <span className="tone-up">+{number(totals.in)} entraron</span> ·{' '}
        <span className="tone-down">−{number(totals.out)} salieron</span>
      </p>
      <Card bodyClass={false}>
        {loading ? (
          <SkeletonRows rows={8} />
        ) : !rows.length ? (
          <Empty icon={History} title="Sin movimientos en este periodo">
            Las ventas, entradas y ajustes aparecerán aquí con su fecha, motivo y quién los hizo.
          </Empty>
        ) : mobile ? (
          <div className="list">
            {rows.slice(0, 300).map((m) => (
              <div key={m.id} className="list__row">
                <span className="list__body">
                  <span className="list__title">{m.productName}</span>
                  <span className="list__sub">
                    {m.variantLabel} · {dateTime(m.createdAt)}
                  </span>
                  <span className="list__sub">
                    {m.reason}
                    {m.reference && !m.reason.includes(m.reference) ? ` · ${m.reference}` : ''}
                  </span>
                </span>
                <span className="list__end">
                  <Badge tone={TYPE_TONE[m.type]}>{MOVEMENT_TYPES[m.type]}</Badge>
                  <strong className={cx('num', m.qty > 0 ? 'tone-up' : 'tone-down')}>
                    {m.qty > 0 ? '+' : ''}
                    {m.qty}
                  </strong>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th className="num">Cantidad</th>
                  <th className="num">Quedó</th>
                  <th>Motivo</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 500).map((m) => (
                  <tr key={m.id}>
                    <td className="small muted" style={{ whiteSpace: 'nowrap' }}>
                      {dateTime(m.createdAt)}
                    </td>
                    <td>
                      <div className="cell-title">{m.productName}</div>
                      <div className="cell-sub">
                        {m.variantLabel} · <span className="mono">{m.sku}</span>
                      </div>
                    </td>
                    <td>
                      <Badge tone={TYPE_TONE[m.type]}>{MOVEMENT_TYPES[m.type] || m.type}</Badge>
                    </td>
                    <td className={cx('num strong', m.qty > 0 ? 'tone-up' : 'tone-down')}>
                      {m.qty > 0 ? '+' : ''}
                      {m.qty}
                    </td>
                    <td className="num">{m.stockAfter ?? '—'}</td>
                    <td className="small">
                      {m.reason}
                      {m.reference && !m.reason.includes(m.reference) ? (
                        <div className="cell-sub">{m.reference}</div>
                      ) : null}
                    </td>
                    <td className="small muted">{m.createdByName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
