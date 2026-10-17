/**
 * Video de portada: elige la versión vertical u horizontal, controla pausa y sonido,
 * dibuja el progreso y se pausa cuando no está en pantalla (ahorra batería).
 */
import { reduceMotion } from '../core/motion.js';
import { cdn } from '../backend/model.js';

const DEFAULT_VIDEO = /media\/video\/divani-hero(-portrait)?\.mp4$/;
// Video elegido en el panel (si es el de fábrica se usan sus versiones webm/mp4 locales)
let custom = null;
let applyCustom = null;

/** Cambia el video y las fotos de respaldo de la portada (Sitio web → Portada con video). */
export function setHeroMedia(hero = {}) {
  const poster = document.querySelector('[data-hero-poster]');
  if (poster && hero.poster) {
    const img = poster.querySelector('img');
    const src = cdn(hero.poster, { w: 1920 });
    if (img && img.getAttribute('src') !== src) img.setAttribute('src', src);
    const source = poster.querySelector('source');
    const port = cdn(hero.posterPortrait || hero.poster, { w: 900 });
    if (source && source.getAttribute('srcset') !== port) source.setAttribute('srcset', port);
  }
  const next = hero.video && !DEFAULT_VIDEO.test(hero.video)
    ? { landscape: cdn(hero.video), portrait: cdn(hero.videoPortrait || hero.video) }
    : null;
  if (JSON.stringify(next) === JSON.stringify(custom)) return;
  custom = next;
  applyCustom?.();
}

export function initHero() {
  const video = document.querySelector('[data-hero-video]');
  if (!video) return;
  const poster = document.querySelector('[data-hero-poster]');
  const toggle = document.querySelector('[data-video-toggle]');
  const sound = document.querySelector('[data-video-sound]');
  const progress = document.querySelector('[data-hero-progress]');
  const portrait = matchMedia('(max-width: 767px)');
  // Mismo formato (webm/mp4) que eligió el navegador, en la orientación correcta
  const urlFor = (kind, ext) => (custom
    ? new URL(custom[kind], document.baseURI).href
    : new URL(`media/video/divani-hero${kind === 'portrait' ? '-portrait' : ''}.${ext}`, document.baseURI).href);
  let userPaused = reduceMotion();

  const setIcon = (btn, name, label) => {
    btn.querySelector('use')?.setAttribute('href', `#i-${name}`);
    btn.setAttribute('aria-label', label);
  };

  // Asegura la fuente correcta aunque el navegador ignore <source media>
  const pick = () => {
    if (!video.currentSrc) return;
    const ext = video.currentSrc.split('?')[0].endsWith('.webm') ? 'webm' : 'mp4';
    const want = urlFor(portrait.matches ? 'portrait' : 'landscape', ext);
    if (video.currentSrc !== want) {
      const t = video.currentTime;
      video.src = want;
      video.currentTime = t;
      if (!userPaused) video.play().catch(() => {});
    }
  };
  portrait.addEventListener?.('change', pick);
  video.addEventListener('loadedmetadata', pick, { once: true });

  // Video subido desde el panel
  applyCustom = () => {
    if (!custom) return;
    video.querySelectorAll('source').forEach((x) => x.remove());
    video.src = urlFor(portrait.matches ? 'portrait' : 'landscape');
    poster?.classList.remove('is-hidden');
    video.load();
    if (!userPaused) video.play().catch(() => {});
  };
  if (custom) applyCustom();

  video.addEventListener('playing', () => poster?.classList.add('is-hidden'));

  const play = () => video.play().then(() => {
    setIcon(toggle, 'pause', 'Pausar video');
  }).catch(() => {
    // Reproducción automática bloqueada (por ejemplo, modo de ahorro de energía)
    setIcon(toggle, 'play', 'Reproducir video');
  });

  if (userPaused) {
    video.removeAttribute('autoplay');
    video.pause();
    setIcon(toggle, 'play', 'Reproducir video');
  } else {
    play();
  }

  toggle?.addEventListener('click', () => {
    if (video.paused) {
      userPaused = false;
      play();
    } else {
      userPaused = true;
      video.pause();
      setIcon(toggle, 'play', 'Reproducir video');
    }
  });

  sound?.addEventListener('click', () => {
    video.muted = !video.muted;
    if (!video.muted && video.paused) { userPaused = false; play(); }
    setIcon(sound, video.muted ? 'volume-off' : 'volume', video.muted ? 'Activar sonido' : 'Silenciar');
  });

  // Barra de progreso del video
  let raf = 0;
  const tick = () => {
    if (video.duration) progress?.style.setProperty('--p', (video.currentTime / video.duration).toFixed(4));
    raf = requestAnimationFrame(tick);
  };
  video.addEventListener('play', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); });
  video.addEventListener('pause', () => cancelAnimationFrame(raf));

  // Pausa automática fuera de pantalla
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (userPaused) return;
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    }, { threshold: 0.15 }).observe(video);
  }
}
