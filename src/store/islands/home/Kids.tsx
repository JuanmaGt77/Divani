/** Divani Kids: mosaicos de Niñas y Niños y un carril con sus prendas. */
import { useEffect, useMemo, useState } from 'react';
import { cdn } from '@/lib/model';
import { Emph, Icon } from '../../components/Icon';
import { CardSkeletons, ProductCard } from '../../components/ProductCard';
import { LoadError } from '../../components/LoadError';
import { Rail, RailArrows, useRail } from '../../components/Rail';
import { Segmented } from '../../components/Segmented';
import { DEFAULT_CONTENT, useContent } from '../../data/content';
import { listProducts, useStorefront } from '../../data/storefront';

const DEPTS = [
  { value: 'ninas', label: 'Niñas' },
  { value: 'ninos', label: 'Niños' },
];

const TILES = [
  { dept: 'ninas', name: 'Niñas', field: 'girlsImage', alt: 'Vestidos y jumper de niña colgados en un riel dorado' },
  {
    dept: 'ninos',
    name: 'Niños',
    field: 'boysImage',
    alt: 'Playera, overol y sudadera de niño colgados en un riel dorado',
  },
] as const;

export default function Kids() {
  const content = useContent();
  const { data, status, retry } = useStorefront();
  const [dept, setDept] = useState('ninas');
  const rail = useRail();
  const { reset } = rail;
  const products = useMemo(
    () => (data ? listProducts(data, { department: dept, sort: 'destacados', pageSize: 10 }).data : []),
    [data, dept],
  );
  useEffect(() => reset(), [products, reset]);

  const title = content.get('kids', 'title');
  const lead = content.get('kids', 'lead');

  return (
    <section className="section kids" id="kids" data-edit="kids">
      <div className="container">
        <header className="section-head">
          <div className="section-head__text">
            <p className="eyebrow">Divani Kids</p>
            {title ? (
              <h2 className="h-2">
                <Emph text={title} />
              </h2>
            ) : null}
            {lead ? <p className="lead">{lead}</p> : null}
          </div>
        </header>
        <div className="kids__tiles">
          {TILES.map((t, i) => {
            const image = content.get('kids', t.field);
            return (
              <a
                key={t.dept}
                className="kids-tile"
                href={`/tienda?depto=${t.dept}`}
                data-reveal=""
                style={{ '--d': i }}
              >
                {image ? (
                  <img
                    src={cdn(image, { w: 900 })}
                    alt={image === DEFAULT_CONTENT.kids?.[t.field] ? t.alt : `Ropa de ${t.name.toLowerCase()}`}
                    loading="lazy"
                    width={800}
                    height={1000}
                  />
                ) : null}
                <span className="kids-tile__label glass">
                  <span className="kids-tile__name">{t.name}</span>
                  <span className="kids-tile__cta">
                    Ver colección <Icon name="arrow-right" />
                  </span>
                </span>
              </a>
            );
          })}
        </div>
        <div className="kids__shop">
          <Segmented label="Elegir departamento infantil" value={dept} onChange={setDept} options={DEPTS} />
          <RailArrows rail={rail} />
        </div>
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
