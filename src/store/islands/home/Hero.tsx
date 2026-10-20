/**
 * Portada: carrusel de «vitrinas» (Sitio web → Portada). Cada banner es una campaña con su color,
 * su foto y una repisa de prendas con su precio, en marcos de arco como ventanas de boutique.
 * Sin banners publicados se muestra una vitrina de novedades. Avanza sola y se detiene con el
 * cursor encima, con el foco del teclado, fuera de pantalla o con «reducir movimiento».
 */
import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { money } from '@/lib/format';
import { SHOWCASE_SIZE, bannerTheme, cdn, normalizeShowcase, storeHref } from '@/lib/model';
import type { StoreBanner, StoreProduct, StorefrontPayload } from '@/lib/types';
import { Emph, Icon } from '../../components/Icon';
import { cx } from '../../components/cx';
import { onProductLink } from '../../components/ProductCard';
import { listProducts, useStorefront } from '../../data/storefront';
import { reduceMotion } from '../../lib/hydration';
import { discountPct, firstAvailableColor, totalStock } from '../../lib/product';
import { productPath } from '../../lib/url';

const DURATION = 7000;

/** Vitrina de respaldo cuando no hay banners publicados. */
const FALLBACK: StoreBanner = {
  id: 'novedades',
  placement: 'home-carousel',
  eyebrow: 'Nueva temporada',
  title: 'Ropa americana *premium*',
  text: 'Prendas seleccionadas para mujer, niñas, niños y hombre. Pocas piezas por modelo.',
  cta: { label: 'Ver novedades', href: '/tienda?orden=nuevo' },
  image: '',
  imageMobile: '',
  theme: 'arena',
  showcase: { source: 'nuevo' },
};

/** Prendas con existencias que muestra cada banner. */
function pickProducts(data: StorefrontPayload, banner: StoreBanner): StoreProduct[] {
  const s = normalizeShowcase(banner.showcase);
  const query = { inStock: true, pageSize: 24 };
  let list: StoreProduct[];
  switch (s.source) {
    case 'ninguna':
      return [];
    case 'elegidas': {
      const bySlug = new Map(data.products.map((p) => [p.slug, p]));
      list = (s.products || [])
        .map((slug) => bySlug.get(slug))
        .filter((p): p is StoreProduct => !!p && totalStock(p) > 0);
      break;
    }
    case 'ofertas':
      list = listProducts(data, { ...query, onSale: true }).data.sort((a, b) => discountPct(b) - discountPct(a));
      break;
    case 'populares':
      list = listProducts(data, { ...query, sort: 'populares' }).data;
      break;
    case 'categoria':
      list = listProducts(data, { ...query, category: s.category, sort: 'destacados' }).data;
      break;
    default:
      list = listProducts(data, { ...query, sort: 'nuevo' }).data;
  }
  return list.slice(0, SHOWCASE_SIZE);
}

interface Slide {
  banner: StoreBanner;
  products: StoreProduct[];
}

export default function Hero() {
  const { data, status } = useStorefront();
  const slides = useMemo<Slide[]>(() => {
    if (!data)
      return status === 'error'
        ? [{ banner: { ...FALLBACK, cta: { label: 'Ver la tienda', href: '/tienda' } }, products: [] }]
        : [];
    const banners = data.banners.filter((b) => (b.placement || 'home-carousel') === 'home-carousel');
    return (banners.length ? banners : [FALLBACK]).map((banner) => ({ banner, products: pickProducts(data, banner) }));
  }, [data, status]);
  const count = slides.length;

  const track = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [hold, setHold] = useState({ hover: false, focus: false, away: false });
  const paused = hold.hover || hold.focus || hold.away;
  const current = Math.min(index, Math.max(0, count - 1));
  const currentRef = useRef(current);
  currentRef.current = current;

  const go = (i: number, smooth = true) => {
    const el = track.current;
    if (!el || !count) return;
    el.scrollTo({
      left: el.clientWidth * ((i + count) % count),
      behavior: smooth && !reduceMotion() ? 'smooth' : 'auto',
    });
  };

  // La vitrina actual sale del desplazamiento (también al deslizar con el dedo)
  useEffect(() => {
    const el = track.current;
    if (!el || count < 2) return undefined;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    const onResize = () => el.scrollTo({ left: el.clientWidth * currentRef.current });
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    const io = new IntersectionObserver(([en]) => setHold((h) => ({ ...h, away: !en?.isIntersecting })), {
      threshold: 0.35,
    });
    if (root.current) io.observe(root.current);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      io.disconnect();
    };
  }, [count]);

  // Avance automático
  useEffect(() => {
    if (count < 2 || paused || reduceMotion()) return undefined;
    const timer = setTimeout(() => go(current + 1), DURATION);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, paused, count]);

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold((h) => ({ ...h, focus: false }));
  };

  return (
    <section className="vitrina" aria-label="Portada" data-edit="banners">
      <h1 className="visually-hidden">Divani · Ropa americana premium</h1>
      <div className="container">
        <div
          ref={root}
          className={cx('vitrina__frame', paused && 'is-paused')}
          aria-roledescription="carrusel"
          style={{ '--vit-dur': `${DURATION}ms` }}
          onPointerEnter={(e) => e.pointerType === 'mouse' && setHold((h) => ({ ...h, hover: true }))}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setHold((h) => ({ ...h, hover: false }))}
          onFocus={() => setHold((h) => ({ ...h, focus: true }))}
          onBlur={onBlur}
        >
          <div className="vitrina__track" ref={track}>
            {!count ? (
              <SkeletonSlide />
            ) : (
              slides.map((s, i) => (
                <VitrinaSlide
                  key={s.banner.id || i}
                  slide={s}
                  index={i}
                  count={count}
                  current={i === current}
                  eager={i === 0}
                />
              ))
            )}
          </div>
          {count > 1 ? (
            <div className="vitrina__nav">
              <button
                className="icon-btn vitrina__arrow"
                type="button"
                onClick={() => go(current - 1)}
                aria-label="Anterior"
              >
                <Icon name="chevron-left" />
              </button>
              <div className="vitrina__dots">
                {slides.map((s, i) => (
                  <button
                    key={s.banner.id || i}
                    className="vitrina__dot"
                    type="button"
                    aria-label={`Ir a la portada ${i + 1}`}
                    aria-current={i === current}
                    onClick={() => go(i)}
                  >
                    {/* La barra de progreso vuelve a empezar en cada vitrina */}
                    <span key={i === current ? 'on' : 'off'} />
                  </button>
                ))}
              </div>
              <button
                className="icon-btn vitrina__arrow"
                type="button"
                onClick={() => go(current + 1)}
                aria-label="Siguiente"
              >
                <Icon name="chevron-right" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function VitrinaSlide({
  slide: { banner: b, products },
  index,
  count,
  current,
  eager,
}: {
  slide: Slide;
  index: number;
  count: number;
  current: boolean;
  eager: boolean;
}) {
  const photo = b.image || b.imageMobile;
  return (
    <article
      className={cx('vit', photo && 'vit--photo', products.length > 0 && 'vit--shelf', current && 'is-current')}
      data-theme={bannerTheme(b.theme)}
      aria-roledescription="diapositiva"
      aria-label={`${index + 1} de ${count}`}
    >
      {photo ? (
        <picture className="vit__media">
          {b.imageMobile ? <source media="(max-width: 767px)" srcSet={cdn(b.imageMobile, { w: 900 })} /> : null}
          <img
            src={cdn(photo, { w: 1600 })}
            alt=""
            width={1600}
            height={900}
            loading={eager ? undefined : 'lazy'}
            fetchPriority={eager ? 'high' : undefined}
            decoding="async"
          />
        </picture>
      ) : null}
      <div className="vit__copy">
        <p className="vit__eyebrow">
          {count > 1 ? <span className="vit__num">{String(index + 1).padStart(2, '0')}</span> : null}
          {b.eyebrow ? <span>{b.eyebrow}</span> : null}
        </p>
        <h2 className="vit__title">
          <Emph text={b.title} />
        </h2>
        {b.text ? <p className="vit__text">{b.text}</p> : null}
        <a className="btn vit__cta" href={storeHref(b.cta?.href)}>
          {b.cta?.label || 'Ver más'}
          <Icon name="arrow-right" />
        </a>
      </div>
      {products.length ? (
        <ul className="vit__shelf list-reset" aria-label="Prendas de esta portada">
          {products.map((p, k) => (
            <ShelfItem key={p.slug} product={p} k={k} />
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function ShelfItem({ product: p, k }: { product: StoreProduct; k: number }) {
  const color = firstAvailableColor(p) || p.colors[0];
  const pct = discountPct(p);
  const sale = pct > 0 && p.compareAtPrice;
  return (
    <li className="vit__item" style={{ '--k': k }}>
      <a
        className="vit__card"
        href={productPath(p.slug)}
        onClick={(e) => onProductLink(e, p.slug, color?.name)}
        aria-label={`${p.name}, ${money(p.price)}${sale ? `, antes ${money(p.compareAtPrice)}` : ''}`}
      >
        <span className="vit__arch">
          <img
            src={cdn(color?.images[0], { w: 480 })}
            alt=""
            width={360}
            height={480}
            loading="lazy"
            decoding="async"
          />
          {pct >= 5 ? <span className="vit__off">−{pct}%</span> : null}
        </span>
        <span className="vit__price" aria-hidden="true">
          <span className={sale ? 'is-sale' : undefined}>{money(p.price)}</span>
          {sale ? <s>{money(p.compareAtPrice)}</s> : null}
        </span>
        <span className="vit__name" aria-hidden="true">
          {p.name}
        </span>
      </a>
    </li>
  );
}

/** Mientras llegan los datos: la misma vitrina, sin textos ni prendas. */
function SkeletonSlide() {
  return (
    <article className="vit vit--shelf vit--skeleton" data-theme="arena" aria-busy="true" aria-label="Cargando portada">
      <div className="vit__copy">
        <span className="vit__ph vit__ph--eyebrow" />
        <span className="vit__ph vit__ph--title" />
        <span className="vit__ph vit__ph--title vit__ph--short" />
        <span className="vit__ph vit__ph--btn" />
      </div>
      <ul className="vit__shelf list-reset" aria-hidden="true">
        {Array.from({ length: SHOWCASE_SIZE }, (_, k) => (
          <li key={k} className="vit__item">
            <span className="vit__card">
              <span className="vit__arch skeleton" />
              <span className="vit__ph vit__ph--price" />
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
