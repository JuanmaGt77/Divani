/** Departamentos y categorías: nombres, descripciones, fotos, orden y visibilidad. */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, EyeOff, LayoutGrid, Pencil, Plus, Shirt, Trash2 } from 'lucide-react';
import { plural } from '@/lib/format';
import { bySort, cdn } from '@/lib/model';
import type { Category, Department, Product, Taxonomy } from '@/lib/types';
import { api } from '../../api';
import { navigate } from '../../lib/navigation';
import { invalidate } from '../../lib/query';
import { Button, Segmented, SelectField, SwitchRow, TextField, cx } from '../../ui/controls';
import { MediaField } from '../../ui/media';
import { Sheet, confirmDialog, toast, toastError } from '../../ui/overlays';
import { Badge, Card, Empty, Menu, SkeletonRows, Thumb } from '../../ui/surfaces';
import { MoveButtons, useOrdered } from './shared';

type CategoryDraft = Partial<Category> & { department: string };

export function CategoriesTab({
  tax,
  products,
  loading,
  onSaved,
}: {
  tax: Taxonomy | undefined;
  products: Product[] | undefined;
  loading: boolean;
  onSaved?: () => void;
}) {
  const deps = useMemo(() => [...(tax?.departments || [])].sort(bySort), [tax]);
  const all = useMemo(() => [...(tax?.categories || [])].sort(bySort), [tax]);
  const [dep, setDep] = useState('mujer');
  const [editCat, setEditCat] = useState<CategoryDraft | null>(null);
  const [editDep, setEditDep] = useState<Department | null>(null);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of products || [])
      if (p.status !== 'archivado' && p.category) c[p.category] = (c[p.category] || 0) + 1;
    return c;
  }, [products]);
  const inDep = useMemo(() => all.filter((c) => c.department === dep), [all, dep]);

  // Reordenar dentro del departamento conservando el orden de los demás
  const [list, move] = useOrdered(
    inDep,
    (c) => c.slug,
    (slugs) => {
      const order = deps.flatMap((d) =>
        d.slug === dep ? slugs : all.filter((c) => c.department === d.slug).map((c) => c.slug),
      );
      return api.catalog.reorderCategories(order);
    },
    'taxonomy',
  );

  const remove = async (c: Category) => {
    const n = counts[c.slug] || 0;
    if (n) {
      toastError(
        new Error(`Tiene ${plural(n, 'producto', 'productos')}. Muévelos a otra categoría antes de eliminarla.`),
        'No se puede eliminar',
      );
      return;
    }
    const ok = await confirmDialog({
      title: `¿Eliminar «${c.name}»?`,
      message: 'La categoría deja de aparecer en la tienda y en los filtros.',
      confirm: 'Eliminar',
      danger: true,
    });
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
  const newCategory = () => setEditCat({ department: dep, name: '', description: '', image: '', active: true });

  return (
    <>
      <div className="section-title" style={{ marginTop: 0 }}>
        <h2>
          <LayoutGrid aria-hidden="true" />
          Departamentos
        </h2>
        <p className="small muted">Las cuatro grandes secciones de tu tienda.</p>
      </div>
      <div className="dep-grid">
        {loading
          ? [0, 1, 2, 3].map((i) => <div key={i} className="dep-tile sk" />)
          : deps.map((d) => (
              <button
                key={d.slug}
                type="button"
                className={cx('dep-tile', d.active === false && 'is-off')}
                onClick={() => setEditDep(d)}
              >
                {d.image ? (
                  <img src={cdn(d.image, { w: 500 })} alt="" loading="lazy" />
                ) : (
                  <span className="dep-tile__ph">
                    <Shirt aria-hidden="true" />
                  </span>
                )}
                <span className="dep-tile__label">
                  <strong>{d.name}</strong>
                  <small>
                    {d.active === false
                      ? 'Oculto en la tienda'
                      : plural(all.filter((c) => c.department === d.slug).length, 'categoría', 'categorías')}
                  </small>
                </span>
                <span className="dep-tile__edit">
                  <Pencil aria-hidden="true" />
                  Editar
                </span>
              </button>
            ))}
      </div>

      <div className="section-title">
        <h2>
          <Shirt aria-hidden="true" />
          Categorías
        </h2>
        <Button variant="primary" icon={Plus} onClick={newCategory}>
          Nueva categoría
        </Button>
      </div>
      <div className="toolbar">
        <Segmented
          value={dep}
          onChange={setDep}
          label="Departamento"
          options={deps.map((d) => ({
            value: d.slug,
            label: d.name,
            count: all.filter((c) => c.department === d.slug).length,
          }))}
        />
      </div>
      <Card bodyClass={false}>
        {loading ? (
          <SkeletonRows rows={5} />
        ) : !list.length ? (
          <Empty
            icon={Shirt}
            title={`${depName} aún no tiene categorías`}
            action={
              <Button variant="primary" icon={Plus} onClick={newCategory}>
                Crear categoría
              </Button>
            }
          >
            Las categorías ordenan tus productos y aparecen como filtros en la tienda.
          </Empty>
        ) : (
          <div className="list">
            {list.map((c, i) => (
              <div
                key={c.slug}
                className={cx('list__row cat-row', c.active === false && 'is-off')}
                style={{ '--inset': '80px' }}
              >
                <button type="button" className="cat-row__main" onClick={() => setEditCat(c)}>
                  <Thumb src={c.image} size={44} />
                  <span className="list__body">
                    <span className="list__title">
                      {c.name} {c.active === false && <Badge icon={EyeOff}>Oculta</Badge>}
                    </span>
                    <span className="list__sub">{c.description || 'Sin descripción'}</span>
                  </span>
                </button>
                <Link className="cat-row__count small muted" to={`/productos?cat=${c.slug}`}>
                  {plural(counts[c.slug] || 0, 'producto', 'productos')}
                  <ChevronRight aria-hidden="true" />
                </Link>
                <MoveButtons i={i} n={list.length} onMove={(from, to) => void move(from, to)} label="categoría" />
                <Menu
                  items={[
                    { label: 'Editar', icon: Pencil, onClick: () => setEditCat(c) },
                    { label: 'Ver sus productos', icon: Shirt, onClick: () => navigate(`/productos?cat=${c.slug}`) },
                    '-',
                    { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => void remove(c) },
                  ]}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
      {dep === 'mujer' && list.length > 0 && (
        <p className="small muted" style={{ marginTop: '10px' }}>
          Las categorías de Mujer aparecen con su foto en «Compra por categoría» de la portada, en este mismo orden.
        </p>
      )}

      <CategorySheet
        cat={editCat}
        deps={deps}
        hasProducts={!!(editCat?.slug && counts[editCat.slug])}
        onClose={(saved) => {
          setEditCat(null);
          if (saved) onSaved?.();
        }}
      />
      <DepartmentSheet
        dep={editDep}
        onClose={(saved) => {
          setEditDep(null);
          if (saved) onSaved?.();
        }}
      />
    </>
  );
}

function CategorySheet({
  cat,
  deps,
  hasProducts,
  onClose,
}: {
  cat: CategoryDraft | null;
  deps: Department[];
  hasProducts: boolean;
  onClose: (saved: boolean) => void;
}) {
  const [d, setD] = useState<CategoryDraft>({ department: 'mujer' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (cat) setD(structuredClone(cat));
  }, [cat]);
  const set = (p: Partial<CategoryDraft>) => setD((x) => ({ ...x, ...p }));
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
      footer={
        <>
          <Button variant="ghost" onClick={() => onClose(false)}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            {d.slug ? 'Guardar cambios' : 'Crear categoría'}
          </Button>
        </>
      }
    >
      <div className="cat-editor">
        <MediaField
          label="Foto"
          value={d.image}
          onChange={(v) => set({ image: v })}
          aspect="4 / 5"
          folder="divani/categorias"
          hint="Vertical, 1200 × 1500 px."
        />
        <div className="stack">
          <TextField
            label="Nombre"
            value={d.name}
            onValue={(v) => set({ name: v })}
            placeholder="Vestidos"
            maxLength={60}
          />
          <SelectField
            label="Departamento"
            value={d.department}
            onValue={(v) => set({ department: v })}
            options={deps.map((x) => ({ value: x.slug, label: x.name }))}
            disabled={hasProducts}
            hint={
              hasProducts ? 'Tiene productos: para cambiarla de departamento, mueve primero sus productos.' : undefined
            }
          />
          <TextField
            label="Descripción"
            optional
            multiline
            rows={3}
            value={d.description}
            onValue={(v) => set({ description: v })}
            placeholder="De día, de noche y para cada ocasión."
            maxLength={200}
          />
          <div className="list card card--flat">
            <SwitchRow
              title="Mostrar en la tienda"
              sub="Si la apagas, sus productos siguen visibles en la búsqueda general"
              checked={d.active !== false}
              onChange={(v) => set({ active: v })}
            />
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function DepartmentSheet({ dep, onClose }: { dep: Department | null; onClose: (saved: boolean) => void }) {
  const [d, setD] = useState<Partial<Department>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (dep) setD(structuredClone(dep));
  }, [dep]);
  const set = (p: Partial<Department>) => setD((x) => ({ ...x, ...p }));
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
      footer={
        <>
          <Button variant="ghost" onClick={() => onClose(false)}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Guardar cambios
          </Button>
        </>
      }
    >
      <div className="cat-editor">
        <MediaField
          label="Foto"
          value={d.image}
          onChange={(v) => set({ image: v })}
          aspect="4 / 5"
          folder="divani/categorias"
          hint="Vertical, 1200 × 1500 px."
        />
        <div className="stack">
          <TextField label="Nombre" value={d.name} onValue={(v) => set({ name: v })} maxLength={60} />
          <TextField
            label="Descripción"
            optional
            multiline
            rows={3}
            value={d.description}
            onValue={(v) => set({ description: v })}
            maxLength={200}
          />
          <div className="list card card--flat">
            <SwitchRow
              title="Mostrar en la tienda"
              sub="Apágalo si por ahora no manejas este departamento"
              checked={d.active !== false}
              onChange={(v) => set({ active: v })}
            />
          </div>
        </div>
      </div>
    </Sheet>
  );
}
