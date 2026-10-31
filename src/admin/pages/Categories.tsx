/**
 * Categorías: crear, editar, ordenar, ocultar y eliminar las categorías de cada departamento,
 * con su foto de portada. Cada categoría activa aparece como filtro en la tienda (/tienda) y en
 * el editor de productos; las de Mujer, además, en «Compra por categoría» de la portada.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, ChevronRight, ExternalLink, EyeOff, ImagePlus, Pencil, Plus, Shirt, Trash2 } from 'lucide-react';
import { plural } from '@/lib/format';
import { bySort, cdn } from '@/lib/model';
import type { Category, Department } from '@/lib/types';
import { api } from '../api';
import { CategorySheet, DepartmentSheet, type CategoryDraft } from '../components/CategorySheets';
import { useOrdered } from '../components/site/shared';
import { navigate, useSearch } from '../lib/navigation';
import { invalidate, useData } from '../lib/query';
import { Button, LinkButton, Segmented, cx } from '../ui/controls';
import { confirmDialog, toast, toastError } from '../ui/overlays';
import { Badge, Empty, Menu, PageHeader } from '../ui/surfaces';

export default function Categories() {
  const { query, setQuery } = useSearch();
  const { data: tax, loading } = useData(['taxonomy'], () => api.catalog.taxonomy(), ['taxonomy']);
  const { data: products } = useData(['products'], () => api.catalog.products(), ['products', 'inventory']);
  const deps = useMemo(() => [...(tax?.departments || [])].sort(bySort), [tax]);
  const all = useMemo(() => [...(tax?.categories || [])].sort(bySort), [tax]);
  const dep = deps.some((d) => d.slug === query.depto) ? (query.depto as string) : deps[0]?.slug || 'mujer';
  const department = deps.find((d) => d.slug === dep);
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

  const newCategory = () => setEditCat({ department: dep, name: '', description: '', image: '', active: true });

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
      message: 'Deja de aparecer en la tienda, en los filtros y al crear productos.',
      confirm: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.catalog.deleteCategory(c.slug);
      invalidate('taxonomy');
      toast({ title: 'Categoría eliminada' });
    } catch (err) {
      toastError(err);
    }
  };

  const shopUrl = (c?: Category) => `/tienda?depto=${dep}${c ? `&cat=${c.slug}` : ''}`;

  return (
    <main className="page page--wide">
      <PageHeader
        title="Categorías"
        sub="Ordenan tus productos. Cada una aparece como filtro en la tienda y al crear un producto."
        actions={
          <>
            <LinkButton icon={ExternalLink} href={shopUrl()} target="_blank" rel="noopener">
              Ver en la tienda
            </LinkButton>
            <Button variant="primary" icon={Plus} onClick={newCategory}>
              Nueva categoría
            </Button>
          </>
        }
      />

      <div className="toolbar cat-toolbar">
        <Segmented
          value={dep}
          onChange={(v) => setQuery({ depto: v === deps[0]?.slug ? '' : v })}
          label="Departamento"
          options={deps.map((d) => ({
            value: d.slug,
            label: d.name,
            count: all.filter((c) => c.department === d.slug).length,
          }))}
        />
        {department && (
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditDep(department)}>
            Editar {department.name}
          </Button>
        )}
      </div>

      {department?.active === false && (
        <p className="small muted cat-note">
          <EyeOff aria-hidden="true" />
          El departamento {department.name} está oculto en la tienda: sus categorías no se ven hasta que lo vuelvas a
          mostrar.
        </p>
      )}

      {loading ? (
        <div className="cat-grid" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="cat-card sk" />
          ))}
        </div>
      ) : !list.length ? (
        <div className="card">
          <Empty
            icon={Shirt}
            title={`${department?.name || 'Este departamento'} aún no tiene categorías`}
            action={
              <Button variant="primary" icon={Plus} onClick={newCategory}>
                Crear categoría
              </Button>
            }
          >
            Por ejemplo: vestidos, blusas, shorts o pijamas. Cada una aparece como filtro en la tienda.
          </Empty>
        </div>
      ) : (
        <div className="cat-grid">
          {list.map((c, i) => {
            const n = counts[c.slug] || 0;
            return (
              <article key={c.slug} className={cx('cat-card', c.active === false && 'is-off')}>
                <button
                  type="button"
                  className="cat-card__cover"
                  onClick={() => setEditCat(c)}
                  aria-label={`Editar ${c.name}`}
                >
                  {c.image ? (
                    <img src={cdn(c.image, { w: 480 })} alt="" loading="lazy" />
                  ) : (
                    <span className="cat-card__ph">
                      <b aria-hidden="true">{c.name.slice(0, 1)}</b>
                      <small>
                        <ImagePlus aria-hidden="true" />
                        Agregar foto
                      </small>
                    </span>
                  )}
                  {c.active === false && (
                    <span className="cat-card__badge">
                      <Badge icon={EyeOff}>Oculta</Badge>
                    </span>
                  )}
                </button>
                <div className="cat-card__body">
                  <div className="cat-card__text">
                    <strong title={c.name}>{c.name}</strong>
                    <Link to={`/productos?cat=${c.slug}`}>{plural(n, 'producto', 'productos')}</Link>
                  </div>
                  <Menu
                    label={`Acciones de ${c.name}`}
                    items={[
                      { label: 'Editar', icon: Pencil, onClick: () => setEditCat(c) },
                      { label: 'Ver sus productos', icon: Shirt, onClick: () => navigate(`/productos?cat=${c.slug}`) },
                      {
                        label: 'Ver en la tienda',
                        icon: ExternalLink,
                        onClick: () => window.open(shopUrl(c), '_blank', 'noopener'),
                      },
                      '-',
                      i > 0 && { label: 'Mover antes', icon: ChevronLeft, onClick: () => void move(i, i - 1) },
                      i < list.length - 1 && {
                        label: 'Mover después',
                        icon: ChevronRight,
                        onClick: () => void move(i, i + 1),
                      },
                      list.length > 1 && '-',
                      { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => void remove(c) },
                    ]}
                  />
                </div>
              </article>
            );
          })}
          <button type="button" className="cat-card cat-card--add" onClick={newCategory}>
            <Plus aria-hidden="true" />
            Nueva categoría
            <small>en {department?.name || 'este departamento'}</small>
          </button>
        </div>
      )}

      {dep === 'mujer' && list.length > 0 && (
        <p className="small muted cat-note">
          Las categorías de Mujer también salen con su foto en «Compra por categoría» de la portada, en este mismo
          orden.
        </p>
      )}

      <CategorySheet
        cat={editCat}
        deps={deps}
        hasProducts={!!(editCat?.slug && counts[editCat.slug])}
        onClose={(saved) => {
          setEditCat(null);
          // Si la creó o la movió a otro departamento, se muestra ese departamento
          if (saved && saved.department !== dep)
            setQuery({ depto: saved.department === deps[0]?.slug ? '' : saved.department });
        }}
      />
      <DepartmentSheet dep={editDep} onClose={() => setEditDep(null)} />
    </main>
  );
}
