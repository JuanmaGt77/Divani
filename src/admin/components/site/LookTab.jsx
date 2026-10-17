/**
 * «Arma tu look»: una foto con puntos que llevan a cada prenda.
 * Toca la foto para poner un punto, elige la prenda y arrástralo a su lugar.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Plus, Trash2, Shirt, Star, Save, MousePointerClick, ImagePlus } from 'lucide-preact';
import { api } from '../../api/index.js';
import { invalidate } from '../../lib/query.js';
import { setLeaveGuard } from '../../lib/router.js';
import { money } from '../../lib/format.js';
import { matches } from '../../lib/hooks.js';
import { cdn, round2 } from '../../../backend/model.js';
import { Button, TextField, SearchField, SwitchRow, Chip, IconButton, cx } from '../../ui/controls.jsx';
import { Card, Badge, Empty, SkeletonRows, Thumb, Menu } from '../../ui/surfaces.jsx';
import { Sheet, toast, toastError, confirmDialog } from '../../ui/overlays.jsx';
import { MediaField } from '../../ui/media.jsx';
import { EMPH } from './shared.jsx';

const NEW_LOOK = { eyebrow: 'Arma tu look', title: '', text: '', image: '', hotspots: [], active: true };
const editable = (l) => JSON.stringify([l.eyebrow || '', l.title || '', l.text || '', l.image || '', l.hotspots || [], l.active !== false]);
const MAX_POINTS = 8;

export function LookTab({ data, products, loading, onSaved }) {
  const looks = data?.lookbooks || [];
  const [sel, setSel] = useState(null);
  const found = sel && sel !== 'new' ? looks.find((l) => l.id === sel) : null;
  const isNew = sel === 'new' || (sel && !found); // recién creado: sigue en el mismo editor hasta que llegue en la lista
  const current = isNew ? null : found || looks[0] || null;
  const featured = looks.find((l) => l.active !== false);

  if (loading) return <Card bodyClass={false}><SkeletonRows rows={4} /></Card>;

  return (
    <>
      <div class="tab-intro">
        <p class="muted">La portada muestra el primer look activo. Toca la foto para marcar cada prenda: tus clientas las ven y piden el look completo por WhatsApp.</p>
        <div class="row row--wrap" style={{ '--gap': '8px' }}>
          {looks.length > 1 && looks.map((l) => (
            <Chip pressed={!isNew && current?.id === l.id} onClick={() => setSel(l.id)} icon={featured?.id === l.id ? Star : undefined}>{l.title.replace(/\*/g, '') || 'Sin título'}</Chip>
          ))}
          <Button icon={Plus} onClick={() => setSel('new')}>Nuevo look</Button>
        </div>
      </div>
      {!isNew && !current ? (
        <Card><Empty icon={Shirt} title="Aún no tienes looks" action={<Button variant="primary" icon={Plus} onClick={() => setSel('new')}>Crear un look</Button>}>Sube una foto de un outfit completo y marca cada prenda.</Empty></Card>
      ) : (
        <LookEditor
          key={isNew ? 'new' : current.id}
          look={isNew ? NEW_LOOK : current}
          isFeatured={!isNew && featured?.id === current.id}
          looks={looks}
          products={products}
          onSaved={(id) => { if (id) setSel(id); onSaved?.(); }}
          onDeleted={() => { setSel(null); onSaved?.(); }}
        />
      )}
    </>
  );
}

function LookEditor({ look, isFeatured, looks, products, onSaved, onDeleted }) {
  const [d, setD] = useState(() => structuredClone(look));
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(null); // índice del punto seleccionado
  const [picking, setPicking] = useState(null); // { x, y } o { index } para cambiar la prenda
  const dirty = editable(d) !== editable(look);
  const set = (p) => setD((x) => ({ ...x, ...p }));
  const bySlug = useMemo(() => Object.fromEntries((products || []).map((p) => [p.slug, p])), [products]);

  useEffect(() => setLeaveGuard((unload) => !dirty || (!unload && window.confirm('Tienes cambios sin guardar en el look. ¿Salir sin guardar?'))), [dirty]);
  useEffect(() => () => setLeaveGuard(null), []);

  const setPoint = (i, patch) => set({ hotspots: d.hotspots.map((h, k) => (k === i ? { ...h, ...patch } : h)) });
  const removePoint = (i) => { set({ hotspots: d.hotspots.filter((_, k) => k !== i) }); setActive(null); };

  const choose = (p) => {
    const color = p.colors?.[0]?.name || '';
    if (picking?.index != null) {
      setPoint(picking.index, { product: p.slug, color });
      setActive(picking.index);
    } else if (picking) {
      set({ hotspots: [...d.hotspots, { product: p.slug, color, x: picking.x, y: picking.y }] });
      setActive(d.hotspots.length);
    }
    setPicking(null);
  };

  const save = async (extra = {}) => {
    setBusy(true);
    try {
      const next = { ...d, ...extra };
      const saved = await api.content.saveLookbook(next);
      invalidate('content');
      toast({ title: d.id ? 'Look actualizado' : 'Look creado', sub: next.active === false ? 'Quedó guardado sin publicar.' : 'Ya se ve en la tienda.' });
      setD(structuredClone({ ...next, id: next.id || saved?.id }));
      onSaved?.(next.id || saved?.id);
    } catch (err) {
      toastError(err, 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  const feature = async () => {
    try {
      await api.content.saveLookbook({ ...d, active: true });
      await api.content.reorderLookbooks([d.id, ...looks.map((l) => l.id).filter((x) => x !== d.id)]);
      set({ active: true });
      invalidate('content');
      onSaved?.(d.id);
      toast({ title: 'Este look ya está en la portada' });
    } catch (err) {
      toastError(err);
    }
  };

  const remove = async () => {
    const ok = await confirmDialog({ title: '¿Eliminar este look?', message: 'Se quita de la tienda. Las prendas no se borran.', confirm: 'Eliminar', danger: true });
    if (!ok) return;
    try {
      await api.content.deleteLookbook(d.id);
      invalidate('content');
      toast({ title: 'Look eliminado' });
      onDeleted?.();
    } catch (err) {
      toastError(err);
    }
  };

  const pieces = d.hotspots.map((h) => ({ ...h, p: bySlug[h.product] }));
  const total = pieces.reduce((a, x) => a + (x.p?.price || 0), 0);

  return (
    <div class="look-editor">
      <Card class="look-editor__media" bodyClass={false}>
        {d.image ? (
          <HotspotCanvas
            image={d.image}
            points={pieces}
            active={active}
            onSelect={setActive}
            onMove={(i, x, y) => setPoint(i, { x, y })}
            onAdd={(x, y) => (d.hotspots.length >= MAX_POINTS ? toastError(new Error(`Máximo ${MAX_POINTS} prendas por look.`), 'Ya no caben más') : setPicking({ x, y }))}
          />
        ) : (
          <div style={{ padding: '18px' }}>
            <MediaField label="Foto del look" value={d.image} onChange={(v) => set({ image: v })} aspect="6 / 5" folder="divani/looks" hint="Horizontal 6:5, 1800 × 1500 px. Que se vea el outfit completo." />
          </div>
        )}
        {d.image && (
          <div class="look-editor__hint">
            <MousePointerClick aria-hidden="true" />
            <span class="grow">Toca la foto para marcar una prenda. Arrastra los puntos para acomodarlos.</span>
            <Button size="sm" variant="ghost" icon={ImagePlus} onClick={() => set({ image: '' })}>Cambiar foto</Button>
          </div>
        )}
      </Card>

      <div class="stack look-editor__side">
        <Card title="Textos">
          <div class="stack">
            <TextField label="Texto pequeño" value={d.eyebrow} onValue={(v) => set({ eyebrow: v })} maxLength={60} />
            <TextField label="Título" value={d.title} onValue={(v) => set({ title: v })} placeholder="Sastrería *suave*" hint={EMPH} maxLength={120} />
            <TextField label="Descripción" multiline rows={3} value={d.text} onValue={(v) => set({ text: v })} maxLength={400} />
          </div>
        </Card>

        <Card title="Prendas del look" sub={pieces.length ? `${pieces.length} de ${MAX_POINTS} · Look completo ${money(total)}` : 'Toca la foto para agregar la primera'} bodyClass={false}>
          {pieces.length > 0 && (
            <div class="list">
              {pieces.map((x, i) => (
                <div class={cx('list__row look-piece', active === i && 'is-active')} onMouseEnter={() => setActive(i)} style={{ '--inset': '64px' }}>
                  <span class="look-piece__num">{i + 1}</span>
                  <Thumb src={x.p?.colors?.find((c) => c.name === x.color)?.images?.[0] || x.p?.colors?.[0]?.images?.[0]} size={36} />
                  <span class="list__body">
                    <span class="list__title">{x.p?.name || 'Prenda no encontrada'}</span>
                    {x.p ? (
                      <select class="input input--sm look-piece__color" value={x.color} onChange={(e) => setPoint(i, { color: e.currentTarget.value })} aria-label="Color">
                        {x.p.colors.map((c) => <option value={c.name}>{c.name}</option>)}
                      </select>
                    ) : <span class="list__sub">Elige otra prenda</span>}
                  </span>
                  <Menu items={[
                    { label: 'Cambiar prenda', icon: Shirt, onClick: () => setPicking({ index: i }) },
                    { label: 'Quitar del look', icon: Trash2, danger: true, onClick: () => removePoint(i) },
                  ]} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <div class="list card">
          <SwitchRow title="Mostrar en la tienda" sub={isFeatured ? 'Es el look que aparece en la portada' : 'Guárdalo apagado para prepararlo con calma'} checked={d.active !== false} onChange={(v) => set({ active: v })} />
        </div>

        <div class="row row--wrap" style={{ '--gap': '8px' }}>
          <Button variant="primary" icon={Save} loading={busy} disabled={!dirty && !!d.id} onClick={() => save()}>{d.id ? 'Guardar look' : 'Crear look'}</Button>
          {d.id && !isFeatured && looks.length > 1 && <Button icon={Star} onClick={feature}>Poner en la portada</Button>}
          <span class="grow" />
          {d.id && <Button variant="ghost" icon={Trash2} class="btn--danger" onClick={remove}>Eliminar</Button>}
        </div>
        {dirty && <p class="small muted">Tienes cambios sin guardar.</p>}
      </div>

      <ProductPicker open={!!picking} products={products} onPick={choose} onClose={() => setPicking(null)} />
    </div>
  );
}

/** Foto con puntos: tocar agrega, arrastrar mueve. Misma proporción (6:5) que en la tienda. */
function HotspotCanvas({ image, points, active, onSelect, onMove, onAdd }) {
  const box = useRef(null);
  const drag = useRef(null);
  const pos = (e) => {
    const r = box.current.getBoundingClientRect();
    return {
      x: round2(Math.min(97, Math.max(3, ((e.clientX - r.left) / r.width) * 100))),
      y: round2(Math.min(97, Math.max(3, ((e.clientY - r.top) / r.height) * 100))),
    };
  };
  const down = (e, i) => {
    e.stopPropagation();
    e.preventDefault();
    drag.current = { i, moved: false, x0: e.clientX, y0: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onSelect(i);
  };
  const moveP = (e) => {
    const g = drag.current;
    if (!g) return;
    if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 4) return;
    g.moved = true;
    const p = pos(e);
    onMove(g.i, p.x, p.y);
  };
  const up = () => { drag.current = null; };
  const nudge = (e, i, x, y) => {
    const step = e.shiftKey ? 5 : 1;
    const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!k) return;
    e.preventDefault();
    onMove(i, round2(Math.min(97, Math.max(3, x + k[0]))), round2(Math.min(97, Math.max(3, y + k[1]))));
  };
  return (
    <div
      class="hotspots"
      ref={box}
      onClick={(e) => { if (e.target === box.current || e.target.tagName === 'IMG') { const p = pos(e); onAdd(p.x, p.y); } }}
    >
      <img src={cdn(image, { w: 1400 })} alt="Foto del look" draggable={false} />
      {points.map((h, i) => (
        <button
          type="button"
          class={cx('hs', active === i && 'is-active', !h.p && 'is-missing')}
          style={{ left: `${h.x}%`, top: `${h.y}%` }}
          aria-label={`Punto ${i + 1}: ${h.p?.name || 'prenda no encontrada'}. Usa las flechas para moverlo.`}
          onPointerDown={(e) => down(e, i)}
          onPointerMove={moveP}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={(e) => nudge(e, i, h.x, h.y)}
          onFocus={() => onSelect(i)}
        >
          {i + 1}
          {active === i && h.p && <span class="hs__tip">{h.p.name}<small>{h.color}</small></span>}
        </button>
      ))}
    </div>
  );
}

function ProductPicker({ open, products, onPick, onClose }) {
  const [q, setQ] = useState('');
  useEffect(() => { if (open) setQ(''); }, [open]);
  const list = (products || []).filter((p) => p.status === 'activo' && matches(q, p.name, p.code, p.tags, p.colors.map((c) => c.name))).slice(0, 60);
  return (
    <Sheet open={open} onClose={onClose} title="Elige la prenda" sub="Solo aparecen productos activos">
      <div class="stack" style={{ '--gap': '12px' }}>
        <SearchField value={q} onValue={setQ} placeholder="Buscar por nombre, color o código" />
        <div class="pick-list" style={{ maxHeight: 'min(56vh, 520px)' }}>
          {list.map((p) => (
            <button type="button" class="pick-row" onClick={() => onPick(p)}>
              <Thumb src={p.colors[0]?.images?.[0]} size={36} />
              <span class="grow"><strong>{p.name}</strong><small>{p.colors.map((c) => c.name).join(' · ')}</small></span>
              <span class="num strong">{money(p.price)}</span>
            </button>
          ))}
          {!list.length && <p class="small muted" style={{ padding: '18px', textAlign: 'center' }}>No hay productos con esa búsqueda.</p>}
        </div>
      </div>
    </Sheet>
  );
}
