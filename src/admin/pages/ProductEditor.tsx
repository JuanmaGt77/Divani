/**
 * Editor de producto: información, fotos por color, matriz de tallas con SKU y existencias,
 * precio con oferta y costo (ganancia), estado y organización. Guarda con ⌘/Ctrl + S.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useStore } from '@nanostores/react';
import {
  Archive,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  Info,
  Layers,
  Palette,
  Plus,
  Ruler,
  Save,
  Shirt,
  Sparkles,
  Tag,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import { money, number, percent } from '@/lib/format';
import { COLOR_FAMILIES, SIZE_PRESETS, cdn, guessFamily, makeSku, round2, sizeRank, slugify } from '@/lib/model';
import type { Product, ProductStatus } from '@/lib/types';
import { api, type ProductPayload } from '../api';
import { navigate, useSearch, useUnsavedChanges } from '../lib/navigation';
import { invalidate, useData } from '../lib/query';
import { settingsStore } from '../lib/session';
import {
  Button,
  Field,
  IconButton,
  MoneyInput,
  Segmented,
  SelectField,
  Stepper,
  SwitchRow,
  TagInput,
  TextField,
  cx,
  type MoneyValue,
} from '../ui/controls';
import { Gallery } from '../ui/media';
import { confirmDialog, promptDialog, toast, toastError } from '../ui/overlays';
import { Badge, Card, Empty, Menu, PageHeader, SkeletonRows } from '../ui/surfaces';
import { duplicatePayload } from './Products';

interface DraftColor {
  key: string;
  id?: string;
  name: string;
  hex: string;
  family: string;
  familyAuto: boolean;
  images: string[];
}

interface DraftVariant {
  key: string;
  id?: string;
  colorKey: string;
  size: string;
  sku: string;
  stock: number;
  minStock: string;
  active: boolean;
}

interface Draft {
  id?: string;
  slug: string;
  code: string;
  name: string;
  department: string;
  category: string;
  description: string;
  detailsText: string;
  material: string;
  care: string;
  origin: string;
  price: MoneyValue;
  compareAtPrice: MoneyValue;
  cost: MoneyValue;
  tags: string[];
  isNew: boolean;
  isBestseller: boolean;
  isFeatured: boolean;
  status: ProductStatus;
  colors: DraftColor[];
  variants: DraftVariant[];
}

let keySeq = 0;
const newKey = () => `k${Date.now().toString(36)}${(keySeq++).toString(36)}`;

function toDraft(p: Product): Draft {
  return {
    id: p.id,
    slug: p.slug,
    code: p.code,
    name: p.name,
    department: p.department,
    category: p.category || '',
    description: p.description || '',
    detailsText: (p.details || []).join('\n'),
    material: p.material || '',
    care: p.care || '',
    origin: p.origin || '',
    price: p.price,
    compareAtPrice: p.compareAtPrice ?? '',
    cost: p.cost ?? '',
    tags: p.tags || [],
    isNew: !!p.isNew,
    isBestseller: !!p.isBestseller,
    isFeatured: !!p.isFeatured,
    status: p.status,
    colors: p.colors.map((c) => ({
      key: c.id,
      id: c.id,
      name: c.name,
      hex: c.hex,
      family: c.family,
      familyAuto: false,
      images: c.images || [],
    })),
    variants: p.variants.map((v) => ({
      key: v.id,
      id: v.id,
      colorKey: v.colorId,
      size: v.size,
      sku: v.sku,
      stock: v.stock,
      minStock: v.minStock == null ? '' : String(v.minStock),
      active: v.active !== false,
    })),
  };
}

const blank = (department = 'mujer'): Draft => ({
  name: '',
  slug: '',
  code: '',
  department,
  category: '',
  description: '',
  detailsText: '',
  material: '',
  care: '',
  origin: 'Importado de EE. UU.',
  price: '',
  compareAtPrice: '',
  cost: '',
  tags: [],
  isNew: true,
  isBestseller: false,
  isFeatured: false,
  status: 'borrador',
  colors: [],
  variants: [],
});

function toPayload(d: Draft): ProductPayload {
  return {
    id: d.id,
    slug: d.slug,
    code: d.code,
    name: d.name,
    department: d.department,
    category: d.category || null,
    description: d.description,
    details: d.detailsText
      .split('\n')
      .map((x) => x.replace(/^[-–•·]\s*/, '').trim())
      .filter(Boolean),
    material: d.material,
    care: d.care,
    origin: d.origin,
    price: Number(d.price) || 0,
    compareAtPrice: d.compareAtPrice === '' ? null : Number(d.compareAtPrice) || null,
    cost: Number(d.cost) || 0,
    tags: d.tags,
    isNew: d.isNew,
    isBestseller: d.isBestseller,
    isFeatured: d.isFeatured,
    status: d.status,
    colors: d.colors.map(({ key, id, name, hex, family, images }) => ({ key, id, name, hex, family, images })),
    variants: d.variants.map(({ id, colorKey, size, sku, stock, minStock, active }) => ({
      id,
      colorKey,
      size,
      sku,
      stock: Number(stock) || 0,
      minStock: minStock === '' ? null : Number(minStock),
      active,
    })),
  };
}

const sizesOf = (d: Draft): string[] =>
  [...new Set(d.variants.map((v) => v.size))].sort((a, b) => sizeRank(a) - sizeRank(b));

const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: 'activo', label: 'Publicado' },
  { value: 'borrador', label: 'Borrador' },
  { value: 'archivado', label: 'Archivado' },
];

export default function ProductEditor() {
  const { id } = useParams();
  const { query } = useSearch();
  const isNew = !id;
  const {
    data: product,
    loading,
    error,
  } = useData(
    ['products', 'detail', id || 'nuevo'],
    () => (isNew ? Promise.resolve(null) : api.catalog.product(id)),
    ['products'],
    { enabled: !isNew },
  );
  const { data: tax } = useData(['taxonomy'], () => api.catalog.taxonomy(), ['taxonomy']);
  const settings = useStore(settingsStore);
  const [draft, setDraft] = useState<Draft | null>(() => (isNew ? blank(query.depto) : null));
  const [base, setBase] = useState<string | null>(() => (isNew ? JSON.stringify(blank(query.depto)) : null));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (product && !draft) {
      const d = toDraft(product);
      setDraft(d);
      setBase(JSON.stringify(d));
    }
  }, [product, draft]);

  const dirty = !!draft && base !== JSON.stringify(draft);
  const { allowNext } = useUnsavedChanges(dirty);

  const set = (patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) =>
    setDraft((d) => (d ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d));

  // ⌘/Ctrl + S guarda
  const saveRef = useRef<() => void>(() => {});
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      saveRef.current();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  if (!isNew && error) {
    return (
      <main className="page">
        <Empty title="No se pudo cargar el producto">{error.message}</Empty>
      </main>
    );
  }
  if (!isNew && !loading && product === null) {
    return (
      <main className="page">
        <Empty
          icon={Shirt}
          title="Este producto ya no existe"
          action={
            <Button variant="primary" onClick={() => navigate('/productos')}>
              Ver productos
            </Button>
          }
        />
      </main>
    );
  }
  if (!draft) {
    return (
      <main className="page">
        <div className="card">
          <SkeletonRows rows={8} />
        </div>
      </main>
    );
  }

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
  const addColor = () =>
    set((d) => {
      const key = newKey();
      const color: DraftColor = { key, name: '', hex: '#D9C6A6', family: 'beige', familyAuto: true, images: [] };
      return {
        colors: [...d.colors, color],
        variants: [
          ...d.variants,
          ...sizesOf(d).map((size) => ({
            key: newKey(),
            colorKey: key,
            size,
            sku: '',
            stock: 0,
            minStock: '',
            active: true,
          })),
        ],
      };
    });
  const updateColor = (key: string, patch: Partial<DraftColor>) =>
    set((d) => ({
      colors: d.colors.map((c) => {
        if (c.key !== key) return c;
        const next = { ...c, ...patch };
        if (patch.hex !== undefined && c.familyAuto) next.family = guessFamily(patch.hex);
        if (patch.family !== undefined) next.familyAuto = false;
        return next;
      }),
    }));
  const removeColor = async (c: DraftColor) => {
    const stock = draft.variants.filter((v) => v.colorKey === c.key).reduce((a, v) => a + (Number(v.stock) || 0), 0);
    if (stock || c.images.length) {
      const ok = await confirmDialog({
        title: `¿Quitar el color ${c.name || 'sin nombre'}?`,
        message: stock
          ? `Tiene ${stock} pieza${stock === 1 ? '' : 's'} en existencia que se darán de baja al guardar.`
          : 'Se quitan también sus fotos.',
        confirm: 'Quitar',
        danger: true,
      });
      if (!ok) return;
    }
    set((d) => ({
      colors: d.colors.filter((x) => x.key !== c.key),
      variants: d.variants.filter((v) => v.colorKey !== c.key),
    }));
  };
  const moveColor = (i: number, to: number) =>
    set((d) => {
      const colors = [...d.colors];
      const [x] = colors.splice(i, 1);
      if (x) colors.splice(to, 0, x);
      return { colors };
    });

  /* ---------- tallas ---------- */
  const addSizes = (list: string[]) =>
    set((d) => {
      const have = new Set(sizesOf(d).map((s) => s.toLowerCase()));
      const fresh = list.map((s) => String(s).trim()).filter((s) => s && !have.has(s.toLowerCase()));
      return {
        variants: [
          ...d.variants,
          ...fresh.flatMap((size) =>
            d.colors.map((c) => ({
              key: newKey(),
              colorKey: c.key,
              size,
              sku: '',
              stock: 0,
              minStock: '',
              active: true,
            })),
          ),
        ],
      };
    });
  const removeSize = async (size: string) => {
    const stock = draft.variants.filter((v) => v.size === size).reduce((a, v) => a + (Number(v.stock) || 0), 0);
    if (
      stock &&
      !(await confirmDialog({
        title: `¿Quitar la talla ${size}?`,
        message: `Tiene ${stock} pieza${stock === 1 ? '' : 's'} en existencia que se darán de baja al guardar.`,
        confirm: 'Quitar',
        danger: true,
      }))
    ) {
      return;
    }
    set((d) => ({ variants: d.variants.filter((v) => v.size !== size) }));
  };
  const customSize = async () => {
    const s = await promptDialog({
      title: 'Agregar talla',
      message: 'Por ejemplo: XXL, 28, 6X o Única.',
      placeholder: 'Talla',
      confirm: 'Agregar',
      required: true,
    });
    if (s) addSizes(s.split(/[,\s]+/).filter(Boolean));
  };
  const updateVariant = (key: string, patch: Partial<DraftVariant>) =>
    set((d) => ({ variants: d.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) }));
  const missing = draft.colors.flatMap((c) =>
    sizes.filter((s) => !draft.variants.some((v) => v.colorKey === c.key && v.size === s)).map((s) => ({ c, s })),
  );
  const restoreMissing = () =>
    set((d) => ({
      variants: [
        ...d.variants,
        ...missing.map(({ c, s }) => ({
          key: newKey(),
          colorKey: c.key,
          size: s,
          sku: '',
          stock: 0,
          minStock: '',
          active: true,
        })),
      ],
    }));
  const fillStock = async () => {
    const n = await promptDialog({
      title: 'Misma cantidad para todas',
      message: 'Escribe las piezas que hay de cada combinación de color y talla.',
      placeholder: '0',
      confirm: 'Aplicar',
      required: true,
    });
    const value = Math.max(0, parseInt(n || '', 10));
    if (!Number.isNaN(value)) set((d) => ({ variants: d.variants.map((v) => ({ ...v, stock: value })) }));
  };

  /* ---------- guardar ---------- */
  const validate = (d: Draft): boolean => {
    const e: Record<string, string> = {};
    const p = Number(d.price) || 0;
    const cmp = Number(d.compareAtPrice) || 0;
    if (!d.name.trim()) e.name = 'Escribe el nombre del producto.';
    if (d.price === '' || !(Number(d.price) >= 0)) e.price = 'Escribe el precio.';
    if (cmp && cmp <= p) e.compareAtPrice = 'Debe ser mayor que el precio actual.';
    d.colors.forEach((c) => {
      if (!c.name.trim()) e[`color-${c.key}`] = 'Ponle nombre al color.';
    });
    if (d.status === 'activo' && (!d.colors.length || !d.variants.length))
      e.variants = 'Para publicarlo agrega al menos un color y una talla.';
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector('.is-invalid, .field__error')
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      );
      return false;
    }
    return true;
  };

  async function save(nextStatus?: ProductStatus) {
    if (saving || !draft) return;
    const d = nextStatus ? { ...draft, status: nextStatus } : draft;
    if (nextStatus) setDraft(d);
    if (!validate(d)) {
      toast({ tone: 'error', title: 'Revisa los campos marcados' });
      return;
    }
    setSaving(true);
    try {
      const saved = await api.catalog.save(toPayload(d));
      const fresh = toDraft(saved);
      setDraft(fresh);
      setBase(JSON.stringify(fresh));
      invalidate('products', 'inventory');
      toast({
        title: isNew ? 'Producto creado' : 'Cambios guardados',
        sub:
          saved.status === 'activo'
            ? 'Ya se ve en la tienda.'
            : saved.status === 'borrador'
              ? 'Guardado como borrador (no se ve en la tienda).'
              : 'Archivado.',
      });
      if (isNew) {
        allowNext();
        navigate(`/productos/${saved.id}`, { replace: true });
      }
    } catch (err) {
      toastError(err, 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }
  saveRef.current = () => void save();

  const discard = async () => {
    const ok = await confirmDialog({
      title: '¿Descartar los cambios?',
      message: 'Se perderán los cambios que no has guardado.',
      confirm: 'Descartar',
      danger: true,
    });
    if (!ok) return;
    const d = isNew || !product ? blank(query.depto) : toDraft(product);
    setDraft(d);
    setBase(JSON.stringify(d));
    setErrors({});
  };

  const duplicate = async () => {
    if (dirty) {
      toast({ tone: 'info', title: 'Primero guarda los cambios' });
      return;
    }
    if (!product) return;
    try {
      const copy = await api.catalog.save(duplicatePayload(product));
      invalidate('products');
      toast({ title: 'Producto duplicado', sub: 'Estás editando la copia.' });
      navigate(`/productos/${copy.id}`);
    } catch (err) {
      toastError(err);
    }
  };
  const remove = async () => {
    if (!draft.id) return;
    const ok = await confirmDialog({
      title: `¿Eliminar «${draft.name}»?`,
      message: 'Se borra del catálogo y de la tienda. Los pedidos anteriores conservan sus datos.',
      confirm: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.catalog.remove(draft.id);
      allowNext();
      invalidate('products', 'inventory');
      toast({ title: 'Producto eliminado' });
      navigate('/productos', { replace: true });
    } catch (err) {
      toastError(err);
    }
  };

  const mainImage = draft.colors[0]?.images?.[0];

  return (
    <main className="page page--wide editor" ref={formRef}>
      <PageHeader
        back={{ to: '/productos', label: 'Productos' }}
        title={draft.name || (isNew ? 'Nuevo producto' : 'Sin nombre')}
        sub={
          isNew
            ? 'Completa la información, sube las fotos de cada color y define tallas y existencias.'
            : `${draft.code || ''} · ${number(totalStock)} piezas en existencia`
        }
        actions={
          !isNew && (
            <>
              {draft.status === 'activo' && (
                <Button
                  icon={ExternalLink}
                  onClick={() => window.open(`/producto/${encodeURIComponent(draft.slug)}`, '_blank', 'noopener')}
                >
                  Ver en la tienda
                </Button>
              )}
              <Menu
                items={[
                  { label: 'Duplicar producto', icon: Copy, onClick: () => void duplicate() },
                  draft.status !== 'archivado' && {
                    label: 'Archivar',
                    icon: Archive,
                    onClick: () => void save('archivado'),
                  },
                  '-',
                  { label: 'Eliminar producto', icon: Trash2, danger: true, onClick: () => void remove() },
                ]}
              />
            </>
          )
        }
      />

      <div className="editor__grid">
        <div className="stack editor__main">
          <Card title="Información" icon={Info}>
            <div className="stack">
              <TextField
                label="Nombre"
                value={draft.name}
                onValue={(v) => set({ name: v })}
                error={errors.name}
                placeholder="Ej. Vestido slip satinado"
                maxLength={140}
                data-autofocus
              />
              <TextField
                label="Descripción"
                multiline
                rows={4}
                value={draft.description}
                onValue={(v) => set({ description: v })}
                placeholder="Cuéntale a tu clienta cómo es la prenda y para qué ocasión es ideal."
                hint="Aparece en la página del producto, debajo del precio."
              />
              <TextField
                label="Detalles"
                multiline
                rows={4}
                value={draft.detailsText}
                onValue={(v) => set({ detailsText: v })}
                placeholder={'Uno por renglón, por ejemplo:\nTirantes ajustables\nLargo midi'}
                optional
              />
              <div className="grid" style={{ '--cols': 3 }}>
                <TextField
                  label="Material"
                  value={draft.material}
                  onValue={(v) => set({ material: v })}
                  placeholder="Satín de poliéster"
                  optional
                />
                <TextField
                  label="Cuidados"
                  value={draft.care}
                  onValue={(v) => set({ care: v })}
                  placeholder="Lavar a mano en agua fría"
                  optional
                />
                <TextField
                  label="Origen"
                  value={draft.origin}
                  onValue={(v) => set({ origin: v })}
                  placeholder="Importado de EE. UU."
                  optional
                />
              </div>
            </div>
          </Card>

          <Card
            title="Colores y fotos"
            icon={Palette}
            sub="La primera foto de cada color es la principal; la segunda aparece al pasar el cursor."
            actions={
              <Button size="sm" variant="tinted" icon={Plus} onClick={addColor}>
                Agregar color
              </Button>
            }
          >
            {!draft.colors.length ? (
              <Empty
                icon={Palette}
                title="Agrega el primer color"
                action={
                  <Button variant="primary" icon={Plus} onClick={addColor}>
                    Agregar color
                  </Button>
                }
              >
                Cada color tiene sus propias fotos y sus propias existencias por talla.
              </Empty>
            ) : (
              <div className="stack" style={{ '--gap': '18px' }}>
                {draft.colors.map((c, i) => (
                  <div key={c.key} className="color-block">
                    <div className="color-block__head">
                      <label className="color-dot" title="Elegir color">
                        <span className="swatch" style={{ '--c': c.hex, '--s': '34px' }} />
                        <input
                          type="color"
                          value={c.hex}
                          onChange={(e) => updateColor(c.key, { hex: e.currentTarget.value.toUpperCase() })}
                          aria-label={`Tono del color ${c.name}`}
                        />
                      </label>
                      <div className={cx('field grow', errors[`color-${c.key}`] && 'is-invalid')}>
                        <input
                          className="input"
                          value={c.name}
                          placeholder="Nombre del color (Ej. Champagne)"
                          onChange={(e) => updateColor(c.key, { name: e.currentTarget.value })}
                          aria-label="Nombre del color"
                          maxLength={60}
                        />
                        {errors[`color-${c.key}`] && <p className="field__error">{errors[`color-${c.key}`]}</p>}
                      </div>
                      <select
                        className="input color-block__family"
                        value={c.family}
                        onChange={(e) => updateColor(c.key, { family: e.currentTarget.value })}
                        aria-label="Familia de color para el filtro de la tienda"
                        title="Familia de color (filtro de la tienda)"
                      >
                        {COLOR_FAMILIES.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                      <Menu
                        items={[
                          i > 0 && { label: 'Mover arriba', onClick: () => moveColor(i, i - 1) },
                          i < draft.colors.length - 1 && { label: 'Mover abajo', onClick: () => moveColor(i, i + 1) },
                          '-',
                          { label: 'Quitar color', icon: Trash2, danger: true, onClick: () => void removeColor(c) },
                        ]}
                      />
                    </div>
                    <Gallery
                      images={c.images}
                      onChange={(images) => updateColor(c.key, { images })}
                      folder="divani/productos"
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Tallas, SKU y existencias"
            icon={Ruler}
            sub="Cada combinación de color y talla tiene su propio SKU y sus piezas en existencia."
            actions={
              draft.colors.length > 0 &&
              sizes.length > 0 && (
                <Button size="sm" variant="ghost" icon={Layers} onClick={() => void fillStock()}>
                  Misma cantidad
                </Button>
              )
            }
          >
            <div className="stack">
              <div className="size-bar">
                <div className="chips">
                  {sizes.map((s) => (
                    <span key={s} className="chip chip--sm size-chip">
                      {s}
                      <button
                        type="button"
                        className="chip__x"
                        aria-label={`Quitar talla ${s}`}
                        onClick={() => void removeSize(s)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button type="button" className="chip chip--sm" onClick={() => void customSize()}>
                    <Plus aria-hidden="true" />
                    Talla
                  </button>
                </div>
                <Menu
                  items={[
                    { heading: 'Agregar un juego de tallas' },
                    ...SIZE_PRESETS.map((p) => ({
                      label: p.name,
                      hint: p.sizes.length > 4 ? `${p.sizes[0]}–${p.sizes[p.sizes.length - 1]}` : p.sizes.join(' '),
                      onClick: () => addSizes(p.sizes),
                    })),
                  ]}
                  trigger={({ toggle, open }) => (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={WandSparkles}
                      iconEnd={ChevronDown}
                      aria-expanded={open}
                      onClick={toggle}
                    >
                      Juegos de tallas
                    </Button>
                  )}
                />
              </div>
              {errors.variants && <p className="field__error">{errors.variants}</p>}
              {!draft.colors.length ? (
                <p className="muted small">Primero agrega un color; luego elige sus tallas.</p>
              ) : !sizes.length ? (
                <p className="muted small">Elige un juego de tallas o agrega las tallas una por una.</p>
              ) : (
                <div className="variant-groups">
                  {draft.colors.map((c) => {
                    const vs = draft.variants
                      .filter((v) => v.colorKey === c.key)
                      .sort((a, b) => sizeRank(a.size) - sizeRank(b.size));
                    const sum = vs.reduce((a, v) => a + (Number(v.stock) || 0), 0);
                    return (
                      <div key={c.key} className="variant-group">
                        <div className="variant-group__head">
                          <span className="swatch" style={{ '--c': c.hex }} />
                          <strong>{c.name || 'Color sin nombre'}</strong>
                          <span className="muted small">{number(sum)} pzs</span>
                        </div>
                        <div className="variant-table" role="table" aria-label={`Variantes de ${c.name}`}>
                          <div className="variant-row variant-row--head" role="row">
                            <span role="columnheader">Talla</span>
                            <span role="columnheader">SKU</span>
                            <span role="columnheader">Existencias</span>
                            <span role="columnheader" title="Te avisamos cuando queden estas piezas o menos">
                              Mínimo
                            </span>
                            <span role="columnheader" className="visually-hidden">
                              Quitar
                            </span>
                          </div>
                          {vs.map((v) => (
                            <div key={v.key} className={cx('variant-row', !v.active && 'is-off')} role="row">
                              <span className="variant-row__size" role="cell">
                                {v.size}
                              </span>
                              <span role="cell">
                                <input
                                  className="input input--sm mono"
                                  value={v.sku}
                                  placeholder={makeSku(codePreview, c.name || 'Color', v.size)}
                                  onChange={(e) => updateVariant(v.key, { sku: e.currentTarget.value.toUpperCase() })}
                                  aria-label={`SKU talla ${v.size}`}
                                />
                              </span>
                              <span role="cell">
                                <Stepper
                                  size="sm"
                                  value={Number(v.stock) || 0}
                                  onChange={(n) => updateVariant(v.key, { stock: n })}
                                  label={`Existencias talla ${v.size}`}
                                />
                              </span>
                              <span role="cell">
                                <input
                                  className="input input--sm input--center"
                                  inputMode="numeric"
                                  value={v.minStock}
                                  placeholder={String(lowDefault)}
                                  onChange={(e) =>
                                    updateVariant(v.key, { minStock: e.currentTarget.value.replace(/\D/g, '') })
                                  }
                                  aria-label={`Mínimo talla ${v.size}`}
                                />
                              </span>
                              <span role="cell">
                                <IconButton
                                  size="sm"
                                  danger
                                  icon={Trash2}
                                  label={`Quitar ${c.name} talla ${v.size}`}
                                  onClick={() => set((d) => ({ variants: d.variants.filter((x) => x.key !== v.key) }))}
                                />
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {missing.length > 0 && (
                    <button type="button" className="link-btn small" onClick={restoreMissing}>
                      <Plus aria-hidden="true" />
                      Agregar las {missing.length} combinaciones que faltan
                    </button>
                  )}
                </div>
              )}
              <p className="field__hint">
                Deja el SKU vacío y se genera solo (código + color + talla). «Mínimo»: te avisamos cuando esa talla
                llegue a ese número de piezas (vacío = cuando se agote).
              </p>
            </div>
          </Card>
        </div>

        <aside className="stack editor__side">
          <Card title="Estado" icon={Eye}>
            <div className="stack" style={{ '--gap': '12px' }}>
              <Segmented
                block
                value={draft.status}
                onChange={(v) => set({ status: v })}
                options={STATUS_OPTIONS}
                label="Estado"
              />
              <p className="small muted">
                {draft.status === 'activo'
                  ? 'Se muestra en la tienda y se puede pedir.'
                  : draft.status === 'borrador'
                    ? 'No se ve en la tienda; termina de prepararlo con calma.'
                    : 'Oculto y fuera de los listados. Su historial se conserva.'}
              </p>
            </div>
            <div className="list editor__flags">
              <SwitchRow
                icon={Sparkles}
                title="Nuevo"
                sub="Etiqueta «Nuevo» y sección de novedades"
                checked={draft.isNew}
                onChange={(v) => set({ isNew: v })}
              />
              <SwitchRow
                icon={Tag}
                title="Lo más deseado"
                sub="Aparece en «Las favoritas»"
                checked={draft.isBestseller}
                onChange={(v) => set({ isBestseller: v })}
              />
              <SwitchRow
                icon={Eye}
                title="Destacado"
                sub="Sale primero en la tienda"
                checked={draft.isFeatured}
                onChange={(v) => set({ isFeatured: v })}
              />
            </div>
          </Card>

          <Card title="Precio" icon={Tag}>
            <div className="stack">
              <Field label="Precio de venta" error={errors.price}>
                <MoneyInput value={draft.price} onValue={(v) => set({ price: v })} />
              </Field>
              <Field
                label="Precio antes"
                optional
                error={errors.compareAtPrice}
                hint={off ? null : 'Si es mayor al precio, se muestra tachado como oferta.'}
              >
                <MoneyInput value={draft.compareAtPrice} onValue={(v) => set({ compareAtPrice: v })} />
              </Field>
              {off > 0 && (
                <p className="small">
                  <Badge tone="red">−{Math.round(off * 100)} %</Badge>{' '}
                  <span className="muted">se mostrará como oferta</span>
                </p>
              )}
              <Field
                label="Costo por pieza"
                optional
                hint="Solo lo ves tú. Sirve para calcular tu ganancia en los reportes."
              >
                <MoneyInput value={draft.cost} onValue={(v) => set({ cost: v })} />
              </Field>
              {margin !== null && (
                <div className={cx('margin-box', margin < 0.2 && 'is-low')}>
                  <span>Ganancia por pieza</span>
                  <strong>{money(round2(price - cost))}</strong>
                  <span className="muted">{percent(margin, 0)} de margen</span>
                </div>
              )}
            </div>
          </Card>

          <Card title="Organización" icon={Layers}>
            <div className="stack">
              <SelectField
                label="Departamento"
                value={draft.department}
                onValue={(v) => set({ department: v, category: '' })}
                options={deps.map((d) => ({ value: d.slug, label: d.name }))}
              />
              <SelectField
                label="Categoría"
                value={draft.category}
                onValue={(v) => set({ category: v })}
                placeholder="Sin categoría"
                options={cats.map((c) => ({ value: c.slug, label: c.name }))}
              />
              <Field label="Etiquetas" optional hint="Ayudan a la búsqueda de la tienda (satín, fiesta, básico…).">
                <TagInput value={draft.tags} onChange={(tags) => set({ tags })} />
              </Field>
              <details className="advanced">
                <summary>Código y dirección web</summary>
                <div className="stack" style={{ marginTop: '12px' }}>
                  <TextField
                    label="Código del producto"
                    value={draft.code}
                    onValue={(v) => set({ code: v.toUpperCase() })}
                    placeholder="Se genera solo (DV-MUJ-028)"
                    hint="Es la base de los SKU."
                  />
                  <TextField
                    label="Dirección en la tienda"
                    value={draft.slug}
                    onValue={(v) => set({ slug: slugify(v) })}
                    placeholder={slugify(draft.name) || 'se-genera-sola'}
                    hint={`/producto/${draft.slug || slugify(draft.name) || '…'}`}
                  />
                </div>
              </details>
            </div>
          </Card>

          <Card title="Así se verá" icon={Eye}>
            <div className="preview-card">
              <div className="preview-card__media">
                {mainImage ? (
                  <img src={cdn(mainImage, { w: 600 })} alt="" />
                ) : (
                  <span className="preview-card__ph">
                    <Shirt aria-hidden="true" />
                  </span>
                )}
                <div className="preview-card__badges">
                  {off > 0 && <span className="pbadge pbadge--sale">−{Math.round(off * 100)}%</span>}
                  {draft.isNew && <span className="pbadge">Nuevo</span>}
                </div>
              </div>
              <p className="preview-card__name">{draft.name || 'Nombre del producto'}</p>
              <p className="preview-card__price">
                {money(price)}
                {off > 0 && <s>{money(compare)}</s>}
              </p>
              {draft.colors.length > 0 && (
                <div className="row" style={{ '--gap': '5px' }}>
                  {draft.colors.map((c) => (
                    <span key={c.key} className="swatch" style={{ '--c': c.hex, '--s': '14px' }} />
                  ))}
                  <span className="xsmall muted">
                    {draft.colors.length === 1 ? draft.colors[0]?.name : `${draft.colors.length} colores`}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </aside>
      </div>

      <div className={cx('savebar glass', dirty && 'is-dirty')} role="region" aria-label="Guardar cambios">
        <span className="savebar__text">
          {dirty ? 'Tienes cambios sin guardar' : isNew ? 'Producto nuevo' : 'Todo guardado'}
        </span>
        {dirty && !isNew && (
          <Button variant="ghost" onClick={() => void discard()}>
            Descartar
          </Button>
        )}
        <Button variant="primary" icon={Save} loading={saving} onClick={() => void save()} disabled={!dirty && !isNew}>
          {isNew ? 'Crear producto' : 'Guardar'}
        </Button>
      </div>
    </main>
  );
}
