/** Hombre: un banner y cuatro prendas destacadas. Si el departamento no tiene prendas, no se muestra. */
import { useMemo } from 'react';
import { cdn } from '@/lib/model';
import { Emph, Icon } from '../../components/Icon';
import { CardSkeletons, ProductCard } from '../../components/ProductCard';
import { LoadError } from '../../components/LoadError';
import { DEFAULT_CONTENT, useContent } from '../../data/content';
import { listProducts, useStorefront } from '../../data/storefront';

export default function Men() {
  const content = useContent();
  const { data, status, retry } = useStorefront();
  const products = useMemo(
    () => (data ? listProducts(data, { department: 'hombre', sort: 'destacados', pageSize: 4 }).data : []),
    [data],
  );

  if (data && !products.length) return null;

  const title = content.get('men', 'title');
  const bannerTitle = content.get('men', 'bannerTitle');
  const image = content.get('men', 'image');

  return (
    <section className="section men" id="hombre" data-edit="men">
      <div className="container">
        <header className="section-head">
          <div className="section-head__text">
            <p className="eyebrow">Hombre</p>
            {title ? (
              <h2 className="h-2">
                <Emph text={title} />
              </h2>
            ) : null}
          </div>
          <a className="link" href="/tienda?depto=hombre">
            Ver todo hombre
            <Icon name="arrow-right" />
          </a>
        </header>
        <div className="men__grid">
          <a className="men__banner" href="/tienda?depto=hombre" data-reveal="" suppressHydrationWarning>
            {image ? (
              <img
                src={cdn(image, { w: 1000 })}
                alt={
                  image === DEFAULT_CONTENT.men?.image
                    ? 'Polo, camisa Oxford y chamarra de mezclilla colgados en un riel dorado'
                    : 'Ropa de hombre'
                }
                loading="lazy"
                width={800}
                height={1000}
              />
            ) : null}
            <span className="men__label glass">
              <span className="eyebrow eyebrow--plain">Para él</span>
              {bannerTitle ? <span className="men__title">{bannerTitle}</span> : null}
            </span>
          </a>
          <div className="men__products">
            {status === 'error' ? (
              <LoadError onRetry={retry} />
            ) : !data ? (
              <CardSkeletons count={4} />
            ) : (
              products.map((p, i) => <ProductCard key={p.slug} product={p} index={i} />)
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
