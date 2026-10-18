/**
 * Página de una prenda (/producto/…). Llega generada desde el servidor con los datos de la prenda
 * (para buscadores y vistas previas al compartir); en el navegador usa el catálogo de la tienda
 * para tener las existencias al día.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ProductPagePayload, StoreProduct } from '@/lib/types';
import { Icon } from '../components/Icon';
import { ProductCard } from '../components/ProductCard';
import { ProductDetail } from '../components/ProductDetail';
import { Rail, RailArrows, useRail } from '../components/Rail';
import { applySettings, findProduct, useStorefront } from '../data/storefront';

export default function ProductPage({ initial, initialColor }: { initial: ProductPagePayload; initialColor?: string }) {
  // La moneda y el idioma de la tienda, antes de mostrar precios (igual en el servidor y al hidratar)
  useState(() => applySettings(initial.settings));
  const { data } = useStorefront();
  const product = findProduct(data, initial.product.slug) || initial.product;
  const settings = data?.settings || initial.settings;
  const rail = useRail();
  const { reset } = rail;

  const related = useMemo(
    () =>
      data
        ? initial.related.map((r) => findProduct(data, r.slug)).filter((p): p is StoreProduct => !!p)
        : initial.related,
    [data, initial.related],
  );
  useEffect(() => reset(), [related, reset]);

  const { category, department } = initial;
  const shopLink = category
    ? `/tienda?depto=${category.department}&cat=${category.slug}`
    : `/tienda?depto=${product.department}`;

  return (
    <>
      <div className="container product-page">
        <nav className="crumbs" aria-label="Ruta de navegación">
          <a href="/">Inicio</a>
          <span aria-hidden="true">/</span>
          <a href="/tienda">Tienda</a>
          {department ? (
            <>
              <span aria-hidden="true">/</span>
              <a href={`/tienda?depto=${department.slug}`}>{department.name}</a>
            </>
          ) : null}
          {category ? (
            <>
              <span aria-hidden="true">/</span>
              <a href={shopLink}>{category.name}</a>
            </>
          ) : null}
        </nav>
        <div className="pdp pdp--page">
          <ProductDetail
            product={product}
            initialColor={initialColor}
            categoryName={category?.name}
            settings={settings}
            headingLevel="h1"
          />
        </div>
      </div>

      {related.length ? (
        <section className="section related" aria-labelledby="related-title">
          <div className="container">
            <header className="section-head">
              <div className="section-head__text">
                <p className="eyebrow">Completa tu look</p>
                <h2 className="h-2" id="related-title">
                  También te puede <em>gustar</em>
                </h2>
              </div>
              <RailArrows rail={rail} />
            </header>
          </div>
          <Rail rail={rail}>
            {related.map((p, i) => (
              <ProductCard key={p.slug} product={p} index={i} reveal={false} />
            ))}
          </Rail>
          <div className="container section-cta">
            <a className="btn btn--outline" href={shopLink}>
              Ver más de {category?.name || department?.name || 'la tienda'}
              <Icon name="arrow-right" />
            </a>
          </div>
        </section>
      ) : null}
    </>
  );
}
