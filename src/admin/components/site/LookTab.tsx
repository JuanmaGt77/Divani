/**
 * «Arma tu look»: una foto con puntos que llevan a cada prenda.
 * Toca la foto para poner un punto, elige la prenda y arrástralo a su lugar.
 */
import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { ImagePlus, MousePointerClick, Plus, Save, Shirt, Star, Trash2 } from 'lucide-react';
import { money } from '@/lib/format';
import { cdn, round2 } from '@/lib/model';
import type { Hotspot, Lookbook, Product } from '@/lib/types';
import { api } from '../../api';
import { useUnsavedChanges } from '../../lib/navigation';
import { invalidate } from '../../lib/query';
import { Button, Chip, SwitchRow, TextField, cx } from '../../ui/controls';
import { MediaField } from '../../ui/media';
import { confirmDialog, toast, toastError } from '../../ui/overlays';
import { Card, Empty, Menu, SkeletonRows, Thumb } from '../../ui/surfaces';
import { EMPH, ProductPicker } from './shared';

const NEW_LOOK: Lookbook = { eyebrow: 'Arma tu look', title: '', text: '', image: '', hotspots: [], active: true };
const editable = (l: Lookbook) =>
  JSON.stringify([l.eyebrow || '', l.title || '', l.text || '', l.image || '', l.hotspots || [], l.active !== false]);
const MAX_POINTS = 8;

export function LookTab({
  data,
  products,
  loading,
  onSaved,
}: {
  data: { lookbooks: Lookbook[] } | undefined;
  products: Product[] | undefined;
  loading: boolean;
  onSaved?: () => void;
}) {
  const looks = data?.lookbooks || [];
  const [sel, setSel] = useState<string | null>(null);
  const found = sel && sel !== 'new' ? looks.find((l) => l.id === sel) : null;
  const isNew = sel === 'new' || (!!sel && !found); // recién creado: sigue en el mismo editor hasta que llegue en la lista
  const current = isNew ? null : found || looks[0] || null;
  const featured = looks.find((l) => l.active !== false);

  if (loading) {
    return (
      <Card bodyClass={false}>
        <SkeletonRows rows={4} />
      </Card>
    );
  }

  return (
    <>
      <div className="tab-intro">
        <p className="muted">
          La portada muestra el primer look activo. Toca la foto para marcar cada prenda: tus clientas las ven y piden
          el look completo por WhatsApp.
        </p>
        <div className="row row--wrap" style={{ '--gap': '8px' }}>
          {looks.length > 1 &&
            looks.map((l) => (
              <Chip
                key={l.id}
                pressed={!isNew && current?.id === l.id}
                onClick={() => setSel(l.id || null)}
                icon={featured?.id === l.id ? Star : undefined}
              >
                {l.title.replace(/\*/g, '') || 'Sin título'}
              </Chip>
            ))}
          <Button icon={Plus} onClick={() => setSel('new')}>
            Nuevo look
          </Button>
        </div>
      </div>
      {!isNew && !current ? (
        <Card>
          <Empty
            icon={Shirt}
            title="Aún no tienes looks"
            action={
              <Button variant="primary" icon={Plus} onClick={() => setSel('new')}>
                Crear un look
              </Button>
            }
          >
            Sube una foto de un outfit completo y marca cada prenda.
          </Empty>
        </Card>
      ) : (
        <LookEditor
          key={isNew ? 'new' : current?.id}
          look={isNew || !current ? NEW_LOOK : current}
          isFeatured={!isNew && featured?.id === current?.id}
          looks={looks}
          products={products}
          onSaved={(id) => {
            if (id) setSel(id);
            onSaved?.();
          }}
          onDeleted={() => {
            setSel(null);
            onSaved?.();
          }}
        />
      )}
    </>
  );
}

interface Piece extends Hotspot {
  p: Product | undefined;
}

type Picking = { x: number; y: number } | { index: number } | null;

function LookEditor({
  look,
  isFeatured,
  looks,
  products,
  onSaved,
  onDeleted,
}: {
  look: Lookbook;
  isFeatured: boolean;
  looks: Lookbook[];
  products: Product[] | undefined;
  onSaved?: (id: string | undefined) => void;
  onDeleted?: () => void;
}) {
  const [d, setD] = useState<Lookbook>(() => structuredClone(look));
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<number | null>(null); // índice del punto seleccionado
  const [picking, setPicking] = useState<Picking>(null); // { x, y } o { index } para cambiar la prenda
  const dirty = editable(d) !== editable(look);
  const set = (p: Partial<Lookbook>) => setD((x) => ({ ...x, ...p }));
  const bySlug = useMemo(() => Object.fromEntries((products || []).map((p) => [p.slug, p])), [products]);

  useUnsavedChanges(dirty, 'Tienes cambios sin guardar en el look. ¿Salir sin guardar?');

  const setPoint = (i: number, patch: Partial<Hotspot>) =>
    set({ hotspots: d.hotspots.map((h, k) => (k === i ? { ...h, ...patch } : h)) });
  const removePoint = (i: number) => {
    set({ hotspots: d.hotspots.filter((_, k) => k !== i) });
    setActive(null);
  };

  const choose = (p: Product) => {
    const color = p.colors?.[0]?.name || '';
    if (picking && 'index' in picking) {
      setPoint(picking.index, { product: p.slug, color });
      setActive(picking.index);
    } else if (picking) {
      set({ hotspots: [...d.hotspots, { product: p.slug, color, x: picking.x, y: picking.y }] });
      setActive(d.hotspots.length);
    }
    setPicking(null);
  };

  const save = async () => {
    setBusy(true);
    try {
      const saved = await api.content.saveLookbook(d);
      invalidate('content');
      toast({
        title: d.id ? 'Look actualizado' : 'Look creado',
        sub: d.active === false ? 'Quedó guardado sin publicar.' : 'Ya se ve en la tienda.',
      });
      const id = d.id || saved?.id;
      setD(structuredClone({ ...d, ...(id ? { id } : {}) }));
      onSaved?.(id);
    } catch (err) {
      toastError(err, 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  const feature = async () => {
    if (!d.id) return;
    const id = d.id;
    try {
      await api.content.saveLookbook({ ...d, active: true });
      await api.content.reorderLookbooks([id, ...looks.map((l) => l.id || '').filter((x) => x && x !== id)]);
      set({ active: true });
      invalidate('content');
      onSaved?.(id);
      toast({ title: 'Este look ya está en la portada' });
    } catch (err) {
      toastError(err);
    }
  };

  const remove = async () => {
    if (!d.id) return;
    const ok = await confirmDialog({
      title: '¿Eliminar este look?',
      message: 'Se quita de la tienda. Las prendas no se borran.',
      confirm: 'Eliminar',
      danger: true,
    });
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

  const pieces: Piece[] = d.hotspots.map((h) => ({ ...h, p: bySlug[h.product] }));
  const total = pieces.reduce((a, x) => a + (x.p?.price || 0), 0);

  return (
    <div className="look-editor">
      <Card className="look-editor__media" bodyClass={false}>
        {d.image ? (
          <HotspotCanvas
            image={d.image}
            points={pieces}
            active={active}
            onSelect={setActive}
            onMove={(i, x, y) => setPoint(i, { x, y })}
            onAdd={(x, y) =>
              d.hotspots.length >= MAX_POINTS
                ? toastError(new Error(`Máximo ${MAX_POINTS} prendas por look.`), 'Ya no caben más')
                : setPicking({ x, y })
            }
          />
        ) : (
          <div style={{ padding: '18px' }}>
            <MediaField
              label="Foto del look"
              value={d.image}
              onChange={(v) => set({ image: v })}
              aspect="6 / 5"
              folder="divani/looks"
              hint="Horizontal 6:5, 1800 × 1500 px. Que se vea el outfit completo."
            />
          </div>
        )}
        {d.image && (
          <div className="look-editor__hint">
            <MousePointerClick aria-hidden="true" />
            <span className="grow">Toca la foto para marcar una prenda. Arrastra los puntos para acomodarlos.</span>
            <Button size="sm" variant="ghost" icon={ImagePlus} onClick={() => set({ image: '' })}>
              Cambiar foto
            </Button>
          </div>
        )}
      </Card>

      <div className="stack look-editor__side">
        <Card title="Textos">
          <div className="stack">
            <TextField label="Texto pequeño" value={d.eyebrow} onValue={(v) => set({ eyebrow: v })} maxLength={60} />
            <TextField
              label="Título"
              value={d.title}
              onValue={(v) => set({ title: v })}
              placeholder="Sastrería *suave*"
              hint={EMPH}
              maxLength={120}
            />
            <TextField
              label="Descripción"
              multiline
              rows={3}
              value={d.text}
              onValue={(v) => set({ text: v })}
              maxLength={400}
            />
          </div>
        </Card>

        <Card
          title="Prendas del look"
          sub={
            pieces.length
              ? `${pieces.length} de ${MAX_POINTS} · Look completo ${money(total)}`
              : 'Toca la foto para agregar la primera'
          }
          bodyClass={false}
        >
          {pieces.length > 0 && (
            <div className="list">
              {pieces.map((x, i) => (
                <div
                  key={`${x.product}-${i}`}
                  className={cx('list__row look-piece', active === i && 'is-active')}
                  onMouseEnter={() => setActive(i)}
                  style={{ '--inset': '64px' }}
                >
                  <span className="look-piece__num">{i + 1}</span>
                  <Thumb
                    src={x.p?.colors?.find((c) => c.name === x.color)?.images?.[0] || x.p?.colors?.[0]?.images?.[0]}
                    size={36}
                  />
                  <span className="list__body">
                    <span className="list__title">{x.p?.name || 'Prenda no encontrada'}</span>
                    {x.p ? (
                      <select
                        className="input input--sm look-piece__color"
                        value={x.color}
                        onChange={(e) => setPoint(i, { color: e.currentTarget.value })}
                        aria-label="Color"
                      >
                        {x.p.colors.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="list__sub">Elige otra prenda</span>
                    )}
                  </span>
                  <Menu
                    items={[
                      { label: 'Cambiar prenda', icon: Shirt, onClick: () => setPicking({ index: i }) },
                      { label: 'Quitar del look', icon: Trash2, danger: true, onClick: () => removePoint(i) },
                    ]}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="list card">
          <SwitchRow
            title="Mostrar en la tienda"
            sub={isFeatured ? 'Es el look que aparece en la portada' : 'Guárdalo apagado para prepararlo con calma'}
            checked={d.active !== false}
            onChange={(v) => set({ active: v })}
          />
        </div>

        <div className="row row--wrap" style={{ '--gap': '8px' }}>
          <Button variant="primary" icon={Save} loading={busy} disabled={!dirty && !!d.id} onClick={() => void save()}>
            {d.id ? 'Guardar look' : 'Crear look'}
          </Button>
          {d.id && !isFeatured && looks.length > 1 && (
            <Button icon={Star} onClick={() => void feature()}>
              Poner en la portada
            </Button>
          )}
          <span className="grow" />
          {d.id && (
            <Button variant="ghost" icon={Trash2} className="btn--danger" onClick={() => void remove()}>
              Eliminar
            </Button>
          )}
        </div>
        {dirty && <p className="small muted">Tienes cambios sin guardar.</p>}
      </div>

      <ProductPicker open={!!picking} products={products} onPick={choose} onClose={() => setPicking(null)} />
    </div>
  );
}

/** Foto con puntos: tocar agrega, arrastrar mueve. Misma proporción (6:5) que en la tienda. */
function HotspotCanvas({
  image,
  points,
  active,
  onSelect,
  onMove,
  onAdd,
}: {
  image: string;
  points: Piece[];
  active: number | null;
  onSelect: (i: number) => void;
  onMove: (i: number, x: number, y: number) => void;
  onAdd: (x: number, y: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ i: number; moved: boolean; x0: number; y0: number } | null>(null);
  const pos = (e: { clientX: number; clientY: number }) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return { x: 50, y: 50 };
    return {
      x: round2(Math.min(97, Math.max(3, ((e.clientX - r.left) / r.width) * 100))),
      y: round2(Math.min(97, Math.max(3, ((e.clientY - r.top) / r.height) * 100))),
    };
  };
  const down = (e: PointerEvent<HTMLButtonElement>, i: number) => {
    e.stopPropagation();
    e.preventDefault();
    drag.current = { i, moved: false, x0: e.clientX, y0: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onSelect(i);
  };
  const moveP = (e: PointerEvent<HTMLButtonElement>) => {
    const g = drag.current;
    if (!g) return;
    if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 4) return;
    g.moved = true;
    const p = pos(e);
    onMove(g.i, p.x, p.y);
  };
  const up = () => {
    drag.current = null;
  };
  const nudge = (e: KeyboardEvent<HTMLButtonElement>, i: number, x: number, y: number) => {
    const step = e.shiftKey ? 5 : 1;
    const k = (
      { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<
        string,
        [number, number]
      >
    )[e.key];
    if (!k) return;
    e.preventDefault();
    onMove(i, round2(Math.min(97, Math.max(3, x + k[0]))), round2(Math.min(97, Math.max(3, y + k[1]))));
  };
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t === box.current || t.tagName === 'IMG') {
      const p = pos(e);
      onAdd(p.x, p.y);
    }
  };
  return (
    <div className="hotspots" ref={box} onClick={onClick}>
      <img src={cdn(image, { w: 1400 })} alt="Foto del look" draggable={false} />
      {points.map((h, i) => (
        <button
          key={i}
          type="button"
          className={cx('hs', active === i && 'is-active', !h.p && 'is-missing')}
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
          {active === i && h.p && (
            <span className="hs__tip">
              {h.p.name}
              <small>{h.color}</small>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
