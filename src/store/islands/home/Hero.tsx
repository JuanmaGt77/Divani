/**
 * Portada con video: elige la versión vertical u horizontal, controla pausa y sonido, dibuja el
 * progreso y se pausa cuando no está en pantalla (ahorra batería). El video, las fotos de respaldo
 * y los textos se cambian en el panel (Sitio web → Portada con video).
 */
import { useEffect, useRef, useState } from 'react';
import { cdn } from '@/lib/model';
import { Emph, Icon } from '../../components/Icon';
import { cx } from '../../components/cx';
import { useContent } from '../../data/content';
import { useSettings } from '../../data/storefront';
import { reduceMotion } from '../../lib/hydration';
import { greetingMessage, waLink } from '../../lib/whatsapp';

const DEFAULT_VIDEO = /media\/video\/divani-hero(-portrait)?\.mp4$/;

export default function Hero() {
  const content = useContent();
  const settings = useSettings();
  const video = useRef<HTMLVideoElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  // El ícono empieza en «pausa» (el video arranca solo) y la foto de respaldo se oculta al empezar
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const pausedRef = useRef(false);
  pausedRef.current = userPaused;

  const hero = {
    eyebrow: content.get('hero', 'eyebrow'),
    title: content.get('hero', 'title'),
    subtitle: content.get('hero', 'subtitle'),
    video: content.get('hero', 'video'),
    videoPortrait: content.get('hero', 'videoPortrait'),
    poster: content.get('hero', 'poster'),
    posterPortrait: content.get('hero', 'posterPortrait'),
  };
  // Video subido desde el panel (si es el de fábrica se usan sus versiones webm/mp4 locales)
  const custom =
    hero.video && !DEFAULT_VIDEO.test(hero.video)
      ? { landscape: cdn(hero.video), portrait: cdn(hero.videoPortrait || hero.video) }
      : null;
  const customKey = custom ? `${custom.landscape}|${custom.portrait}` : '';

  const play = () => {
    const v = video.current;
    if (!v) return;
    v.muted = v.muted || muted;
    v.play().catch(() => setPaused(true)); // Reproducción automática bloqueada (modo de ahorro de energía)
  };

  // Arranque, orientación correcta y video personalizado
  useEffect(() => {
    const v = video.current;
    if (!v) return undefined;
    v.muted = true;
    const portrait = matchMedia('(max-width: 767px)');
    const urlFor = (kind: 'portrait' | 'landscape', ext: string) =>
      custom
        ? new URL(custom[kind], location.href).href
        : new URL(`/media/video/divani-hero${kind === 'portrait' ? '-portrait' : ''}.${ext}`, location.href).href;
    // Asegura la fuente correcta aunque el navegador ignore <source media>
    const pick = () => {
      if (!v.currentSrc && !custom) return;
      const ext = v.currentSrc.split('?')[0]?.endsWith('.webm') ? 'webm' : 'mp4';
      const want = urlFor(portrait.matches ? 'portrait' : 'landscape', ext);
      if (v.currentSrc !== want) {
        const t = v.currentTime;
        v.src = want;
        v.currentTime = t;
        if (!pausedRef.current) play();
      }
    };
    if (custom) {
      v.querySelectorAll('source').forEach((s) => s.remove());
      v.src = urlFor(portrait.matches ? 'portrait' : 'landscape', 'mp4');
      v.load();
    }
    if (reduceMotion()) {
      v.pause();
      setUserPaused(true);
    } else play();
    portrait.addEventListener('change', pick);
    v.addEventListener('loadedmetadata', pick, { once: true });
    return () => {
      portrait.removeEventListener('change', pick);
      v.removeEventListener('loadedmetadata', pick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customKey]);

  // Barra de progreso y pausa automática fuera de pantalla
  useEffect(() => {
    const v = video.current;
    if (!v) return undefined;
    let raf = 0;
    const tick = () => {
      if (v.duration) progress.current?.style.setProperty('--p', (v.currentTime / v.duration).toFixed(4));
      raf = requestAnimationFrame(tick);
    };
    const onPlay = () => {
      setPaused(false);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setPaused(true);
      cancelAnimationFrame(raf);
    };
    const onPlaying = () => setStarted(true);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('playing', onPlaying);
    let io: IntersectionObserver | undefined;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        ([entry]) => {
          if (pausedRef.current) return;
          if (entry?.isIntersecting) play();
          else v.pause();
        },
        { threshold: 0.15 },
      );
      io.observe(v);
    }
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('playing', onPlaying);
      io?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      setUserPaused(false);
      play();
    } else {
      setUserPaused(true);
      v.pause();
    }
  };
  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted && v.paused) {
      setUserPaused(false);
      play();
    }
  };

  const posterLandscape = hero.poster ? cdn(hero.poster, { w: 1920 }) : '/media/video/divani-hero-poster.webp';
  const posterPortrait =
    hero.posterPortrait || hero.poster
      ? cdn(hero.posterPortrait || hero.poster, { w: 900 })
      : '/media/video/divani-hero-portrait-poster.webp';

  return (
    <section className="hero" aria-label="Divani, ropa americana premium" data-edit="hero">
      <div className="hero__media">
        <video
          ref={video}
          className="hero__video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label="Video de presentación de Divani: una tela de seda se desliza y aparece el logotipo."
        >
          <source src="/media/video/divani-hero-portrait.webm" type="video/webm" media="(max-width: 767px)" />
          <source src="/media/video/divani-hero-portrait.mp4" type="video/mp4" media="(max-width: 767px)" />
          <source src="/media/video/divani-hero.webm" type="video/webm" />
          <source src="/media/video/divani-hero.mp4" type="video/mp4" />
        </video>
        <picture className={cx('hero__poster', started && 'is-hidden')}>
          <source media="(max-width: 767px)" srcSet={posterPortrait} />
          <img src={posterLandscape} alt="" width={1280} height={720} fetchPriority="high" decoding="async" />
        </picture>
        <div className="hero__veil" aria-hidden="true" />
      </div>

      <div className="hero__content container">
        <div className="hero__panel glass glass--live">
          {hero.eyebrow ? (
            <p className="eyebrow rise" style={{ '--i': 0 }}>
              {hero.eyebrow}
            </p>
          ) : null}
          {hero.title ? (
            <h1 className="hero__title rise" style={{ '--i': 1 }}>
              <Emph text={hero.title} />
            </h1>
          ) : null}
          {hero.subtitle ? (
            <p className="hero__sub rise" style={{ '--i': 2 }}>
              {hero.subtitle}
            </p>
          ) : null}
          <div className="hero__actions rise" style={{ '--i': 3 }}>
            <a className="btn btn--ink btn--lg" href="/tienda">
              Comprar ahora
              <Icon name="arrow-right" />
            </a>
            <a
              className="btn btn--glass btn--wa btn--lg glass"
              href={waLink(settings, greetingMessage(settings))}
              target="_blank"
              rel="noopener"
            >
              <Icon name="whatsapp" />
              Pedir por WhatsApp
            </a>
          </div>
        </div>

        <div className="hero__controls rise" style={{ '--i': 4 }}>
          <div className="hero__progress" aria-hidden="true">
            <span ref={progress} />
          </div>
          <button
            className="icon-btn glass round"
            type="button"
            onClick={toggle}
            aria-label={paused ? 'Reproducir video' : 'Pausar video'}
          >
            <Icon name={paused ? 'play' : 'pause'} />
          </button>
          <button
            className="icon-btn glass round"
            type="button"
            onClick={toggleSound}
            aria-label={muted ? 'Activar sonido' : 'Silenciar'}
          >
            <Icon name={muted ? 'volume-off' : 'volume'} />
          </button>
        </div>
      </div>
    </section>
  );
}
