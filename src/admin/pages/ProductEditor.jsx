/**
 * Editor de producto: información, fotos por color, matriz de tallas con SKU y existencias,
 * precio con oferta y costo (ganancia), estado y organización. Guarda con ⌘/Ctrl + S.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  Plus, Trash2, Palette, Ruler, Tag, Eye, Save, Copy, ExternalLink, Info, Sparkles, Layers, WandSparkles, Archive, Shirt, ChevronDown,
} from 'lucide-preact';
import { api } from '../api/index.js';
import { useQuery, invalidate } from '../lib/query.js';
import { navigate, setLeaveGuard } from '../lib/router.js';
import { money, percent, number } from '../lib/format.js';
import { useStore } from '../lib/store.js';
import { settingsStore } from '../lib/session.js';
import {
  SIZE_PRESETS, COLOR_FAMILIES, guessFamily, makeSku, sizeRank, slugify, productStock, cdn, round2,
} from '../../backend/model.js';
import { PageHeader, Card, Badge, Empty, SkeletonRows, Menu } from '../ui/surfaces.jsx';
import { Button, IconButton, TextField, SelectField, Field, MoneyInput, Segmented, SwitchRow, TagInput, Stepper, cx } from '../ui/controls.jsx';
import { Gallery } from '../ui/media.jsx';
import { toast, toastError, confirmDialog, promptDialog } from '../ui/overlays.jsx';
import { duplicatePayload } from './Products.jsx';

let keySeq = 0;
const newKey = () => `k${Date.now().toString(36)}${(keySeq++).toString(36)}`;

function toDraft(p) {
  return {
    id: p.id, slug: p.slug, code: p.code, name: p.name, department: p.department, category: p.category || '',
    description: p.description || '', detailsText: (p.details || []).join('\n'), material: p.material || '', care: p.care || '',
    origin: p.origin || '', price: p.price, compareAtPrice: p.compareAtPrice ?? '', cost: p.cost ?? '', tags: p.tags || [],
    isNew: !!p.isNew, isBestseller: !!p.isBestseller, isFeatured: !!p.isFeatured, status: p.status,
    colors: p.colors.map((c) => ({ key: c.id, id: c.id, name: c.name, hex: c.hex, family: c.family, familyAuto: false, images: c.images || [] })),
    variants: p.variants.map((v) => ({ key: v.id, id: v.id, colorKey: v.colorId, size: v.size, sku: v.sku, stock: v.stock, minStock: v.minStock ?? '', active: v.active !== false })),
  };
}

const blank = (department = 'mujer') => ({
  name: '', slug: '', code: '', department, category: '', description: '', detailsText: '', material: '', care: '',
  origin: 'Importado de EE. UU.', price: '', compareAtPrice: '', cost: '', tags: [], isNew: true, isBestseller: false, isFeatured: false,
  status: 'borrador', colors: [], variants: [],
});

function toPayload(d) {
  return {
    id: d.id, slug: d.slug, code: d.code, name: d.name, department: d.department, category: d.category || null,
    description: d.description, details: d.detailsText.split('\n').map((x) => x.replace(/^[-–•·]\s*/, '').trim()).filter(Boolean),
    material: d.material, care: d.care, origin: d.origin, price: Number(d.price) || 0,
    compareAtPrice: d.compareAtPrice === '' ? null : Number(d.compareAtPrice) || null, cost: Number(d.cost) || 0, tags: d.tags,
    isNew: d.isNew, isBestseller: d.isBestseller, isFeatured: d.isFeatured, status: d.status,
    colors: d.colors.map(({ key, id, name, hex, family, images }) => ({ key, id, name, hex, family, images })),
    variants: d.variants.map(({ id, colorKey, size, sku, stock, minStock, active }) => ({ id, colorKey, size, sku, stock: Number(stock) || 0, minStock: minStock === '' ? null : Number(minStock), active })),
  };
}

const sizesOf = (d) => [...new Set(d.variants.map((v) => v.size))].sort((a, b) => sizeRank(a) - sizeRank(b));

export default function ProductEditor({ params, query }) {
  const isNew = !params.id;
  const { data: product, loading, error } = useQuery(`product:${params.id || 'nuevo'}`, () => (isNew ? null : api.catalog.product(params.id)), ['products'], { enabled: !isNew });
  const { data: tax } = useQuery('taxonomy', () => api.catalog.taxonomy(), ['taxonomy']);
  const settings = useStore(settingsStore);
  const [draft, setDraft] = useState(() => (isNew ? blank(query.depto) : null));
  const [base, setBase] = useState(() => (isNew ? JSON.stringify(blank(query.depto)) : null));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const formRef = useRef(null);

  useEffect(() => {
    if (product && !draft) {
      const d = toDraft(product);
      setDraft(d);
      setBase(JSON.stringify(d));
    }
  }, [product]);

  const dirty = draft && base !== JSON.stringify(draft);
  useEffect(() => setLeaveGuard((unload) => !dirty || (!unload && window.confirm('Tienes cambios sin guardar. ¿Salir sin guardar?'))), [dirty]);
  useEffect(() => () => setLeaveGuard(null), []);

  const set = (patch) => setDraft((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) }));

  // ⌘/Ctrl + S guarda
  useEffect(() => {
    const h = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      if (draft) save();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  });

  if (!isNew && error) return <main class="page"><Empty title="No se pudo cargar el producto">{error.message}</Empty></main>;
  if (!isNew && !loading && product === null) {
    return <main class="page"><Empty icon={Shirt} title="Este producto ya no existe" action={<Button variant="primary" onClick={() => navigate('/productos')}>Ver productos</Button>} /></main>;
  }
  if (!draft) return <main class="page"><div class="card"><SkeletonRows rows={8} /></div></main>;

  const deps = tax?.departments || [];
  const cats = (tax?.categories || []).filter((c) => c.department === draft.department);
  const sizes = sizesOf(draft);
  const codePreview = draft.code || product?.code || 'DV-XXX-000';
  const price = Number(draft.price) || 0;
  const compare = Number(draft.compareAtPrice) || 0;
  const cost = Number(draft.cost) || 0;
  const off = compare > price && price > 0 ? 1 - price / compare : 0;
  const margin = price > 0 && cost > 0 ? (price - cost) / price : null;
  const totalStock = draft.variants.reduce((a, v) => a + (v.active ? Number(v.stock) || 0 : 0), 0);
  const lowDefault = settings?.private?.inventory?.lowStock ?? 0;

  /* ---------- colores ---------- */
  const addColor = () => set((d) => {
    const key = newKey();
    const color = { key, name: '', hex: '#D9C6A6', family: 'beige', familyAuto: true, images: [] };
    const sz = sizesOf(d);
    return { colors: [...d.colors, color], variants: [...d.variants, ...sz.map((size) => ({ key: newKey(), colorKey: key, size, sku: '', stock: 0, minStock: '', active: true }))] };
  });
  const updateColor = (key, patch) => set((d) => ({
    colors: d.colors.map((c) => {
      if (c.key !== key) return c;
      const next = { ...c, ...patch };
      if ('hex' in patch && c.familyAuto) next.family = guessFamily(patch.hex);
      if ('family' in patch) next.familyAuto = false;
      return next;
    }),
  }));
  const removeColor = async (c) => {
    const stock = draft.variants.filter((v) => v.colorKey === c.key).reduce((a, v) => a + (Number(v.stock) || 0), 0);
    if (stock || c.images.length) {
      const ok = await confirmDialog({ title: `¿Quitar el color ${c.name || 'sin nombre'}?`, message: stock ? `Tiene ${stock} pieza${stock === 1 ? '' : 's'} en existencia que se darán de baja al guardar.` : 'Se quitan también sus fotos.', confirm: 'Quitar', danger: true });
      if (!ok) return;
    }
    set((d) => ({ colors: d.colors.filter((x) => x.key !== c.key), variants: d.variants.filter((v) => v.colorKey !== c.key) }));
  };
  const moveColor = (i, to) => set((d) => {
    const colors = [...d.colors];
    const [x] = colors.splice(i, 1);
    colors.splice(to, 0, x);
    return { colors };
  });

  /* ---------- tallas ---------- */
  const addSizes = (list) => set((d) => {
    const have = new Set(sizesOf(d).map((s) => s.toLowerCase()));
    const fresh = list.map((s) => String(s).trim()).filter((s) => s && !have.has(s.toLowerCase()));
    return { variants: [...d.variants, ...fresh.flatMap((size) => d.colors.map((c) => ({ key: newKey(), colorKey: c.key, size, sku: '', stock: 0, minStock: '', active: true })))] };
  });
  const removeSize = async (size) => {
    const stock = draft.variants.filter((v) => v.size === size).reduce((a, v) => a + (Number(v.stock) || 0), 0);
    if (stock && !(await confirmDialog({ title: `¿Quitar la talla ${size}?`, message: `Tiene ${stock} pieza${stock === 1 ? '' : 's'} en existencia que se darán de baja al guardar.`, confirm: 'Quitar', danger: true }))) return;
    set((d) => ({ variants: d.variants.filter((v) => v.size !== size) }));
  };
  const customSize = async () => {
    const s = await promptDialog({ title: 'Agregar talla', message: 'Por ejemplo: XXL, 28, 6X o Única.', placeholder: 'Talla', confirm: 'Agregar', required: true });
    if (s) addSizes(s.split(/[,\s]+/).filter(Boolean));
  };
  const updateVariant = (key, patch) => set((d) => ({ variants: d.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) }));
  const missing = draft.colors.flatMap((c) => sizes.filter((s) => !draft.variants.some((v) => v.colorKey === c.key && v.size === s)).map((s) => ({ c, s })));
  const restoreMissing = () => set((d) => ({ variants: [...d.variants, ...missing.map(({ c, s }) => ({ key: newKey(), colorKey: c.key, size: s, sku: '', stock: 0, minStock: '', active: true }))] }));
  const fillStock = async () => {
    const n = await promptDialog({ title: 'Misma cantidad para todas', message: 'Escribe las piezas que hay de cada combinación de color y talla.', placeholder: '0', confirm: 'Aplicar', required: true });
    const value = Math.max(0, parseInt(n, 10));
    if (!Number.isNaN(value)) set((d) => ({ variants: d.variants.map((v) => ({ ...v, stock: value })) }));
  };

  /* ---------- guardar ---------- */
  const validate = () => {
    const e = {};
    if (!draft.name.trim()) e.name = 'Escribe el nombre del producto.';
    if (draft.price === '' || !(Number(draft.price) >= 0)) e.price = 'Escribe el precio.';
    if (compare && compare <= price) e.compareAtPrice = 'Debe ser mayor que el precio actual.';
    draft.colors.forEach((c) => { if (!c.name.trim()) e[`color-${c.key}`] = 'Ponle nombre al color.'; });
    if (draft.status === 'activo' && (!draft.colors.length || !draft.variants.length)) e.variants = 'Para publicarlo agrega al menos un color y una talla.';
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('.is-invalid, .field__error')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      return false;
    }
    return true;
  };

  async function save(nextStatus) {
    if (saving) return;
    const d = nextStatus ? { ...draft, status: nextStatus } : draft;
    if (nextStatus) setDraft(d);
    if (!validate()) { toast({ tone: 'error', title: 'Revisa los campos marcados' }); return; }
    setSaving(true);
    try {
      const saved = await api.catalog.save(toPayload(d));
      const fresh = toDraft(saved);
      setDraft(fresh);
      setBase(JSON.stringify(fresh));
      invalidate('products', 'inventory');
      toast({ title: isNew ? 'Producto creado' : 'Cambios guardados', sub: saved.status === 'activo' ? 'Ya se ve en la tienda.' : saved.status === 'borrador' ? 'Guardado como borrador (no se ve en la tienda).' : 'Archivado.' });
      if (isNew) {
        setLeaveGuard(null);
        navigate(`/productos/${saved.id}`, { replace: true });
      }
    } catch (err) {
      toastError(err, 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  const discard = async () => {
    if (!(await confirmDialog({ title: '¿Descartar los cambios?', message: 'Se perderán los cambios que no has guardado.', confirm: 'Descartar', danger: true }))) return;
    const d = isNew ? blank(query.depto) : toDraft(product);
    setDraft(d);
    setBase(JSON.stringify(d));
    setErrors({});
  };

  const duplicate = async () => {
    if (dirty) { toast({ tone: 'info', title: 'Primero guarda los cambios' }); return; }
    try {
      const copy = await api.catalog.save(duplicatePayload(product));
      invalidate('products');
      toast({ title: 'Producto duplicado', sub: 'Estás editando la copia.' });
      navigate(`/productos/${copy.id}`);
    } catch (err) { toastError(err); }
  };
  const remove = async () => {
    const ok = await confirmDialog({ title: `¿Eliminar «${draft.name}»?`, message: 'Se borra del catálogo y de la tienda. Los pedidos anteriores conservan sus datos.', confirm: 'Eliminar', danger: true });
    if (!ok) return;
    try {
      await api.catalog.remove(draft.id);
      setLeaveGuard(null);
      invalidate('products', 'inventory');
      toast({ title: 'Producto eliminado' });
      navigate('/productos', { replace: true });
    } catch (err) { toastError(err); }
  };

  const mainImage = draft.colors[0]?.images?.[0];
  const statusOpts = [
    { value: 'activo', label: 'Publicado' },
    { value: 'borrador', label: 'Borrador' },
    { value: 'archivado', label: 'Archivado' },
  ];

  return (
    <main class="page page--wide editor" ref={formRef}>
      <PageHeader
        back={{ to: '/productos', label: 'Productos' }}
        title={draft.name || (isNew ? 'Nuevo producto' : 'Sin nombre')}
        sub={isNew ? 'Completa la información, sube las fotos de cada color y define tallas y existencias.' : `${draft.code || ''} · ${number(totalStock)} piezas en existencia`}
        actions={!isNew && (
          <>
            {draft.status === 'activo' && <Button icon={ExternalLink} onClick={() => window.open(`tienda.html?p=${encodeURIComponent(draft.slug)}`, '_blank', 'noopener')}>Ver en la tienda</Button>}
            <Menu items={[
              { label: 'Duplicar producto', icon: Copy, onClick: duplicate },
              draft.status !== 'archivado' && { label: 'Archivar', icon: Archive, onClick: () => save('archivado') },
              '-',
              { label: 'Eliminar producto', icon: Trash2, danger: true, onClick: remove },
            ]} />
          </>
        )}
      />

      <div class="editor__grid">
        <div class="stack editor__main">
          <Card title="Información" icon={Info}>
            <div class="stack">
              <TextField label="Nombre" value={draft.name} onValue={(v) => set({ name: v })} error={errors.name} placeholder="Ej. Vestido slip satinado" maxLength={140} data-autofocus />
              <TextField label="Descripción" multiline rows={4} value={draft.description} onValue={(v) => set({ description: v })} placeholder="Cuéntale a tu clienta cómo es la prenda y para qué ocasión es ideal." hint="Aparece en la vista del producto, debajo del precio." />
              <TextField label="Detalles" multiline rows={4} value={draft.detailsText} onValue={(v) => set({ detailsText: v })} placeholder={'Uno por renglón, por ejemplo:\nTirantes ajustables\nLargo midi'} optional />
              <div class="grid" style={{ '--cols': 3 }}>
                <TextField label="Material" value={draft.material} onValue={(v) => set({ material: v })} placeholder="Satín de poliéster" optional />
                <TextField label="Cuidados" value={draft.care} onValue={(v) => set({ care: v })} placeholder="Lavar a mano en agua fría" optional />
                <TextField label="Origen" value={draft.origin} onValue={(v) => set({ origin: v })} placeholder="Importado de EE. UU." optional />
              </div>
            </div>
          </Card>

          <Card
            title="Colores y fotos"
            icon={Palette}
            sub="La primera foto de cada color es la principal; la segunda aparece al pasar el cursor."
            actions={<Button size="sm" variant="tinted" icon={Plus} onClick={addColor}>Agregar color</Button>}
          >
            {!draft.colors.length ? (
              <Empty icon={Palette} title="Agrega el primer color" action={<Button variant="primary" icon={Plus} onClick={addColor}>Agregar color</Button>}>
                Cada color tiene sus propias fotos y sus propias existencias por talla.
              </Empty>
            ) : (
              <div class="stack" style={{ '--gap': '18px' }}>
                {draft.colors.map((c, i) => (
                  <div class="color-block">
                    <div class="color-block__head">
                      <label class="color-dot" title="Elegir color">
                        <span class="swatch" style={{ '--c': c.hex, '--s': '34px' }} />
                        <input type="color" value={c.hex} onInput={(e) => updateColor(c.key, { hex: e.currentTarget.value.toUpperCase() })} aria-label={`Tono del color ${c.name}`} />
                      </label>
                      <div class={cx('field grow', errors[`color-${c.key}`] && 'is-invalid')}>
                        <input class="input" value={c.name} placeholder="Nombre del color (Ej. Champagne)" onInput={(e) => updateColor(c.key, { name: e.currentTarget.value })} aria-label="Nombre del color" maxLength={60} />
                        {errors[`color-${c.key}`] && <p class="field__error">{errors[`color-${c.key}`]}</p>}
                      </div>
                      <select class="input color-block__family" value={c.family} onChange={(e) => updateColor(c.key, { family: e.currentTarget.value })} aria-label="Familia de color para el filtro de la tienda" title="Familia de color (filtro de la tienda)">
                        {COLOR_FAMILIES.map((f) => <option value={f.id}>{f.name}</option>)}
                      </select>
                      <Menu items={[
                        i > 0 && { label: 'Mover arriba', onClick: () => moveColor(i, i - 1) },
                        i < draft.colors.length - 1 && { label: 'Mover abajo', onClick: () => moveColor(i, i + 1) },
                        '-',
                        { label: 'Quitar color', icon: Trash2, danger: true, onClick: () => removeColor(c) },
                      ]} />
                    </div>
                    <Gallery images={c.images} onChange={(images) => updateColor(c.key, { images })} folder="divani/productos" />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Tallas, SKU y existencias"
            icon={Ruler}
            sub="Cada combinación de color y talla tiene su propio SKU y sus piezas en existencia."
            actions={draft.colors.length > 0 && sizes.length > 0 && <Button size="sm" variant="ghost" icon={Layers} onClick={fillStock}>Misma cantidad</Button>}
          >
            <div class="stack">
              <div class="size-bar">
                <div class="chips">
                  {sizes.map((s) => (
                    <span class="chip chip--sm size-chip">{s}<button type="button" class="chip__x" aria-label={`Quitar talla ${s}`} onClick={() => removeSize(s)}>×</button></span>
                  ))}
                  <button type="button" class="chip chip--sm" onClick={customSize}><Plus aria-hidden="true" />Talla</button>
                </div>
                <Menu
                  items={[{ heading: 'Agregar un juego de tallas' }, ...SIZE_PRESETS.map((p) => ({ label: p.name, hint: p.sizes.length > 4 ? `${p.sizes[0]}–${p.sizes.at(-1)}` : p.sizes.join(' '), onClick: () => addSizes(p.sizes) }))]}
                  trigger={({ toggle, open }) => <Button size="sm" variant="secondary" icon={WandSparkles} iconEnd={ChevronDown} aria-expanded={String(open)} onClick={toggle}>Juegos de tallas</Button>}
                />
              </div>
              {errors.variants && <p class="field__error">{errors.variants}</p>}
              {!draft.colors.length ? (
                <p class="muted small">Primero agrega un color; luego elige sus tallas.</p>
              ) : !sizes.length ? (
                <p class="muted small">Elige un juego de tallas o agrega las tallas una por una.</p>
              ) : (
                <div class="variant-groups">
                  {draft.colors.map((c) => {
                    const vs = draft.variants.filter((v) => v.colorKey === c.key).sort((a, b) => sizeRank(a.size) - sizeRank(b.size));
                    const sum = vs.reduce((a, v) => a + (Number(v.stock) || 0), 0);
                    return (
                      <div class="variant-group">
                        <div class="variant-group__head">
                          <span class="swatch" style={{ '--c': c.hex }} />
                          <strong>{c.name || 'Color sin nombre'}</strong>
                          <span class="muted small">{number(sum)} pzs</span>
                        </div>
                        <div class="variant-table" role="table" aria-label={`Variantes de ${c.name}`}>
                          <div class="variant-row variant-row--head" role="row">
                            <span role="columnheader">Talla</span>
                            <span role="columnheader">SKU</span>
                            <span role="columnheader">Existencias</span>
                            <span role="columnheader" title="Te avisamos cuando queden estas piezas o menos">Mínimo</span>
                            <span role="columnheader" class="visually-hidden">Quitar</span>
                          </div>
                          {vs.map((v) => (
                            <div class={cx('variant-row', !v.active && 'is-off')} role="row">
                              <span class="variant-row__size" role="cell">{v.size}</span>
                              <span role="cell"><input class="input input--sm mono" value={v.sku} placeholder={makeSku(codePreview, c.name || 'Color', v.size)} onInput={(e) => updateVariant(v.key, { sku: e.currentTarget.value.toUpperCase() })} aria-label={`SKU talla ${v.size}`} /></span>
                              <span role="cell"><Stepper size="sm" value={Number(v.stock) || 0} onChange={(n) => updateVariant(v.key, { stock: n })} label={`Existencias talla ${v.size}`} /></span>
                              <span role="cell"><input class="input input--sm input--center" inputMode="numeric" value={v.minStock} placeholder={String(lowDefault)} onInput={(e) => updateVariant(v.key, { minStock: e.currentTarget.value.replace(/\D/g, '') })} aria-label={`Mínimo talla ${v.size}`} /></span>
                              <span role="cell"><IconButton size="sm" danger icon={Trash2} label={`Quitar ${c.name} talla ${v.size}`} onClick={() => set((d) => ({ variants: d.variants.filter((x) => x.key !== v.key) }))} /></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {missing.length > 0 && (
                    <button type="button" class="link-btn small" onClick={restoreMissing}><Plus aria-hidden="true" />Agregar las {missing.length} combinaciones que faltan</button>
                  )}
                </div>
              )}
              <p class="field__hint">Deja el SKU vacío y se genera solo (código + color + talla). «Mínimo»: te avisamos cuando esa talla llegue a ese número de piezas (vacío = cuando se agote).</p>
            </div>
          </Card>
        </div>

        <aside class="stack editor__side">
          <Card title="Estado" icon={Eye}>
            <div class="stack" style={{ '--gap': '12px' }}>
              <Segmented block value={draft.status} onChange={(v) => set({ status: v })} options={statusOpts} label="Estado" />
              <p class="small muted">
                {draft.status === 'activo' ? 'Se muestra en la tienda y se puede pedir.' : draft.status === 'borrador' ? 'No se ve en la tienda; termina de prepararlo con calma.' : 'Oculto y fuera de los listados. Su historial se conserva.'}
              </p>
            </div>
            <div class="list editor__flags">
              <SwitchRow icon={Sparkles} title="Nuevo" sub="Etiqueta «Nuevo» y sección de novedades" checked={draft.isNew} onChange={(v) => set({ isNew: v })} />
              <SwitchRow icon={Tag} title="Lo más deseado" sub="Aparece en «Las favoritas»" checked={draft.isBestseller} onChange={(v) => set({ isBestseller: v })} />
              <SwitchRow icon={Eye} title="Destacado" sub="Sale primero en la tienda" checked={draft.isFeatured} onChange={(v) => set({ isFeatured: v })} />
            </div>
          </Card>

          <Card title="Precio" icon={Tag}>
            <div class="stack">
              <Field label="Precio de venta" error={errors.price}>
                <MoneyInput value={draft.price} onValue={(v) => set({ price: v })} />
              </Field>
              <Field label="Precio antes" optional error={errors.compareAtPrice} hint={off ? null : 'Si es mayor al precio, se muestra tachado como oferta.'}>
                <MoneyInput value={draft.compareAtPrice} onValue={(v) => set({ compareAtPrice: v })} />
              </Field>
              {off > 0 && <p class="small"><Badge tone="red">−{Math.round(off * 100)} %</Badge> <span class="muted">se mostrará como oferta</span></p>}
              <Field label="Costo por pieza" optional hint="Solo lo ves tú. Sirve para calcular tu ganancia en los reportes.">
                <MoneyInput value={draft.cost} onValue={(v) => set({ cost: v })} />
              </Field>
              {margin !== null && (
                <div class={cx('margin-box', margin < 0.2 && 'is-low')}>
                  <span>Ganancia por pieza</span>
                  <strong>{money(round2(price - cost))}</strong>
                  <span class="muted">{percent(margin, 0)} de margen</span>
                </div>
              )}
            </div>
          </Card>

          <Card title="Organización" icon={Layers}>
            <div class="stack">
              <SelectField label="Departamento" value={draft.department} onValue={(v) => set({ department: v, category: '' })} options={deps.map((d) => ({ value: d.slug, label: d.name }))} />
              <SelectField label="Categoría" value={draft.category} onValue={(v) => set({ category: v })} placeholder="Sin categoría" options={cats.map((c) => ({ value: c.slug, label: c.name }))} />
              <Field label="Etiquetas" optional hint="Ayudan a la búsqueda de la tienda (satín, fiesta, básico…).">
                <TagInput value={draft.tags} onChange={(tags) => set({ tags })} />
              </Field>
              <details class="advanced">
                <summary>Código y dirección web</summary>
                <div class="stack" style={{ marginTop: '12px' }}>
                  <TextField label="Código del producto" value={draft.code} onValue={(v) => set({ code: v.toUpperCase() })} placeholder="Se genera solo (DV-MUJ-028)" hint="Es la base de los SKU." />
                  <TextField label="Dirección en la tienda" value={draft.slug} onValue={(v) => set({ slug: slugify(v) })} placeholder={slugify(draft.name) || 'se-genera-sola'} hint={`tienda.html?p=${draft.slug || slugify(draft.name) || '…'}`} />
                </div>
              </details>
            </div>
          </Card>

          <Card title="Así se verá" icon={Eye}>
            <div class="preview-card">
              <div class="preview-card__media">
                {mainImage ? <img src={cdn(mainImage, { w: 600 })} alt="" /> : <span class="preview-card__ph"><Shirt aria-hidden="true" /></span>}
                <div class="preview-card__badges">
                  {off > 0 && <span class="pbadge pbadge--sale">−{Math.round(off * 100)}%</span>}
                  {draft.isNew && <span class="pbadge">Nuevo</span>}
                </div>
              </div>
              <p class="preview-card__name">{draft.name || 'Nombre del producto'}</p>
              <p class="preview-card__price">{money(price)}{off > 0 && <s>{money(compare)}</s>}</p>
              {draft.colors.length > 0 && (
                <div class="row" style={{ '--gap': '5px' }}>
                  {draft.colors.map((c) => <span class="swatch" style={{ '--c': c.hex, '--s': '14px' }} />)}
                  <span class="xsmall muted">{draft.colors.length === 1 ? draft.colors[0].name : `${draft.colors.length} colores`}</span>
                </div>
              )}
            </div>
          </Card>
        </aside>
      </div>

      <div class={cx('savebar glass', dirty && 'is-dirty')} role="region" aria-label="Guardar cambios">
        <span class="savebar__text">{dirty ? 'Tienes cambios sin guardar' : isNew ? 'Producto nuevo' : 'Todo guardado'}</span>
        {dirty && !isNew && <Button variant="ghost" onClick={discard}>Descartar</Button>}
        <Button variant="primary" icon={Save} loading={saving} onClick={() => save()} disabled={!dirty && !isNew}>
          {isNew ? 'Crear producto' : 'Guardar'}
        </Button>
      </div>
    </main>
  );
}
