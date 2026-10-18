/**
 * Arma tu look (Sitio web → Arma tu look): foto con puntos sobre cada prenda, la lista de piezas,
 * el total y un botón para pedir el look completo por WhatsApp.
 */
import { useMemo, useState } from 'react';
import { money } from '@/lib/format';
import { cdn } from '@/lib/model';
import { Emph, Icon } from '../../components/Icon';
import { cx } from '../../components/cx';
import { useSettings, useStorefront } from '../../data/storefront';
import { lookMessage, waLink } from '../../lib/whatsapp';
import { openProduct } from '../../state/ui';

export default function Lookbook() {
  const { data, status } = useStorefront();
  const settings = useSettings();
  const [active, setActive] = useState(-1);
  const look = data?.lookbooks[0];

  const pieces = useMemo(() => {
    if (!data || !look) return [];
    const bySlug = new Map(data.products.map((p) => [p.slug, p]));
    return look.hotspots.flatMap((h) => {
      const p = bySlug.get(h.product);
      if (!p) return [];
      return [{ ...h, p, color: p.colors.find((c) => c.name === h.color) || p.colors[0] }];
    });
  }, [data, look]);

  if (status === 'error' || (data && !pieces.length)) return null;

  const total = pieces.reduce((a, x) => a + x.p.price, 0);
  const open = (i: number) => {
    const x = pieces[i];
    if (x) openProduct(x.p.slug, { color: x.color?.name });
  };

  return (
    <section className="section section--linen" id="look" data-edit="look">
      <div className="container look">
        {!look ? (
          <div className="look__media skeleton" />
        ) : (
          <>
            <figure className="look__media" data-reveal="scale" onPointerLeave={() => setActive(-1)}>
              <img
                src={cdn(look.image, { w: 1400 })}
                alt={`Look: ${pieces.map((x) => x.p.name).join(', ')}`}
                width={1200}
                height={1000}
                loading="lazy"
                decoding="async"
              />
              {pieces.map((x, i) => (
                <button
                  key={`${x.p.slug}-${i}`}
                  className="hotspot"
                  type="button"
                  style={{ '--x': `${x.x}%`, '--y': `${x.y}%` }}
                  aria-expanded={i === active}
                  aria-label={`Ver ${x.p.name}`}
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => {
                    setActive(i);
                    open(i);
                  }}
                >
                  <span className="hotspot__dot glass">
                    <Icon name="plus" />
                  </span>
                </button>
              ))}
            </figure>
            <div className="look__info">
              {look.eyebrow ? <p className="eyebrow">{look.eyebrow}</p> : null}
              <h2 className="look__title">
                <Emph text={look.title} />
              </h2>
              {look.text ? <p className="lead">{look.text}</p> : null}
              <div className="look__list">
                {pieces.map((x, i) => (
                  <button
                    key={`${x.p.slug}-${i}`}
                    className={cx('look-item', i === active && 'is-active')}
                    type="button"
                    onPointerEnter={() => setActive(i)}
                    onClick={() => open(i)}
                  >
                    <img src={cdn(x.color?.images[0], { w: 160 })} alt="" width={60} height={75} loading="lazy" />
                    <span>
                      <span className="look-item__name">{x.p.name}</span>
                      <br />
                      <span className="look-item__meta">{x.color?.name}</span>
                    </span>
                    <span className="look-item__price">{money(x.p.price)}</span>
                  </button>
                ))}
              </div>
              <div className="look__total">
                <span>Look completo</span>
                <strong>{money(total)}</strong>
              </div>
              <div className="look__actions">
                <a
                  className="btn btn--ink btn--wa"
                  href={waLink(
                    settings,
                    lookMessage(
                      settings,
                      look.title,
                      pieces.map((x) => ({ name: x.p.name, color: x.color?.name, price: x.p.price })),
                    ),
                  )}
                  target="_blank"
                  rel="noopener"
                >
                  <Icon name="whatsapp" />
                  Pedir el look por WhatsApp
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
