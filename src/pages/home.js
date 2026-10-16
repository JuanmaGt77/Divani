/** Portada (index.html) */
import { initApp } from '../app.js';
import { fillMarquee } from '../components/header.js';
import { initHero } from '../sections/hero.js';
import { initCategories, initNewArrivals, initBestsellers, initKids, initMen } from '../sections/catalog-sections.js';
import { initPromos, initLookbook, initFaq } from '../sections/content-sections.js';

initApp({ tab: 'inicio' });
initHero();
document.querySelectorAll('[data-ribbon]').forEach((t) => fillMarquee(t));
initCategories();
initNewArrivals();
initPromos();
initBestsellers();
initLookbook();
initKids();
initMen();
initFaq();
