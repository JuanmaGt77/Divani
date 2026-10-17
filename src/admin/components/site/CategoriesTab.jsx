/** Departamentos y categorías: nombres, descripciones, fotos, orden y visibilidad. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Plus, Pencil, Trash2, Shirt, LayoutGrid, EyeOff, ChevronRight } from 'lucide-preact';
import { api } from '../../api/index.js';
import { invalidate } from '../../lib/query.js';
import { href, navigate } from '../../lib/router.js';
import { plural } from '../../lib/format.js';
import { bySort, cdn } from '../../../backend/model.js';
import { Button, TextField, SelectField, SwitchRow, Segmented, cx } from '../../ui/controls.jsx';
import { Card, Badge, Empty, SkeletonRows, Menu, Thumb } from '../../ui/surfaces.jsx';
import { Sheet, toast, toastError, confirmDialog } from '../../ui/overlays.jsx';
import { MediaField } from '../../ui/media.jsx';
import { useOrdered, MoveButtons } from './shared.jsx';

export function CategoriesTab({ tax, products, loading, onSaved }) {
  const deps = useMemo(() => [...(tax?.departments || [])].sort(bySort), [tax]);
  const all = useMemo(() => [...(tax?.categories || [])].sort(bySort), [tax]);
  const [dep, setDep] = useState('mujer');
  const [editCat, setEditCat] = useState(null);
  const [editDep, setEditDep] = useState(null);
  const counts = useMemo(() => {
    const c = {};
    for (const p of products || []) if (p.status !== 'archivado') c[p.category] = (c[p.category] || 0) + 1;
    return c;
  }, [products]);
  const inDep = useMemo(() => all.filter((c) => c.department === dep), [all, dep]);

  // Reordenar dentro del departamento conservando el orden de los demás
  const [list, move] = useOrdered(inDep, (c) => c.slug, (slugs) => {
    const order = deps.flatMap((d) => (d.slug === dep ? slugs : all.filter((c) => c.department === d.slug).map((c) => c.slug)));
    return api.catalog.reorderCategories(order);
  }, 'taxonomy');

  const remove = async (c) => {
    const n = counts[c.slug] || 0;
    if (n) {
      toastError(new Error(`Tiene ${plural(n, 'producto', 'productos')}. Muévelos a otra categoría antes de eliminarla.`), 'No se puede eliminar');
      return;
    }
    const ok = await confirmDialog({ title: `¿Eliminar «${c.name}»?`, message: 'La categoría deja de aparecer en la tienda y en los filtros.', confirm: 'Eliminar', danger: true });
    if (!ok) return;
    try {
      await api.catalog.deleteCategory(c.slug);
      invalidate('taxonomy');
      onSaved?.();
      toast({ title: 'Categoría eliminada' });
    } catch (err) {
      toastError(err);
    }
  };

  const depName = deps.find((d) => d.slug === dep)?.name || '';

  return (
    <>
      <div class="section-title" style={{ marginTop: 0 }}>
        <h2><LayoutGrid aria-hidden="true" />Departamentos</h2>
        <p class="small muted">Las cuatro grandes secciones de tu tienda.</p>
      </div>
      <div class="dep-grid">
        {loading ? [0, 1, 2, 3].map(() => <div class="dep-tile sk" />) : deps.map((d) => (
          <button type="button" class={cx('dep-tile', d.active === false && 'is-off')} onClick={() => setEditDep(d)}>
            {d.image ? <img src={cdn(d.image, { w: 500 })} alt="" loading="lazy" /> : <span class="dep-tile__ph"><Shirt aria-hidden="true" /></span>}
            <span class="dep-tile__label">
              <strong>{d.name}</strong>
              <small>{d.active === false ? 'Oculto en la tienda' : plural(all.filter((c) => c.department === d.slug).length, 'categoría', 'categorías')}</small>
            </span>
            <span class="dep-tile__edit"><Pencil aria-hidden="true" />Editar</span>
          </button>
        ))}
      </div>

      <div class="section-title">
        <h2><Shirt aria-hidden="true" />Categorías</h2>
        <Button variant="primary" icon={Plus} onClick={() => setEditCat({ department: dep, name: '', description: '', image: '', active: true })}>Nueva categoría</Button>
      </div>
      <div class="toolbar">
        <Segmented value={dep} onChange={setDep} label="Departamento" options={deps.map((d) => ({ value: d.slug, label: d.name, count: all.filter((c) => c.department === d.slug).length }))} />
      </div>
      <Card bodyClass={false}>
        {loading ? <SkeletonRows rows={5} /> : !list.length ? (
          <Empty icon={Shirt} title={`${depName} aún no tiene categorías`} action={<Button variant="primary" icon={Plus} onClick={() => setEditCat({ department: dep, name: '', description: '', image: '', active: true })}>Crear categoría</Button>}>
            Las categorías ordenan tus productos y aparecen como filtros en la tienda.
          </Empty>
        ) : (
          <div class="list">
            {list.map((c, i) => (
              <div class={cx('list__row cat-row', c.active === false && 'is-off')} style={{ '--inset': '80px' }}>
                <button type="button" class="cat-row__main" onClick={() => setEditCat(c)}>
                  <Thumb src={c.image} size={44} />
                  <span class="list__body">
                    <span class="list__title">{c.name} {c.active === false && <Badge icon={EyeOff}>Oculta</Badge>}</span>
                    <span class="list__sub">{c.description || 'Sin descripción'}</span>
                  </span>
                </button>
                <a class="cat-row__count small muted" href={href(`/productos?cat=${c.slug}`)}>{plural(counts[c.slug] || 0, 'producto', 'productos')}<ChevronRight aria-hidden="true" /></a>
                <MoveButtons i={i} n={list.length} onMove={move} label="categoría" />
                <Menu items={[
                  { label: 'Editar', icon: Pencil, onClick: () => setEditCat(c) },
                  { label: 'Ver sus productos', icon: Shirt, onClick: () => navigate(`/productos?cat=${c.slug}`) },
                  '-',
                  { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => remove(c) },
                ]} />
              </div>
            ))}
          </div>
        )}
      </Card>
      {dep === 'mujer' && list.length > 0 && <p class="small muted" style={{ marginTop: '10px' }}>Las categorías de Mujer aparecen con su foto en «Compra por categoría» de la portada, en este mismo orden.</p>}

      <CategorySheet cat={editCat} deps={deps} hasProducts={!!(editCat?.slug && counts[editCat.slug])} onClose={(saved) => { setEditCat(null); if (saved) onSaved?.(); }} />
      <DepartmentSheet dep={editDep} onClose={(saved) => { setEditDep(null); if (saved) onSaved?.(); }} />
    </>
  );
}

function CategorySheet({ cat, deps, hasProducts, onClose }) {
  const [d, setD] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (cat) setD(structuredClone(cat)); }, [cat]);
  const set = (p) => setD((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    try {
      await api.catalog.saveCategory(d);
      invalidate('taxonomy');
      toast({ title: d.slug ? 'Categoría actualizada' : 'Categoría creada' });
      onClose(true);
    } catch (err) {
      toastError(err, 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={!!cat}
      onClose={() => onClose(false)}
      title={d.slug ? d.name || 'Categoría' : 'Nueva categoría'}
      size="lg"
      footer={<><Button variant="ghost" onClick={() => onClose(false)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>{d.slug ? 'Guardar cambios' : 'Crear categoría'}</Button></>}
    >
      <div class="cat-editor">
        <MediaField label="Foto" value={d.image} onChange={(v) => set({ image: v })} aspect="4 / 5" folder="divani/categorias" hint="Vertical, 1200 × 1500 px." />
        <div class="stack">
          <TextField label="Nombre" value={d.name} onValue={(v) => set({ name: v })} placeholder="Vestidos" maxLength={60} />
          <SelectField
            label="Departamento"
            value={d.department}
            onValue={(v) => set({ department: v })}
            options={deps.map((x) => ({ value: x.slug, label: x.name }))}
            disabled={hasProducts}
            hint={hasProducts ? 'Tiene productos: para cambiarla de departamento, mueve primero sus productos.' : undefined}
          />
          <TextField label="Descripción" optional multiline rows={3} value={d.description} onValue={(v) => set({ description: v })} placeholder="De día, de noche y para cada ocasión." maxLength={200} />
          <div class="list card card--flat">
            <SwitchRow title="Mostrar en la tienda" sub="Si la apagas, sus productos siguen visibles en la búsqueda general" checked={d.active !== false} onChange={(v) => set({ active: v })} />
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function DepartmentSheet({ dep, onClose }) {
  const [d, setD] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (dep) setD(structuredClone(dep)); }, [dep]);
  const set = (p) => setD((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    try {
      await api.catalog.saveDepartment(d);
      invalidate('taxonomy');
      toast({ title: 'Departamento actualizado' });
      onClose(true);
    } catch (err) {
      toastError(err, 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={!!dep}
      onClose={() => onClose(false)}
      title={d.name || 'Departamento'}
      sub="Departamento de la tienda"
      size="lg"
      footer={<><Button variant="ghost" onClick={() => onClose(false)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>Guardar cambios</Button></>}
    >
      <div class="cat-editor">
        <MediaField label="Foto" value={d.image} onChange={(v) => set({ image: v })} aspect="4 / 5" folder="divani/categorias" hint="Vertical, 1200 × 1500 px." />
        <div class="stack">
          <TextField label="Nombre" value={d.name} onValue={(v) => set({ name: v })} maxLength={60} />
          <TextField label="Descripción" optional multiline rows={3} value={d.description} onValue={(v) => set({ description: v })} maxLength={200} />
          <div class="list card card--flat">
            <SwitchRow title="Mostrar en la tienda" sub="Apágalo si por ahora no manejas este departamento" checked={d.active !== false} onChange={(v) => set({ active: v })} />
          </div>
        </div>
      </div>
    </Sheet>
  );
}
