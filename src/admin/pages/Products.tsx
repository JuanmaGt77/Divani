/** Productos: catálogo con búsqueda, filtros, estado y acciones rápidas. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useStore } from '@nanostores/react';
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Shirt,
  Trash2,
} from 'lucide-react';
import { money, plural, relative } from '@/lib/format';
import { COLOR_FAMILIES, lowStockOf, productStock } from '@/lib/model';
import type { Product, ProductStatus, ProductVariant, ProductColor, Tone } from '@/lib/types';
import { api, type ProductPayload } from '../api';
import { exportCsv, fileStamp } from '../lib/csv';
import { matches, useIsMobile, useSort } from '../lib/hooks';
import { navigate, useSearch } from '../lib/navigation';
import { invalidate, useData } from '../lib/query';
import { settingsStore } from '../lib/session';
import { Button, SearchField, Segmented } from '../ui/controls';
import { confirmDialog, toast, toastError } from '../ui/overlays';
import { Badge, Card, Empty, Menu, PageHeader, SkeletonRows, Thumb, type MenuItem } from '../ui/surfaces';
import { SortTh } from '../ui/table';

export const STATUS: Record<ProductStatus, { label: string; tone: Tone }> = {
  activo: { label: 'Activo', tone: 'green' },
  borrador: { label: 'Borrador', tone: 'amber' },
  archivado: { label: 'Archivado', tone: 'gray' },
};

/** Existencias del producto: agotado, últimas piezas (≤ lastPieces) o el total. */
export function StockBadge({ product, lastPieces = 2 }: { product: Product; lastPieces?: number }) {
  const total = productStock(product);
  if (total <= 0) return <Badge tone="red">Agotado</Badge>;
  if (total <= lastPieces) return <Badge tone="amber">{total === 1 ? 'Última pieza' : `Últimas ${total}`}</Badge>;
  return <Badge outline>{plural(total, 'pieza', 'piezas')}</Badge>;
}

/** Datos para guardar un producto tal como está (cambiando solo lo indicado). */
export function productPayload(p: Product, patch: Partial<ProductPayload> = {}): ProductPayload {
  return {
    ...p,
    colors: p.colors.map((c) => ({ ...c, key: c.id })),
    variants: p.variants.map((v) => ({ ...v, colorKey: v.colorId })),
    ...patch,
  };
}

/** Copia editable de un producto (para duplicar). */
export function duplicatePayload(p: Product): ProductPayload {
  const keys = new Map(p.colors.map((c, i) => [c.id, `c${i}`]));
  return {
    name: `${p.name} (copia)`,
    department: p.department,
    category: p.category,
    description: p.description,
    details: p.details,
    material: p.material,
    care: p.care,
    origin: p.origin,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    cost: p.cost,
    tags: p.tags,
    isNew: p.isNew,
    isBestseller: false,
    isFeatured: false,
    status: 'borrador',
    colors: p.colors.map((c: ProductColor) => ({
      key: keys.get(c.id),
      name: c.name,
      hex: c.hex,
      family: c.family,
      images: c.images,
    })),
    variants: p.variants.map((v: ProductVariant) => ({
      colorKey: keys.get(v.colorId),
      size: v.size,
      stock: 0,
      minStock: v.minStock,
      active: v.active,
    })),
  };
}

export const familyName = (id: string): string => COLOR_FAMILIES.find((f) => f.id === id)?.name || id;

export default function Products() {
  const settings = useStore(settingsStore);
  const lowMin = settings?.private?.inventory?.lowStock ?? 0;
  const lastPieces = settings?.private?.inventory?.lastPieces ?? 2;
  const { data: products, loading } = useData(['products'], () => api.catalog.products(), ['products', 'inventory']);
  const { data: tax } = useData(['taxonomy'], () => api.catalog.taxonomy(), ['taxonomy']);
  const mobile = useIsMobile();
  const { query, setQuery } = useSearch();
  const [q, setQ] = useState(query.q || '');
  const status = query.estado || 'todos';
  const dep = query.depto || '';
  const cat = query.cat || '';
  const stock = query.stock || '';

  const catName = useMemo(
    () => Object.fromEntries((tax?.categories || []).map((c) => [c.slug, c.name])) as Record<string, string>,
    [tax],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: 0, activo: 0, borrador: 0, archivado: 0 };
    for (const p of products || []) {
      c.todos = (c.todos || 0) + 1;
      c[p.status] = (c[p.status] || 0) + 1;
    }
    return c;
  }, [products]);

  const filtered = useMemo(
    () =>
      (products || []).filter((p) => {
        if (status !== 'todos' && p.status !== status) return false;
        if (dep && p.department !== dep) return false;
        if (cat && p.category !== cat) return false;
        const total = productStock(p);
        if (stock === 'agotado' && total > 0) return false;
        if (
          stock === 'bajo' &&
          !(
            total > 0 &&
            (total <= lastPieces ||
              p.variants.some((v) => v.active !== false && v.minStock != null && v.stock <= lowStockOf(v, lowMin)))
          )
        ) {
          return false;
        }
        if (stock === 'con' && total <= 0) return false;
        return matches(
          q,
          p.name,
          p.code,
          p.tags,
          p.variants.map((v) => v.sku),
          p.colors.map((c) => c.name),
          p.category ? catName[p.category] : '',
        );
      }),
    [products, status, dep, cat, stock, q, catName, lastPieces, lowMin],
  );

  const { rows, sort, setSort } = useSort(
    filtered,
    { key: 'updated', dir: 'desc' },
    {
      updated: (p) => new Date(p.updatedAt || p.createdAt).getTime(),
      price: (p) => p.price,
      stock: (p) => productStock(p),
      name: (p) => p.name,
      cat: (p) => (p.category && catName[p.category]) || '',
    },
  );

  const setStatus = async (p: Product, next: ProductStatus) => {
    try {
      await api.catalog.save(productPayload(p, { status: next }));
      invalidate('products');
      toast({
        title:
          next === 'archivado'
            ? 'Producto archivado'
            : next === 'activo'
              ? 'Producto publicado'
              : 'Guardado como borrador',
        sub: p.name,
      });
    } catch (err) {
      toastError(err);
    }
  };
  const duplicate = async (p: Product) => {
    try {
      const copy = await api.catalog.save(duplicatePayload(p));
      invalidate('products');
      toast({ title: 'Producto duplicado', sub: 'Revisa la copia antes de publicarla.' });
      navigate(`/productos/${copy.id}`);
    } catch (err) {
      toastError(err);
    }
  };
  const remove = async (p: Product) => {
    const ok = await confirmDialog({
      title: `¿Eliminar «${p.name}»?`,
      message:
        'Se borra del catálogo y de la tienda. Los pedidos anteriores conservan sus datos. Si solo quieres ocultarlo, mejor archívalo.',
      confirm: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.catalog.remove(p.id);
      invalidate('products');
      toast({ title: 'Producto eliminado', sub: p.name });
    } catch (err) {
      toastError(err);
    }
  };
  const actions = (p: Product): MenuItem[] => [
    { label: 'Editar', icon: Pencil, onClick: () => navigate(`/productos/${p.id}`) },
    { label: 'Duplicar', icon: Copy, onClick: () => void duplicate(p) },
    p.status === 'activo' && {
      label: 'Ver en la tienda',
      icon: ExternalLink,
      onClick: () => window.open(`/producto/${encodeURIComponent(p.slug)}`, '_blank', 'noopener'),
    },
    '-',
    p.status !== 'activo' && { label: 'Publicar', icon: Eye, onClick: () => void setStatus(p, 'activo') },
    p.status === 'activo' && {
      label: 'Ocultar (borrador)',
      icon: EyeOff,
      onClick: () => void setStatus(p, 'borrador'),
    },
    p.status !== 'archivado'
      ? { label: 'Archivar', icon: Archive, onClick: () => void setStatus(p, 'archivado') }
      : { label: 'Restaurar', icon: ArchiveRestore, onClick: () => void setStatus(p, 'borrador') },
    { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => void remove(p) },
  ];

  const exportAll = () => {
    const out: { p: Product; v: ProductVariant; c: ProductColor | undefined }[] = [];
    for (const p of rows) for (const v of p.variants) out.push({ p, v, c: p.colors.find((x) => x.id === v.colorId) });
    exportCsv(`productos-${fileStamp()}`, out, [
      { label: 'Código', value: (r) => r.p.code },
      { label: 'Producto', value: (r) => r.p.name },
      { label: 'Departamento', value: (r) => r.p.department },
      { label: 'Categoría', value: (r) => (r.p.category && catName[r.p.category]) || '' },
      { label: 'Color', value: (r) => r.c?.name },
      { label: 'Talla', value: (r) => r.v.size },
      { label: 'SKU', value: (r) => r.v.sku },
      { label: 'Existencias', value: (r) => r.v.stock },
      { label: 'Precio', value: (r) => r.p.price },
      { label: 'Precio anterior', value: (r) => r.p.compareAtPrice || '' },
      { label: 'Costo', value: (r) => r.p.cost },
      { label: 'Estado', value: (r) => STATUS[r.p.status]?.label },
    ]);
  };

  const units = (products || []).reduce((a, p) => a + (p.status === 'archivado' ? 0 : productStock(p)), 0);
  const deps = tax?.departments || [];
  const cats = (tax?.categories || []).filter((c) => !dep || c.department === dep);
  const clearFilters = () => {
    setQ('');
    setQuery({ depto: '', cat: '', stock: '', q: '' });
  };

  return (
    <main className="page page--wide">
      <PageHeader
        title="Productos"
        sub={
          products
            ? `${plural(counts.activo || 0, 'producto publicado', 'productos publicados')} · ${plural(units, 'pieza', 'piezas')} en existencia`
            : 'Cargando catálogo…'
        }
        actions={
          <>
            <Button icon={Download} onClick={exportAll} disabled={!rows.length}>
              Exportar
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => navigate('/productos/nuevo')}>
              Nuevo producto
            </Button>
          </>
        }
      />

      <div className="toolbar">
        <SearchField
          value={q}
          onValue={(v) => {
            setQ(v);
            setQuery({ q: v });
          }}
          placeholder="Buscar por nombre, código, SKU o color"
        />
        <Segmented
          label="Estado"
          value={status}
          onChange={(v) => setQuery({ estado: v === 'todos' ? '' : v })}
          options={[
            { value: 'todos', label: 'Todos', count: counts.todos },
            { value: 'activo', label: 'Publicados', count: counts.activo },
            { value: 'borrador', label: 'Borradores', count: counts.borrador },
            { value: 'archivado', label: 'Archivados', count: counts.archivado },
          ]}
        />
      </div>
      <div className="toolbar">
        <select
          className="input input--sm filter-select"
          value={dep}
          onChange={(e) => setQuery({ depto: e.currentTarget.value, cat: '' })}
          aria-label="Departamento"
        >
          <option value="">Todos los departamentos</option>
          {deps.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          className="input input--sm filter-select"
          value={cat}
          onChange={(e) => setQuery({ cat: e.currentTarget.value })}
          aria-label="Categoría"
        >
          <option value="">Todas las categorías</option>
          {cats.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
              {dep ? '' : ` · ${deps.find((d) => d.slug === c.department)?.name || ''}`}
            </option>
          ))}
        </select>
        <select
          className="input input--sm filter-select"
          value={stock}
          onChange={(e) => setQuery({ stock: e.currentTarget.value })}
          aria-label="Existencias"
        >
          <option value="">Cualquier existencia</option>
          <option value="con">Con existencias</option>
          <option value="bajo">Últimas piezas</option>
          <option value="agotado">Agotados</option>
        </select>
        {(dep || cat || stock || q) && (
          <button type="button" className="link-btn small" onClick={clearFilters}>
            Quitar filtros
          </button>
        )}
        <span className="grow" />
        {products && <span className="muted small">{plural(rows.length, 'resultado', 'resultados')}</span>}
      </div>

      <Card bodyClass={false}>
        {loading ? (
          <SkeletonRows rows={8} />
        ) : !rows.length ? (
          <Empty
            icon={Shirt}
            title={products?.length ? 'Ningún producto coincide' : 'Aún no tienes productos'}
            action={
              products?.length ? (
                <Button
                  onClick={() => {
                    setQ('');
                    setQuery({ depto: '', cat: '', stock: '', q: '', estado: '' });
                  }}
                >
                  Ver todos
                </Button>
              ) : (
                <Button variant="primary" icon={Plus} onClick={() => navigate('/productos/nuevo')}>
                  Crear el primero
                </Button>
              )
            }
          >
            {products?.length
              ? 'Prueba con otra búsqueda o quita los filtros.'
              : 'Crea tu primer producto con sus fotos, tallas y existencias.'}
          </Empty>
        ) : mobile ? (
          <div className="list">
            {rows.map((p) => (
              <Link key={p.id} className="list__row" to={`/productos/${p.id}`} style={{ '--inset': '76px' }}>
                <Thumb src={p.colors[0]?.images?.[0]} size={46} />
                <span className="list__body">
                  <span className="list__title">{p.name}</span>
                  <span className="list__sub">
                    {money(p.price)} · {(p.category && catName[p.category]) || 'Sin categoría'}
                  </span>
                  <span className="row" style={{ '--gap': '6px', marginTop: '4px' }}>
                    <StockBadge product={p} lastPieces={lastPieces} />
                    {p.status !== 'activo' && <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>}
                  </span>
                </span>
                <ChevronRight className="list__chev" aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <SortTh label="Producto" k="name" sort={sort} setSort={setSort} />
                  <SortTh label="Categoría" k="cat" sort={sort} setSort={setSort} />
                  <th>Colores</th>
                  <SortTh label="Precio" k="price" sort={sort} setSort={setSort} num />
                  <SortTh label="Existencias" k="stock" sort={sort} setSort={setSort} />
                  <th>Estado</th>
                  <SortTh label="Actualizado" k="updated" sort={sort} setSort={setSort} />
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    className="is-link"
                    onClick={(e) => {
                      if (!(e.target as Element).closest('.menu-wrap')) navigate(`/productos/${p.id}`);
                    }}
                  >
                    <td>
                      <div className="cell-main">
                        <Thumb src={p.colors[0]?.images?.[0]} size={40} />
                        <div style={{ minWidth: 0 }}>
                          <div className="cell-title ellipsis">{p.name}</div>
                          <div className="cell-sub mono">{p.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="muted">{(p.category && catName[p.category]) || '—'}</td>
                    <td>
                      <div className="row" style={{ '--gap': '4px' }}>
                        {p.colors.slice(0, 5).map((c) => (
                          <span key={c.id} className="swatch" title={c.name} style={{ '--c': c.hex, '--s': '16px' }} />
                        ))}
                        {p.colors.length > 5 && <span className="xsmall muted">+{p.colors.length - 5}</span>}
                      </div>
                    </td>
                    <td className="num">
                      <strong className="strong">{money(p.price)}</strong>
                      {p.compareAtPrice ? (
                        <div className="cell-sub">
                          <s>{money(p.compareAtPrice)}</s>
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <StockBadge product={p} lastPieces={lastPieces} />
                    </td>
                    <td>
                      <Badge tone={STATUS[p.status].tone} dot>
                        {STATUS[p.status].label}
                      </Badge>
                    </td>
                    <td className="muted small">{relative(p.updatedAt || p.createdAt)}</td>
                    <td className="end">
                      <Menu items={actions(p)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}
