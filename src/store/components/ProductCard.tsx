/**
 * Tarjeta de producto: fotos (la segunda aparece al pasar el cursor), etiquetas, favorito,
 * agregar talla rápido, colores y precio. Al tocarla se abre la vista rápida; con Ctrl/⌘ + clic
 * se abre la página del producto en otra pestaña.
 */
import { useRef, useState, type MouseEvent } from 'react';
import { money } from '@/lib/format';
import { cdn } from '@/lib/model';
import type { StoreProduct } from '@/lib/types';
import { badgesOf, firstAvailableColor, sizesOf, totalStock } from '../lib/product';
import { productPath } from '../lib/url';
import { cart } from '../state/cart';
import { favorites, useFavorites } from '../state/favorites';
import { notify, openProduct, openSheet } from '../state/ui';
import { cx } from './cx';
import { Icon } from './Icon';

/** Abre la vista rápida salvo que se quiera abrir la página en otra pestaña. */
export function onProductLink(e: MouseEvent, slug: string, color?: string): void {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
  e.preventDefault();
  openProduct(slug, color ? { color } : {});
}

export function toggleFavorite(p: StoreProduct, button?: HTMLElement | null): void {
  const added = favorites.toggle(p.slug);
  if (button) {
    button.classList.remove('is-pop');
    void button.offsetWidth;
    if (added) button.classList.add('is-pop');
  }
  if (added) {
    notify({
      title: 'Guardado en favoritos',
      sub: p.name,
      image: cdn(p.colors?.[0]?.images?.[0] || '', { w: 160 }),
      icon: 'heart',
      action: { label: 'Ver', onClick: () => openSheet('favorites') },
    });
  }
}

export function ProductCard({
  product: p,
  index = 0,
  reveal = true,
  category = '',
}: {
  product: StoreProduct;
  index?: number;
  reveal?: boolean;
  category?: string;
}) {
  const first = firstAvailableColor(p);
  const [colorIdx, setColorIdx] = useState(() => Math.max(0, first ? p.colors.indexOf(first) : 0));
  const color = p.colors[colorIdx] || first;
  const favs = useFavorites();
  const fav = favs.includes(p.slug);
  const favRef = useRef<HTMLButtonElement>(null);
  const [img1, img2] = (color?.images || []).map((src) => cdn(src, { w: 640 }));
  const stock = totalStock(p);
  const inColor = new Map(sizesOf(p, color?.name).map((s) => [s.label, s.stock]));
  const badges = badgesOf(p);
  const sale = !!p.compareAtPrice && p.compareAtPrice > p.price;
  const href = productPath(p.slug);
  const sizes = p.sizes || [];
  const oneSize = sizes.length === 1;

  const quickAdd = (size: string) => {
    const c = color || p.colors[0];
    if (!c) return;
    if (!cart.add(p, { color: c.name, size, qty: 1 })) {
      notify({
        title: 'Esa talla se agotó en este color',
        sub: 'Toca la prenda para ver otras opciones.',
        icon: 'info',
      });
      return;
    }
    notify({
      title: 'Agregado a tu bolsa',
      sub: `${p.name} · ${c.name} · ${size}`,
      image: cdn(c.images[0], { w: 160 }),
      action: { label: 'Ver bolsa', onClick: () => openSheet('cart') },
    });
  };

  return (
    <article
      className={cx('card', stock === 0 && 'is-soldout')}
      data-card={p.slug}
      data-reveal={reveal ? '' : undefined}
      style={reveal ? { '--d': index % 4 } : undefined}
    >
      <div className="card__media">
        <a
          className="card__link"
          href={href}
          onClick={(e) => onProductLink(e, p.slug, color?.name)}
          aria-label={`Ver ${p.name}`}
        >
          <img
            className="card__img--main"
            src={img1}
            alt={`${p.name} color ${color?.name || ''}`}
            width={800}
            height={1000}
            loading="lazy"
            decoding="async"
          />
          {img2 && (
            <img
              className="card__img--alt"
              src={img2}
              alt=""
              width={800}
              height={1000}
              loading="lazy"
              decoding="async"
            />
          )}
        </a>
        <div className="card__badges">
          {badges.map((b) => (
            <span
              key={b.id}
              className={cx('badge', `badge--${b.id}`, (b.id === 'nuevo' || b.id === 'ultimas') && 'glass')}
            >
              {b.label}
            </span>
          ))}
        </div>
        <button
          ref={favRef}
          className="icon-btn glass round card__fav"
          type="button"
          aria-pressed={fav}
          aria-label={fav ? `Quitar ${p.name} de favoritos` : `Agregar ${p.name} a favoritos`}
          onClick={() => toggleFavorite(p, favRef.current)}
        >
          <Icon name="heart" />
        </button>
        {stock > 0 && (
          <>
            <div className="card__quick glass">
              <p className="card__quick-title">{oneSize ? 'Agregar a la bolsa' : 'Agregar talla'}</p>
              <div className="card__sizes">
                {sizes.map((s) => (
                  <button
                    key={s.label}
                    className="size-btn"
                    type="button"
                    disabled={!inColor.get(s.label)}
                    aria-label={`Agregar talla ${s.label}`}
                    onClick={() => quickAdd(s.label)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="icon-btn glass round card__add"
              type="button"
              aria-label={`Agregar ${p.name}`}
              onClick={() => openProduct(p.slug, color ? { color: color.name } : {})}
            >
              <Icon name="plus" />
            </button>
          </>
        )}
      </div>
      <div className="card__info">
        {category && <p className="card__cat">{category}</p>}
        <h3 className="card__name">
          <a href={href} onClick={(e) => onProductLink(e, p.slug, color?.name)}>
            {p.name}
          </a>
        </h3>
        <p className={cx('card__price', sale && 'is-sale')}>
          <span>{money(p.price)}</span>
          {sale && <s className="card__compare">{money(p.compareAtPrice)}</s>}
        </p>
        {p.colors?.length > 1 ? (
          <div className="card__swatches">
            {p.colors.map((c, i) => (
              <button
                key={c.name}
                className="card__swatch"
                type="button"
                aria-pressed={i === colorIdx}
                aria-label={`Color ${c.name}`}
                onClick={() => setColorIdx(i)}
              >
                <span className="swatch" style={{ '--c': c.hex || '#ccc' }} />
              </button>
            ))}
            <small>{p.colors.length} colores</small>
          </div>
        ) : (
          <div className="card__swatches">
            <span className="swatch" style={{ '--c': color?.hex || '#ccc' }} />
            <small>{color?.name}</small>
          </div>
        )}
      </div>
    </article>
  );
}

export function CardSkeletons({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card" aria-hidden="true">
          <div className="card__media skeleton" />
          <div className="card__info">
            <div className="sk-line skeleton" />
            <div className="sk-line sk-line--short skeleton" />
          </div>
        </div>
      ))}
    </>
  );
}

/** Tarjeta pequeña (búsqueda y favoritos). */
export function MiniCard({ product: p, onOpen }: { product: StoreProduct; onOpen?: () => void }) {
  const c = p.colors?.[0];
  return (
    <a
      className="mini"
      href={productPath(p.slug)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        onOpen?.();
        onProductLink(e, p.slug);
      }}
    >
      <span className="mini__media">
        <img src={cdn(c?.images?.[0], { w: 400 })} alt="" width={800} height={1000} loading="lazy" />
      </span>
      <span className="mini__name">{p.name}</span>
      <span className="mini__price">{money(p.price)}</span>
    </a>
  );
}
