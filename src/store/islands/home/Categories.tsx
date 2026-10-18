/** Compra por categoría: mosaico con las categorías de Mujer, novedades y ofertas. */
import { useMemo } from 'react';
import { plural } from '@/lib/format';
import { cdn } from '@/lib/model';
import { Icon } from '../../components/Icon';
import { LoadError } from '../../components/LoadError';
import { listProducts, useStorefront } from '../../data/storefront';
import { discountPct } from '../../lib/product';

export default function Categories() {
  const { data, status, retry } = useStorefront();
  const women = useMemo(() => (data?.categories || []).filter((c) => c.department === 'mujer'), [data]);
  const sale = useMemo(() => (data ? listProducts(data, { onSale: true, pageSize: 100 }).data : []), [data]);
  // El mosaico de rebajas dice el descuento real más alto (o invita a lo más deseado si no hay ofertas)
  const maxPct = Math.max(0, ...sale.map(discountPct));

  return (
    <section className="section" id="categorias" data-edit="categories">
      <div className="container">
        <header className="section-head">
          <div className="section-head__text">
            <p className="eyebrow">Compra por categoría</p>
            <h2 className="h-2">
              Encuentra <em>tu estilo</em>
            </h2>
          </div>
          <a className="link" href="/tienda?depto=mujer">
            Ver toda la colección
            <Icon name="arrow-right" />
          </a>
        </header>
        {status === 'error' ? (
          <div className="bento">
            <LoadError onRetry={retry} />
          </div>
        ) : !data ? (
          <div className="bento" aria-busy="true">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="tile skeleton" />
            ))}
          </div>
        ) : (
          <div className="bento">
            {women.map((c, i) => (
              <a
                key={c.slug}
                className={i === 0 ? 'tile tile--hero' : 'tile'}
                href={`/tienda?depto=mujer&cat=${c.slug}`}
                data-reveal=""
                style={{ '--d': i % 4 }}
              >
                <img
                  src={cdn(c.image, { w: i === 0 ? 1200 : 800 })}
                  alt={`${c.name} de mujer`}
                  width={800}
                  height={1000}
                  loading="lazy"
                  decoding="async"
                />
                <span className="tile__label glass">
                  <span className="tile__name">{c.name}</span>
                  <span className="tile__count">{plural(c.productCount, 'pieza', 'piezas')}</span>
                </span>
                <span className="icon-btn glass round tile__go" aria-hidden="true">
                  <Icon name="arrow-up-right" />
                </span>
              </a>
            ))}
            <a className="tile tile--type" href="/tienda?orden=nuevo" data-reveal="" style={{ '--d': 2 }}>
              <span className="eyebrow eyebrow--plain">Recién llegado</span>
              <span className="tile__big">
                Lo <em>nuevo</em> de la temporada
              </span>
              <span className="tile__cta">
                Ver novedades <Icon name="arrow-up-right" />
              </span>
            </a>
            {sale.length ? (
              <a className="tile tile--type tile--sand" href="/tienda?oferta=1" data-reveal="" style={{ '--d': 3 }}>
                <span className="eyebrow eyebrow--plain">Rebajas</span>
                {maxPct >= 5 ? (
                  <span className="tile__big">
                    Hasta <em>{maxPct}%</em> menos
                  </span>
                ) : (
                  <span className="tile__big">
                    Precios <em>especiales</em>
                  </span>
                )}
                <span className="tile__cta">
                  Ver ofertas <Icon name="arrow-up-right" />
                </span>
              </a>
            ) : (
              <a
                className="tile tile--type tile--sand"
                href="/tienda?orden=populares"
                data-reveal=""
                style={{ '--d': 3 }}
              >
                <span className="eyebrow eyebrow--plain">Las favoritas</span>
                <span className="tile__big">
                  Lo más <em>deseado</em>
                </span>
                <span className="tile__cta">
                  Ver ahora <Icon name="arrow-up-right" />
                </span>
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
