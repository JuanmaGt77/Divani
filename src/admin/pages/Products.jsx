/** Productos: catálogo con búsqueda, filtros, estado y acciones rápidas. */
import { useMemo, useState } from 'preact/hooks';
import { Plus, Download, Pencil, Copy, ExternalLink, Archive, ArchiveRestore, Trash2, Shirt, Eye, EyeOff, ChevronRight } from 'lucide-preact';
import { api } from '../api/index.js';
import { useQuery, invalidate } from '../lib/query.js';
import { navigate, href, setQuery } from '../lib/router.js';
import { money, number, relative, plural } from '../lib/format.js';
import { useSort, matches, useIsMobile } from '../lib/hooks.js';
import { exportCsv, fileStamp } from '../lib/csv.js';
import { productStock, lowStockOf, COLOR_FAMILIES } from '../../backend/model.js';
import { useStore } from '../lib/store.js';
import { settingsStore } from '../lib/session.js';
import { PageHeader, Card, Badge, Thumb, Empty, SkeletonRows, Menu } from '../ui/surfaces.jsx';
import { Button, SearchField, Segmented } from '../ui/controls.jsx';
import { SortTh } from '../ui/table.jsx';
import { toast, toastError, confirmDialog } from '../ui/overlays.jsx';

const STATUS = { activo: { label: 'Activo', tone: 'green' }, borrador: { label: 'Borrador', tone: 'amber' }, archivado: { label: 'Archivado', tone: 'gray' } };

/** Existencias del producto: agotado, últimas piezas (≤ lastPieces) o el total. */
export function stockBadge(p, lastPieces = 2) {
  const total = productStock(p);
  if (total <= 0) return <Badge tone="red">Agotado</Badge>;
  if (total <= lastPieces) return <Badge tone="amber">{total === 1 ? 'Última pieza' : `Últimas ${total}`}</Badge>;
  return <Badge outline>{plural(total, 'pieza', 'piezas')}</Badge>;
}

/** Copia editable de un producto (para duplicar). */
export function duplicatePayload(p) {
  const keys = new Map(p.colors.map((c, i) => [c.id, `c${i}`]));
  return {
    name: `${p.name} (copia)`, department: p.department, category: p.category, description: p.description, details: p.details,
    material: p.material, care: p.care, origin: p.origin, price: p.price, compareAtPrice: p.compareAtPrice, cost: p.cost, tags: p.tags,
    isNew: p.isNew, isBestseller: false, isFeatured: false, status: 'borrador',
    colors: p.colors.map((c) => ({ key: keys.get(c.id), name: c.name, hex: c.hex, family: c.family, images: c.images })),
    variants: p.variants.map((v) => ({ colorKey: keys.get(v.colorId), size: v.size, stock: 0, minStock: v.minStock, active: v.active })),
  };
}

export default function Products({ query }) {
  const settings = useStore(settingsStore);
  const lowMin = settings?.private?.inventory?.lowStock ?? 0;
  const lastPieces = settings?.private?.inventory?.lastPieces ?? 2;
  const { data: products, loading } = useQuery('products', () => api.catalog.products(), ['products', 'inventory']);
  const { data: tax } = useQuery('taxonomy', () => api.catalog.taxonomy(), ['taxonomy']);
  const mobile = useIsMobile();
  const [q, setQ] = useState(query.q || '');
  const status = query.estado || 'todos';
  const dep = query.depto || '';
  const cat = query.cat || '';
  const stock = query.stock || '';

  const catName = useMemo(() => Object.fromEntries((tax?.categories || []).map((c) => [c.slug, c.name])), [tax]);
  const counts = useMemo(() => {
    const c = { todos: 0, activo: 0, borrador: 0, archivado: 0 };
    for (const p of products || []) { c.todos++; c[p.status]++; }
    return c;
  }, [products]);

  const filtered = useMemo(() => (products || []).filter((p) => {
    if (status !== 'todos' && p.status !== status) return false;
    if (dep && p.department !== dep) return false;
    if (cat && p.category !== cat) return false;
    const total = productStock(p);
    if (stock === 'agotado' && total > 0) return false;
    if (stock === 'bajo' && !(total > 0 && (total <= lastPieces || p.variants.some((v) => v.active !== false && v.minStock != null && v.stock <= lowStockOf(v, lowMin))))) return false;
    if (stock === 'con' && total <= 0) return false;
    return matches(q, p.name, p.code, p.tags, p.variants.map((v) => v.sku), p.colors.map((c) => c.name), catName[p.category]);
  }), [products, status, dep, cat, stock, q, catName]);

  const { rows, sort, setSort } = useSort(filtered, { key: 'updated', dir: 'desc' }, {
    updated: (p) => new Date(p.updatedAt || p.createdAt).getTime(),
    price: (p) => p.price,
    stock: (p) => productStock(p),
    name: (p) => p.name,
    cat: (p) => catName[p.category] || '',
  });

  const setStatus = async (p, next) => {
    try {
      await api.catalog.save({ ...p, status: next, colors: p.colors.map((c) => ({ ...c, key: c.id })), variants: p.variants.map((v) => ({ ...v, colorKey: v.colorId })) });
      invalidate('products');
      toast({ title: next === 'archivado' ? 'Producto archivado' : next === 'activo' ? 'Producto publicado' : 'Guardado como borrador', sub: p.name });
    } catch (err) { toastError(err); }
  };
  const duplicate = async (p) => {
    try {
      const copy = await api.catalog.save(duplicatePayload(p));
      invalidate('products');
      toast({ title: 'Producto duplicado', sub: 'Revisa la copia antes de publicarla.' });
      navigate(`/productos/${copy.id}`);
    } catch (err) { toastError(err); }
  };
  const remove = async (p) => {
    const ok = await confirmDialog({ title: `¿Eliminar «${p.name}»?`, message: 'Se borra del catálogo y de la tienda. Los pedidos anteriores conservan sus datos. Si solo quieres ocultarlo, mejor archívalo.', confirm: 'Eliminar', danger: true });
    if (!ok) return;
    try {
      await api.catalog.remove(p.id);
      invalidate('products');
      toast({ title: 'Producto eliminado', sub: p.name });
    } catch (err) { toastError(err); }
  };
  const actions = (p) => [
    { label: 'Editar', icon: Pencil, onClick: () => navigate(`/productos/${p.id}`) },
    { label: 'Duplicar', icon: Copy, onClick: () => duplicate(p) },
    p.status === 'activo' && { label: 'Ver en la tienda', icon: ExternalLink, onClick: () => window.open(`tienda.html?p=${encodeURIComponent(p.slug)}`, '_blank', 'noopener') },
    '-',
    p.status !== 'activo' && { label: 'Publicar', icon: Eye, onClick: () => setStatus(p, 'activo') },
    p.status === 'activo' && { label: 'Ocultar (borrador)', icon: EyeOff, onClick: () => setStatus(p, 'borrador') },
    p.status !== 'archivado' ? { label: 'Archivar', icon: Archive, onClick: () => setStatus(p, 'archivado') } : { label: 'Restaurar', icon: ArchiveRestore, onClick: () => setStatus(p, 'borrador') },
    { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => remove(p) },
  ];

  const exportAll = () => {
    const out = [];
    for (const p of rows) {
      for (const v of p.variants) {
        const c = p.colors.find((x) => x.id === v.colorId);
        out.push({ p, v, c });
      }
    }
    exportCsv(`productos-${fileStamp()}`, out, [
      { label: 'Código', value: (r) => r.p.code },
      { label: 'Producto', value: (r) => r.p.name },
      { label: 'Departamento', value: (r) => r.p.department },
      { label: 'Categoría', value: (r) => catName[r.p.category] || '' },
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

  return (
    <main class="page page--wide">
      <PageHeader
        title="Productos"
        sub={products ? `${plural(counts.activo, 'producto publicado', 'productos publicados')} · ${number(units)} piezas en existencia` : 'Cargando catálogo…'}
        actions={(
          <>
            <Button icon={Download} onClick={exportAll} disabled={!rows.length}>Exportar</Button>
            <Button variant="primary" icon={Plus} onClick={() => navigate('/productos/nuevo')}>Nuevo producto</Button>
          </>
        )}
      />

      <div class="toolbar">
        <SearchField value={q} onValue={(v) => { setQ(v); setQuery({ q: v }); }} placeholder="Buscar por nombre, código, SKU o color" />
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
      <div class="toolbar">
        <select class="input input--sm filter-select" value={dep} onChange={(e) => setQuery({ depto: e.currentTarget.value, cat: '' })} aria-label="Departamento">
          <option value="">Todos los departamentos</option>
          {deps.map((d) => <option value={d.slug}>{d.name}</option>)}
        </select>
        <select class="input input--sm filter-select" value={cat} onChange={(e) => setQuery({ cat: e.currentTarget.value })} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {cats.map((c) => <option value={c.slug}>{c.name}{dep ? '' : ` · ${deps.find((d) => d.slug === c.department)?.name || ''}`}</option>)}
        </select>
        <select class="input input--sm filter-select" value={stock} onChange={(e) => setQuery({ stock: e.currentTarget.value })} aria-label="Existencias">
          <option value="">Cualquier existencia</option>
          <option value="con">Con existencias</option>
          <option value="bajo">Últimas piezas</option>
          <option value="agotado">Agotados</option>
        </select>
        {(dep || cat || stock || q) && <button type="button" class="link-btn small" onClick={() => { setQ(''); setQuery({ depto: '', cat: '', stock: '', q: '' }); }}>Quitar filtros</button>}
        <span class="grow" />
        {products && <span class="muted small">{plural(rows.length, 'resultado', 'resultados')}</span>}
      </div>

      <Card bodyClass={false}>
        {loading ? <SkeletonRows rows={8} /> : !rows.length ? (
          <Empty
            icon={Shirt}
            title={products?.length ? 'Ningún producto coincide' : 'Aún no tienes productos'}
            action={products?.length
              ? <Button onClick={() => { setQ(''); setQuery({ depto: '', cat: '', stock: '', q: '', estado: '' }); }}>Ver todos</Button>
              : <Button variant="primary" icon={Plus} onClick={() => navigate('/productos/nuevo')}>Crear el primero</Button>}
          >
            {products?.length ? 'Prueba con otra búsqueda o quita los filtros.' : 'Crea tu primer producto con sus fotos, tallas y existencias.'}
          </Empty>
        ) : mobile ? (
          <div class="list">
            {rows.map((p) => (
              <a class="list__row" href={href(`/productos/${p.id}`)} style={{ '--inset': '76px' }}>
                <Thumb src={p.colors[0]?.images?.[0]} size={46} />
                <span class="list__body">
                  <span class="list__title">{p.name}</span>
                  <span class="list__sub">{money(p.price)} · {catName[p.category] || 'Sin categoría'}</span>
                  <span class="row" style={{ '--gap': '6px', marginTop: '4px' }}>
                    {stockBadge(p, lastPieces)}
                    {p.status !== 'activo' && <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>}
                  </span>
                </span>
                <ChevronRight class="list__chev" aria-hidden="true" />
              </a>
            ))}
          </div>
        ) : (
          <div class="table-wrap">
            <table class="table">
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
                  <tr class="is-link" onClick={(e) => { if (!e.target.closest('.menu-wrap')) navigate(`/productos/${p.id}`); }}>
                    <td>
                      <div class="cell-main">
                        <Thumb src={p.colors[0]?.images?.[0]} size={40} />
                        <div style={{ minWidth: 0 }}>
                          <div class="cell-title ellipsis">{p.name}</div>
                          <div class="cell-sub mono">{p.code}</div>
                        </div>
                      </div>
                    </td>
                    <td class="muted">{catName[p.category] || '—'}</td>
                    <td>
                      <div class="row" style={{ '--gap': '4px' }}>
                        {p.colors.slice(0, 5).map((c) => <span class="swatch" title={c.name} style={{ '--c': c.hex, '--s': '16px' }} />)}
                        {p.colors.length > 5 && <span class="xsmall muted">+{p.colors.length - 5}</span>}
                      </div>
                    </td>
                    <td class="num">
                      <strong class="strong">{money(p.price)}</strong>
                      {p.compareAtPrice ? <div class="cell-sub"><s>{money(p.compareAtPrice)}</s></div> : null}
                    </td>
                    <td>{stockBadge(p, lastPieces)}</td>
                    <td><Badge tone={STATUS[p.status].tone} dot>{STATUS[p.status].label}</Badge></td>
                    <td class="muted small">{relative(p.updatedAt || p.createdAt)}</td>
                    <td class="end"><Menu items={actions(p)} /></td>
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

export const familyName = (id) => COLOR_FAMILIES.find((f) => f.id === id)?.name || id;
