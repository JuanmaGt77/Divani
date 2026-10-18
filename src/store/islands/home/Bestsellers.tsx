/** Lo más deseado: carril con las prendas marcadas como «más vendidas» (o las más populares). */
import { useEffect, useMemo } from 'react';
import { CardSkeletons, ProductCard } from '../../components/ProductCard';
import { LoadError } from '../../components/LoadError';
import { Rail, RailArrows, useRail } from '../../components/Rail';
import { listProducts, useStorefront } from '../../data/storefront';

export default function Bestsellers() {
  const { data, status, retry } = useStorefront();
  const rail = useRail();
  const { reset } = rail;
  const products = useMemo(() => {
    if (!data) return [];
    const best = listProducts(data, { isBestseller: true, sort: 'populares', pageSize: 12 }).data;
    return best.length ? best : listProducts(data, { sort: 'populares', pageSize: 12 }).data;
  }, [data]);
  useEffect(() => reset(), [products, reset]);

  return (
    <section className="section" id="favoritas" data-edit="products">
      <div className="container">
        <header className="section-head">
          <div className="section-head__text">
            <p className="eyebrow">Las favoritas</p>
            <h2 className="h-2">
              Lo más <em>deseado</em>
            </h2>
          </div>
          <RailArrows rail={rail} />
        </header>
      </div>
      <Rail rail={rail}>
        {status === 'error' ? (
          <LoadError onRetry={retry} />
        ) : !data ? (
          <CardSkeletons count={5} />
        ) : (
          products.map((p, i) => <ProductCard key={p.slug} product={p} index={i} reveal={false} />)
        )}
      </Rail>
    </section>
  );
}
