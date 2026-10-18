/**
 * Carrusel de promociones (Sitio web → Banners). Avanza solo y se pausa con el cursor encima, con
 * el foco del teclado y cuando no está en pantalla. Sin banners (o si falla la carga) no se muestra.
 */
import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { cdn, storeHref } from '@/lib/model';
import { Emph, Icon } from '../../components/Icon';
import { cx } from '../../components/cx';
import { useStorefront } from '../../data/storefront';
import { reduceMotion } from '../../lib/hydration';

const DURATION = 6500;

export default function Promos() {
  const { data, status } = useStorefront();
  const banners = (data?.banners || []).filter((b) => (b.placement || 'home-carousel') === 'home-carousel');
  const count = banners.length;
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
    el.scrollTo({ left: el.clientWidth * ((i + count) % count), behavior: smooth ? 'smooth' : 'auto' });
  };

  // La diapositiva actual sale del desplazamiento (también al deslizar con el dedo)
  useEffect(() => {
    const el = track.current;
    if (!el || !count) return undefined;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    const onResize = () => el.scrollTo({ left: el.clientWidth * currentRef.current });
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    // Solo avanza cuando está en pantalla
    const io = new IntersectionObserver(([en]) => setHold((h) => ({ ...h, away: !en?.isIntersecting })), {
      threshold: 0.3,
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

  if (status === 'error' || (data && !count)) return null;

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold((h) => ({ ...h, focus: false }));
  };

  return (
    <section className="section section--tight" aria-label="Promociones" data-edit="banners">
      <div className="container">
        <div
          ref={root}
          className={cx('promo', paused && 'is-paused')}
          aria-roledescription="carrusel"
          style={{ '--promo-dur': `${DURATION}ms` }}
          onPointerEnter={(e) => e.pointerType === 'mouse' && setHold((h) => ({ ...h, hover: true }))}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setHold((h) => ({ ...h, hover: false }))}
          onFocus={() => setHold((h) => ({ ...h, focus: true }))}
          onBlur={onBlur}
        >
          <div className="promo__track" ref={track}>
            {!data ? (
              <div className="promo__slide skeleton" />
            ) : (
              banners.map((b, i) => (
                <article
                  key={b.id}
                  className={cx('promo__slide', i === current && 'is-current')}
                  aria-roledescription="diapositiva"
                  aria-label={`${i + 1} de ${count}`}
                >
                  <picture>
                    {b.imageMobile ? (
                      <source media="(max-width: 767px)" srcSet={cdn(b.imageMobile, { w: 900 })} />
                    ) : null}
                    <img
                      className="promo__img"
                      src={cdn(b.image, { w: 2000 })}
                      alt=""
                      width={1600}
                      height={900}
                      loading={i === 0 ? undefined : 'lazy'}
                      decoding="async"
                    />
                  </picture>
                  <div className="promo__card glass glass--live">
                    {b.eyebrow ? <p className="eyebrow">{b.eyebrow}</p> : null}
                    <h2 className="promo__title">
                      <Emph text={b.title} />
                    </h2>
                    {b.text ? <p className="promo__text">{b.text}</p> : null}
                    {b.cta?.label ? (
                      <a className="btn btn--ink" href={storeHref(b.cta.href)}>
                        {b.cta.label}
                        <Icon name="arrow-right" />
                      </a>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
          {count === 1 ? null : (
            <div className="promo__nav glass pill">
              <button
                className="icon-btn icon-btn--sm"
                type="button"
                onClick={() => go(current - 1)}
                aria-label="Promoción anterior"
              >
                <Icon name="chevron-left" />
              </button>
              <div className="promo__dots">
                {banners.map((b, i) => (
                  <button
                    key={b.id}
                    className="promo__dot"
                    type="button"
                    aria-label={`Ir a la promoción ${i + 1}`}
                    aria-current={i === current}
                    onClick={() => go(i)}
                  >
                    {/* La barra de progreso vuelve a empezar en cada diapositiva */}
                    <span key={i === current ? 'on' : 'off'} />
                  </button>
                ))}
              </div>
              <button
                className="icon-btn icon-btn--sm"
                type="button"
                onClick={() => go(current + 1)}
                aria-label="Siguiente promoción"
              >
                <Icon name="chevron-right" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
