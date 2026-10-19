/**
 * Ficha de producto: galería, color, talla, cantidad, agregar a la bolsa y pedir por WhatsApp.
 * Se usa en la vista rápida (hoja) y en la página de cada prenda (/producto/…).
 */
import { useRef, useState, type UIEvent } from 'react';
import { money } from '@/lib/format';
import { cdn } from '@/lib/model';
import type { PublicSettings, StoreProduct } from '@/lib/types';
import { useHydrated } from '../lib/hydration';
import { CATALOG, colorStock, discountPct, firstAvailableColor, sizesOf, totalStock } from '../lib/product';
import { productUrl } from '../lib/url';
import { productMessage, waLink } from '../lib/whatsapp';
import { cart } from '../state/cart';
import { useFavorites } from '../state/favorites';
import { notify, openSheet, openSizeGuide } from '../state/ui';
import { cx } from './cx';
import { Icon } from './Icon';
import { toggleFavorite } from './ProductCard';

/** Si el color tiene una sola talla disponible, se elige sola. */
function onlySize(p: StoreProduct, colorName: string | undefined): string | null {
  const available = sizesOf(p, colorName).filter((s) => s.stock > 0);
  return available.length === 1 ? (available[0]?.label ?? null) : null;
}

export function ProductDetail({
  product: p,
  initialColor,
  categoryName,
  settings,
  headingLevel = 'h2',
  onAdded,
}: {
  product: StoreProduct;
  initialColor?: string | undefined;
  categoryName?: string;
  settings: PublicSettings;
  headingLevel?: 'h1' | 'h2';
  /** Después de agregar a la bolsa (la vista rápida se cierra). */
  onAdded?: () => void;
}) {
  const [colorIdx, setColorIdx] = useState(() => {
    const asked = p.colors.findIndex((c) => c.name === initialColor);
    const first = firstAvailableColor(p);
    return asked >= 0 ? asked : Math.max(0, first ? p.colors.indexOf(first) : 0);
  });
  const color = p.colors[colorIdx] || p.colors[0];
  const [size, setSize] = useState<string | null>(() => onlySize(p, color?.name));
  const [qty, setQty] = useState(1);
  const [hint, setHint] = useState('');
  const [slide, setSlide] = useState(0);
  const slides = useRef<HTMLDivElement>(null);
  const sizesBox = useRef<HTMLDivElement>(null);
  const favRef = useRef<HTMLButtonElement>(null);
  const fav = useFavorites().includes(p.slug);
  // El mensaje lleva la dirección completa de la prenda, que solo se conoce en el navegador
  const hydrated = useHydrated();

  if (!color) return null;
  const pct = discountPct(p);
  const stock = totalStock(p);
  const sizes = sizesOf(p, color.name);
  const inColor = colorStock(p, color.name);
  const sel = sizes.find((s) => s.label === size);
  const wa = hydrated
    ? waLink(settings, productMessage(settings, p, { color: color.name, size, qty }))
    : waLink(settings);
  const Title = headingLevel;

  const pickColor = (i: number) => {
    const name = p.colors[i]?.name;
    setColorIdx(i);
    setSlide(0);
    slides.current?.scrollTo({ left: 0 });
    // Cada color tiene sus propias tallas: si la elegida no hay en este color, se libera
    let nextSize = size;
    if (!sizesOf(p, name).some((s) => s.label === size && s.stock > 0)) nextSize = onlySize(p, name);
    setSize(nextSize);
    const max = sizesOf(p, name).find((s) => s.label === nextSize)?.stock || 1;
    setQty((q) => Math.max(1, Math.min(q, max)));
    setHint('');
  };
  const pickSize = (label: string) => {
    setSize(label);
    const max = sizes.find((s) => s.label === label)?.stock || 1;
    setQty((q) => Math.min(q, max));
    setHint('');
  };
  const changeQty = (d: number) => {
    const max = sel?.stock ?? 10;
    setQty((q) => Math.max(1, Math.min(max, q + d)));
  };

  const add = () => {
    if (!size) {
      setHint('Elige una talla para agregarla a tu bolsa.');
      sizesBox.current?.querySelectorAll<HTMLElement>('.pdp__size:not(:disabled)').forEach((b) => {
        b.classList.remove('is-shake');
        void b.offsetWidth;
        b.classList.add('is-shake');
      });
      return;
    }
    if (!cart.add(p, { color: color.name, size, qty })) {
      notify({ title: 'Esa talla se agotó', sub: `${p.name} · ${color.name} · ${size}`, icon: 'info' });
      return;
    }
    onAdded?.();
    notify({
      title: 'Agregado a tu bolsa',
      sub: `${p.name} · ${color.name} · ${size}`,
      image: cdn(color.images[0], { w: 160 }),
      action: { label: 'Ver bolsa', onClick: () => openSheet('cart') },
    });
  };

  const share = async () => {
    const url = productUrl(p.slug);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${p.name} · ${settings.store.name}`,
          text: `Mira esta prenda en ${settings.store.name}: ${p.name}`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      notify({ title: 'Enlace copiado', sub: 'Pégalo donde quieras compartirlo.', icon: 'link' });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      notify({ title: 'Copia este enlace', sub: url, icon: 'link' });
    }
  };

  const onSlidesScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setSlide(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };

  const shownHint =
    hint ||
    (stock > 0 && !inColor
      ? 'Este color se agotó: elige otro.'
      : sel && sel.stock <= CATALOG.lowStock
        ? `Solo ${sel.stock === 1 ? 'queda 1 pieza' : `quedan ${sel.stock} piezas`} en esta talla.`
        : '');

  return (
    <>
      <div className="pdp__gallery">
        <div className="pdp__slides" ref={slides} onScroll={onSlidesScroll}>
          {color.images.map((src, i) => (
            <div key={`${color.name}-${i}`} className="pdp__slide">
              <img
                src={cdn(src, { w: 1100 })}
                alt={i === 0 ? `${p.name}, color ${color.name}` : `Detalle de ${p.name}`}
                width={800}
                height={1000}
                loading={i === 0 ? undefined : 'lazy'}
              />
            </div>
          ))}
        </div>
        <div className="pdp__thumbs glass">
          {color.images.map((src, i) => (
            <button
              key={`${color.name}-${i}`}
              className="pdp__thumb"
              type="button"
              aria-current={i === slide}
              aria-label={`Ver foto ${i + 1}`}
              onClick={() => slides.current?.scrollTo({ left: slides.current.clientWidth * i, behavior: 'smooth' })}
            >
              <img src={cdn(src, { w: 160 })} alt="" />
            </button>
          ))}
        </div>
        <div className="pdp__dots glass" aria-hidden="true">
          {color.images.map((_, i) => (
            <span key={i} aria-current={i === slide} />
          ))}
        </div>
      </div>

      <div className="pdp__info">
        <div>
          <p className="pdp__eyebrow">
            {categoryName || settings.store.name} · {p.origin || 'Importado de EE. UU.'}
          </p>
          <Title className="pdp__title">{p.name}</Title>
        </div>
        <p className={cx('pdp__price', pct && 'is-sale')}>
          <span>{money(p.price)}</span>
          {pct ? (
            <>
              <s>{money(p.compareAtPrice)}</s>
              <span className="badge badge--oferta">−{pct}%</span>
            </>
          ) : null}
        </p>
        <p className="pdp__desc">{p.description}</p>

        <div className="pdp__group">
          <p className="pdp__label">
            <span>
              Color: <strong>{color.name}</strong>
            </span>
          </p>
          <div className="pdp__colors" role="group" aria-label="Colores">
            {p.colors.map((c, i) => {
              const out = colorStock(p, c.name) === 0;
              return (
                <button
                  key={c.name}
                  className={cx('pdp__color', out && 'is-out')}
                  type="button"
                  aria-pressed={i === colorIdx}
                  aria-label={out ? `${c.name} (agotado)` : c.name}
                  onClick={() => pickColor(i)}
                >
                  <span className="swatch" style={{ '--c': c.hex }} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="pdp__group">
          <p className="pdp__label">
            <span>
              Talla
              {size && (
                <>
                  : <strong>{size}</strong>
                </>
              )}
            </span>
            {sizes.length > 1 && (
              <button type="button" onClick={() => openSizeGuide(p.department)}>
                <Icon name="ruler" />
                Guía de tallas
              </button>
            )}
          </p>
          <div className="pdp__sizes" role="group" aria-label="Tallas" ref={sizesBox}>
            {sizes.map((s) => (
              <button
                key={s.label}
                className="pdp__size"
                type="button"
                aria-pressed={s.label === size}
                disabled={!s.stock}
                aria-label={s.stock ? `Talla ${s.label}` : `Talla ${s.label}, agotada`}
                onClick={() => pickSize(s.label)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="pdp__hint" aria-live="polite">
            {shownHint}
          </p>
        </div>

        {stock > 0 ? (
          <div className="pdp__actions">
            <div className="stepper" aria-label="Cantidad">
              <button type="button" aria-label="Quitar uno" disabled={qty <= 1} onClick={() => changeQty(-1)}>
                <Icon name="minus" />
              </button>
              <output aria-live="polite">{qty}</output>
              <button
                type="button"
                aria-label="Agregar uno"
                disabled={!!sel && qty >= sel.stock}
                onClick={() => changeQty(1)}
              >
                <Icon name="plus" />
              </button>
            </div>
            <button className="btn btn--ink" type="button" disabled={!inColor} onClick={add}>
              <Icon name="bag" />
              Agregar a la bolsa
            </button>
            <a className="btn btn--glass btn--wa glass" href={wa} target="_blank" rel="noopener">
              <Icon name="whatsapp" />
              Pedir por WhatsApp
            </a>
          </div>
        ) : (
          <div className="pdp__actions">
            <a
              className="btn btn--ink btn--wa btn--block"
              style={{ gridColumn: '1/-1' }}
              href={waLink(settings, `Hola, me interesa «${p.name}». ¿Volverá a estar disponible?`)}
              target="_blank"
              rel="noopener"
            >
              <Icon name="whatsapp" />
              Avísame si regresa
            </a>
          </div>
        )}

        <ul className="pdp__perks list-reset">
          <li>
            <Icon name="tag" />
            Ropa americana premium
          </li>
          <li>
            <Icon name="truck" />
            Envíos a {settings.region.shippingArea}
          </li>
          <li>
            <Icon name="chat" />
            Te asesoramos con la talla por WhatsApp
          </li>
        </ul>

        <div className="accordion">
          <details open>
            <summary>
              Detalles
              <Icon name="plus" />
            </summary>
            <div className="accordion__body">
              <ul className="list-reset stack" style={{ '--stack': '6px' }}>
                {p.details.map((d, i) => (
                  <li key={i}>— {d}</li>
                ))}
              </ul>
            </div>
          </details>
          <details>
            <summary>
              Material y cuidados
              <Icon name="plus" />
            </summary>
            <div className="accordion__body">
              <p>
                <strong>Material:</strong> {p.material}
              </p>
              <p>
                <strong>Cuidados:</strong> {p.care}
              </p>
              <p className="muted small">Código: {p.sku}</p>
            </div>
          </details>
          <details>
            <summary>
              Envíos y pagos
              <Icon name="plus" />
            </summary>
            <div className="accordion__body">
              <p>
                {settings.checkout.note ||
                  'El costo y tiempo de envío te los confirmamos por WhatsApp según tu ciudad.'}
              </p>
            </div>
          </details>
        </div>

        <div className="cluster">
          <button className="pdp__share" type="button" onClick={() => void share()}>
            <Icon name="share" />
            Compartir
          </button>
          <button
            ref={favRef}
            className="pdp__share"
            type="button"
            aria-pressed={fav}
            onClick={() => toggleFavorite(p, favRef.current)}
          >
            <Icon name="heart" />
            {fav ? 'En favoritos' : 'Guardar en favoritos'}
          </button>
        </div>
      </div>
    </>
  );
}
