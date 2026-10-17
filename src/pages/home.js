/** Portada (index.html) */
import { initApp } from '../app.js';
import { fillMarquee } from '../components/header.js';
import { initHero } from '../sections/hero.js';
import { initSiteContent } from '../sections/site-content.js';
import { initCategories, initNewArrivals, initBestsellers, initKids, initMen } from '../sections/catalog-sections.js';
import { initPromos, initLookbook, initFaq } from '../sections/content-sections.js';

initApp({ tab: 'inicio' });
initHero();
document.querySelectorAll('[data-ribbon]').forEach((t) => fillMarquee(t));
// Fotos y textos que se editan en el panel (Sitio web → Portada)
initSiteContent();
initCategories();
initNewArrivals();
initPromos();
initBestsellers();
initLookbook();
initKids();
initMen();
initFaq();
