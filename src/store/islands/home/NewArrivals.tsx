/** Lo nuevo en Divani: novedades con filtro por categoría. */
import { useMemo, useState } from 'react';
import { CardSkeletons, ProductCard } from '../../components/ProductCard';
import { LoadError } from '../../components/LoadError';
import { Segmented } from '../../components/Segmented';
import { listProducts, useStorefront } from '../../data/storefront';

const FILTERS = [
  { value: '', label: 'Todo' },
  { value: 'vestidos', label: 'Vestidos' },
  { value: 'blusas-y-tops', label: 'Tops' },
  { value: 'jeans-y-pantalones', label: 'Pantalones' },
  { value: 'abrigos-y-chamarras', label: 'Abrigos' },
];

export default function NewArrivals() {
  const { data, status, retry } = useStorefront();
  const [cat, setCat] = useState('');
  const products = useMemo(
    () => (data ? listProducts(data, { category: cat, sort: 'nuevo', pageSize: 8 }).data : []),
    [data, cat],
  );

  return (
    <section className="section section--linen" id="novedades" data-edit="products">
      <div className="container">
        <header className="section-head">
          <div className="section-head__text">
            <p className="eyebrow">Recién llegado</p>
            <h2 className="h-2">
              Lo <em>nuevo</em> en Divani
            </h2>
          </div>
          <Segmented scroll label="Filtrar novedades" value={cat} onChange={setCat} options={FILTERS} />
        </header>
        <div className="product-grid" aria-live="polite">
          {status === 'error' ? (
            <LoadError onRetry={retry} />
          ) : !data ? (
            <CardSkeletons count={8} />
          ) : (
            products.map((p, i) => <ProductCard key={p.slug} product={p} index={i} />)
          )}
        </div>
        <div className="section-cta">
          <a className="btn btn--outline" href="/tienda?orden=nuevo">
            Ver todas las novedades
          </a>
        </div>
      </div>
    </section>
  );
}
