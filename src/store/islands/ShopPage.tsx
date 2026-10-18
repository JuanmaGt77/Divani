/**
 * Tienda (/tienda): catálogo con departamentos, categorías, filtros, orden, búsqueda y «cargar más».
 * El estado vive en la URL para que los enlaces se puedan compartir (?depto=mujer&cat=vestidos…).
 */
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { moneyR, plural } from '@/lib/format';
import { sizeRank } from '@/lib/model';
import { Icon } from '../components/Icon';
import { CardSkeletons, ProductCard } from '../components/ProductCard';
import { LoadError } from '../components/LoadError';
import { Segmented } from '../components/Segmented';
import { Sheet } from '../components/Sheet';
import { listProducts, useSettings, useStorefront } from '../data/storefront';
import { CATALOG } from '../lib/product';
import { DEPARTMENT_LINKS, visibleDepartments } from '../lib/site';
import { getParams, listParam, setParams } from '../lib/url';
import { greetingMessage, waLink } from '../lib/whatsapp';
import { $sheet, closeSheet, openSheet } from '../state/ui';

interface ShopState {
  depto: string;
  cat: string[];
  talla: string[];
  color: string[];
  min: string;
  max: string;
  oferta: boolean;
  nuevo: boolean;
  disponible: boolean;
  q: string;
  orden: string;
}

const EMPTY: ShopState = {
  depto: '',
  cat: [],
  talla: [],
  color: [],
  min: '',
  max: '',
  oferta: false,
  nuevo: false,
  disponible: false,
  q: '',
  orden: 'destacados',
};

const SORT_OPTIONS = [
  ['destacados', 'Destacados'],
  ['nuevo', 'Lo más nuevo'],
  ['populares', 'Más pedidos'],
  ['precio-asc', 'Precio: menor a mayor'],
  ['precio-desc', 'Precio: mayor a menor'],
] as const;

const SWITCHES = [
  ['oferta', 'Solo ofertas'],
  ['nuevo', 'Solo novedades'],
  ['disponible', 'Ocultar agotados'],
] as const;

const DEFAULT_DESC = 'Ropa americana premium para toda la familia.';

const digits = (v: string | null) => (v || '').replace(/\D/g, '');

function readState(): ShopState {
  const p = getParams();
  return {
    depto: p.get('depto') || '',
    cat: listParam(p, 'cat'),
    talla: listParam(p, 'talla'),
    color: listParam(p, 'color'),
    min: digits(p.get('min')),
    max: digits(p.get('max')),
    oferta: p.get('oferta') === '1',
    nuevo: p.get('nuevo') === '1',
    disponible: p.get('disponible') === '1',
    q: (p.get('q') || '').trim(),
    orden: p.get('orden') || 'destacados',
  };
}

const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

interface PriceRange {
  label: string;
  min: string;
  max: string;
}

/** Rangos de precio «redondos» a partir de los precios de la tienda (sirven para cualquier moneda). */
function priceRanges(min: number, max: number): PriceRange[] {
  if (!(max > min)) return [];
  const nice = (n: number) => {
    const step = 10 ** Math.floor(Math.log10(Math.max(1, n))) / 2;
    return Math.max(step, Math.round(n / step) * step);
  };
  const cuts = [...new Set([0.25, 0.5, 0.75].map((f) => nice(min + (max - min) * f)))]
    .filter((c) => c > min && c < max)
    .sort((a, b) => a - b);
  if (!cuts.length) return [];
  const first = cuts[0] as number;
  const last = cuts[cuts.length - 1] as number;
  return [
    { label: `Menos de ${moneyR(first)}`, min: '', max: String(first - 1) },
    ...cuts
      .slice(1)
      .map((c, i) => ({ label: `${moneyR(cuts[i])} a ${moneyR(c)}`, min: String(cuts[i]), max: String(c) })),
    { label: `Más de ${moneyR(last)}`, min: String(last), max: '' },
  ];
}

export default function ShopPage() {
  const { data, status, retry } = useStorefront();
  const settings = useSettings();
  const sheet = useStore($sheet);
  const [state, setState] = useState<ShopState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState(1);

  // El estado sale de la URL (solo existe en el navegador: el HTML generado muestra «Toda la tienda»)
  useEffect(() => {
    setState(readState());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    setParams({
      depto: state.depto,
      cat: state.cat,
      talla: state.talla,
      color: state.color,
      min: state.min,
      max: state.max,
      oferta: state.oferta && '1',
      nuevo: state.nuevo && '1',
      disponible: state.disponible && '1',
      q: state.q,
      orden: state.orden === 'destacados' ? '' : state.orden,
    });
  }, [state, ready]);

  const update = (patch: Partial<ShopState>) => {
    setState((s) => ({ ...s, ...patch }));
    setPage(1);
  };

  const result = useMemo(() => {
    if (!data || !ready) return null;
    const query = {
      department: state.depto,
      category: state.cat,
      size: state.talla,
      color: state.color,
      minPrice: state.min,
      maxPrice: state.max,
      onSale: state.oferta,
      isNew: state.nuevo,
      inStock: state.disponible,
      q: state.q,
      sort: state.orden,
      pageSize: CATALOG.pageSize,
    };
    const first = listProducts(data, { ...query, page: 1 });
    const items = [first.data];
    for (let i = 2; i <= Math.min(page, first.meta.pages); i++)
      items.push(listProducts(data, { ...query, page: i }).data);
    return { items: items.flat(), total: first.meta.total, facets: first.facets };
  }, [data, ready, state, page]);

  /* ---------- encabezado ---------- */
  const categories = data?.categories || [];
  const catBySlug = (slug: string | undefined) => categories.find((c) => c.slug === slug);
  const dept = data?.departments.find((d) => d.slug === state.depto);
  const deptName = dept?.name || DEPARTMENT_LINKS.find((d) => d.slug === state.depto)?.label || '';
  const cat = state.cat.length === 1 ? catBySlug(state.cat[0]) : undefined;

  let title = 'Toda la tienda';
  let desc = DEFAULT_DESC;
  if (state.q) {
    title = `«${state.q}»`;
    desc = 'Resultados de tu búsqueda.';
  } else if (cat) {
    title = cat.name;
    desc = cat.description || dept?.description || desc;
  } else if (deptName) {
    title = deptName;
    desc = dept?.description || desc;
  } else if (state.oferta) {
    title = 'Ofertas';
    desc = 'Piezas seleccionadas con precio especial, mientras haya existencias.';
  } else if (state.orden === 'nuevo') {
    title = 'Novedades';
    desc = 'Lo último que llegó a Divani.';
  }
  const crumbs = [deptName, cat?.name, state.q && 'Búsqueda'].filter(Boolean).join(' / ');
  const storeName = settings.store?.name || 'Divani';

  useEffect(() => {
    if (ready) document.title = `${state.q ? `Búsqueda: ${state.q}` : title} · ${storeName}`;
  }, [ready, state.q, title, storeName]);

  /* ---------- chips, filtros activos y acciones ---------- */
  const facets = result?.facets || { categories: {}, sizes: {}, colors: {}, price: { min: 0, max: 0 } };
  const chipCats = categories.filter((c) => c.department === (state.depto || 'mujer'));
  const onChip = (slug: string) => {
    if (!slug) update({ cat: [] });
    else update({ cat: toggleIn(state.cat, slug), depto: state.depto || catBySlug(slug)?.department || '' });
  };
  const chips = (
    <>
      <button className="chip" type="button" aria-pressed={!state.cat.length} onClick={() => onChip('')}>
        Todo
      </button>
      {chipCats.map((c) => (
        <button
          key={c.slug}
          className="chip"
          type="button"
          aria-pressed={state.cat.includes(c.slug)}
          onClick={() => onChip(c.slug)}
        >
          {c.name}
          {facets.categories[c.slug] ? <span className="chip__count">{facets.categories[c.slug]}</span> : null}
        </button>
      ))}
    </>
  );

  const families = data?.colorFamilies || [];
  const pills: { key: string; label: string; remove: () => void }[] = [];
  if (state.q) pills.push({ key: 'q', label: `Búsqueda: ${state.q}`, remove: () => update({ q: '' }) });
  for (const c of state.cat)
    pills.push({
      key: `c-${c}`,
      label: catBySlug(c)?.name || c,
      remove: () => update({ cat: state.cat.filter((x) => x !== c) }),
    });
  for (const t of state.talla)
    pills.push({
      key: `t-${t}`,
      label: `Talla ${t}`,
      remove: () => update({ talla: state.talla.filter((x) => x !== t) }),
    });
  for (const c of state.color) {
    pills.push({
      key: `k-${c}`,
      label: families.find((f) => f.id === c)?.name || c,
      remove: () => update({ color: state.color.filter((x) => x !== c) }),
    });
  }
  if (state.min || state.max) {
    const label =
      state.min && state.max
        ? `${moneyR(state.min)} – ${moneyR(state.max)}`
        : state.min
          ? `Desde ${moneyR(state.min)}`
          : `Hasta ${moneyR(state.max)}`;
    pills.push({ key: 'precio', label, remove: () => update({ min: '', max: '' }) });
  }
  if (state.oferta) pills.push({ key: 'oferta', label: 'En oferta', remove: () => update({ oferta: false }) });
  if (state.nuevo) pills.push({ key: 'nuevo', label: 'Novedades', remove: () => update({ nuevo: false }) });
  if (state.disponible)
    pills.push({ key: 'disponible', label: 'Disponibles', remove: () => update({ disponible: false }) });

  const filterCount =
    state.cat.length +
    state.talla.length +
    state.color.length +
    (state.min || state.max ? 1 : 0) +
    +state.oferta +
    +state.nuevo +
    +state.disponible;
  const clearAll = () => update({ ...EMPTY, depto: state.depto, orden: state.orden });
  const clearFilters = () => update({ ...EMPTY, depto: state.depto, orden: state.orden, q: state.q });

  /* ---------- hoja de filtros ---------- */
  const filterCats = (state.depto ? categories.filter((c) => c.department === state.depto) : categories).filter(
    (c) => facets.categories[c.slug],
  );
  const sizes = Object.keys(facets.sizes).sort((a, b) => sizeRank(a) - sizeRank(b));
  const colors = families.filter((c) => facets.colors[c.id]);
  const ranges = priceRanges(facets.price.min, facets.price.max);
  const deptLabel = (slug: string) => data?.departments.find((d) => d.slug === slug)?.name || '';
  const closeFilters = () => closeSheet('filters');

  const deptOptions = [
    { value: '', label: 'Todo' },
    ...visibleDepartments(data).map((d) => ({ value: d.slug, label: d.label })),
  ];
  const shown = result?.items.length || 0;

  return (
    <>
      <section className="container shop-hero">
        <nav className="crumbs" aria-label="Ruta de navegación">
          <a href="/">Inicio</a>
          <span aria-hidden="true">/</span>
          <a href="/tienda">Tienda</a>
          {crumbs ? (
            <>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{crumbs}</span>
            </>
          ) : null}
        </nav>
        <div className="shop-hero__row">
          <div>
            <h1 className={state.q ? 'shop-hero__title is-query' : 'shop-hero__title'}>{title}</h1>
            <div className="shop-hero__meta">
              <p className="shop-hero__desc">{desc}</p>
              <p className="shop-hero__count" aria-live="polite">
                {result ? plural(result.total, 'pieza', 'piezas') : ''}
              </p>
            </div>
          </div>
          <Segmented
            scroll
            label="Departamento"
            value={state.depto}
            options={deptOptions}
            onChange={(v) => update({ depto: v, cat: [], talla: [] })}
          />
        </div>
        <div className="scroller shop-cats-mobile">{chips}</div>
      </section>

      <div className="shop-bar">
        <div className="container shop-bar__inner">
          <div className="shop-bar__glass glass glass--strong">
            <div className="scroller shop-bar__cats">{chips}</div>
            <div className="shop-bar__actions">
              <button
                className="btn btn--sm btn--outline filter-btn"
                type="button"
                onClick={() => openSheet('filters')}
              >
                <Icon name="filter" />
                Filtros
                <span className="count-badge" data-count={filterCount}>
                  {filterCount || ''}
                </span>
              </button>
              <label className="sort">
                <span className="visually-hidden">Ordenar por</span>
                <select id="shop-sort" value={state.orden} onChange={(e) => update({ orden: e.target.value })}>
                  {SORT_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <Icon name="chevron-down" />
              </label>
            </div>
          </div>
        </div>
      </div>

      <section className="container shop-body" aria-label="Productos">
        <div className="active-filters">
          {pills.length ? (
            <>
              {pills.map((p) => (
                <button key={p.key} className="chip" type="button" onClick={p.remove} aria-label={`Quitar ${p.label}`}>
                  {p.label}
                  <Icon name="close" />
                </button>
              ))}
              <button className="link" type="button" onClick={clearAll}>
                Limpiar todo
              </button>
            </>
          ) : null}
        </div>
        <div className="product-grid" aria-live="polite">
          {status === 'error' ? (
            <LoadError
              onRetry={retry}
              message="No pudimos cargar el catálogo. Revisa tu conexión e inténtalo de nuevo."
            />
          ) : !result ? (
            <CardSkeletons count={8} />
          ) : result.total ? (
            result.items.map((p, i) => <ProductCard key={p.slug} product={p} index={i % CATALOG.pageSize} />)
          ) : (
            <div className="shop-empty" style={{ gridColumn: '1/-1' }}>
              <span className="empty__icon glass round">
                <Icon name="search" />
              </span>
              <h2>No encontramos prendas con esos filtros</h2>
              <p>
                Prueba quitando algún filtro o explora otra categoría. También puedes preguntarnos por WhatsApp: con
                gusto te ayudamos a encontrar lo que buscas.
              </p>
              <div className="cluster" style={{ justifyContent: 'center' }}>
                <button className="btn btn--ink" type="button" onClick={clearAll}>
                  Limpiar filtros
                </button>
                <a
                  className="btn btn--outline btn--wa"
                  href={waLink(settings, greetingMessage(settings))}
                  target="_blank"
                  rel="noopener"
                >
                  <Icon name="whatsapp" />
                  Preguntar por WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>
        {result && result.total > CATALOG.pageSize ? (
          <div className="shop-more">
            <p className="small muted">
              Mostrando {shown} de {result.total}
            </p>
            <div className="shop-more__bar" aria-hidden="true">
              <span style={{ '--p': (shown / result.total).toFixed(3) }} />
            </div>
            {shown < result.total ? (
              <button className="btn btn--outline" type="button" onClick={() => setPage((n) => n + 1)}>
                Cargar más prendas
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <Sheet
        id="filters"
        open={sheet === 'filters'}
        onClose={closeFilters}
        variant="side"
        labelledBy="filters-title"
        grabber
      >
        <header className="sheet__head">
          <h2 className="sheet__title" id="filters-title">
            Filtros
          </h2>
          <button className="icon-btn glass round" type="button" onClick={closeFilters} aria-label="Cerrar filtros">
            <Icon name="close" />
          </button>
        </header>
        <form className="filters" onSubmit={(e) => e.preventDefault()}>
          {filterCats.length ? (
            <div className="filters__group">
              <p className="filters__title">Categoría</p>
              <div className="filters__chips">
                {filterCats.map((c) => (
                  <button
                    key={c.slug}
                    className="chip"
                    type="button"
                    aria-pressed={state.cat.includes(c.slug)}
                    onClick={() => update({ cat: toggleIn(state.cat, c.slug) })}
                  >
                    {c.name}
                    {!state.depto && c.department !== 'mujer' ? ` · ${deptLabel(c.department)}` : ''}
                    <span className="chip__count">{facets.categories[c.slug]}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {sizes.length ? (
            <div className="filters__group">
              <p className="filters__title">Talla</p>
              <div className="filters__chips">
                {sizes.map((s) => (
                  <button
                    key={s}
                    className="chip"
                    type="button"
                    aria-pressed={state.talla.includes(s)}
                    onClick={() => update({ talla: toggleIn(state.talla, s) })}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {colors.length ? (
            <div className="filters__group">
              <p className="filters__title">Color</p>
              <div className="filters__chips">
                {colors.map((c) => (
                  <button
                    key={c.id}
                    className="chip color-chip"
                    type="button"
                    aria-pressed={state.color.includes(c.id)}
                    onClick={() => update({ color: toggleIn(state.color, c.id) })}
                  >
                    <span
                      className={c.hex === 'pattern' ? 'swatch swatch--pattern' : 'swatch'}
                      style={c.hex === 'pattern' ? undefined : { '--c': c.hex }}
                    />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="filters__group">
            <p className="filters__title">Precio</p>
            {ranges.length ? (
              <div className="filters__chips">
                {ranges.map((r) => {
                  const on = state.min === r.min && state.max === r.max;
                  return (
                    <button
                      key={r.label}
                      className="chip"
                      type="button"
                      aria-pressed={on}
                      onClick={() => update(on ? { min: '', max: '' } : { min: r.min, max: r.max })}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="price-inputs">
              <label className="visually-hidden" htmlFor="f-min">
                Precio mínimo
              </label>
              <input
                className="input"
                id="f-min"
                type="number"
                inputMode="numeric"
                min={0}
                step={50}
                placeholder={result ? `Mín. ${moneyR(facets.price.min)}` : 'Mínimo'}
                value={state.min}
                onChange={(e) => update({ min: digits(e.target.value) })}
              />
              <span>—</span>
              <label className="visually-hidden" htmlFor="f-max">
                Precio máximo
              </label>
              <input
                className="input"
                id="f-max"
                type="number"
                inputMode="numeric"
                min={0}
                step={50}
                placeholder={result ? `Máx. ${moneyR(facets.price.max)}` : 'Máximo'}
                value={state.max}
                onChange={(e) => update({ max: digits(e.target.value) })}
              />
            </div>
          </div>
          <div className="filters__group">
            <p className="filters__title">Mostrar</p>
            {SWITCHES.map(([key, label]) => (
              <label key={key} className="switch-row" htmlFor={`f-${key}`}>
                <span>{label}</span>
                <span className="switch">
                  <input
                    type="checkbox"
                    id={`f-${key}`}
                    checked={state[key]}
                    onChange={(e) => update({ [key]: e.target.checked } as Partial<ShopState>)}
                  />
                  <span />
                </span>
              </label>
            ))}
          </div>
        </form>
        <footer className="filters__foot">
          <button className="btn btn--outline" type="button" onClick={clearFilters}>
            Limpiar
          </button>
          <button className="btn btn--ink" type="button" onClick={closeFilters}>
            {!result
              ? 'Ver resultados'
              : result.total
                ? `Ver ${plural(result.total, 'resultado', 'resultados')}`
                : 'Sin resultados'}
          </button>
        </footer>
      </Sheet>
    </>
  );
}
