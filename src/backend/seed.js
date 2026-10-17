/**
 * Convierte los JSON de public/data (el catálogo de muestra) en la base normalizada que usan
 * el panel y Supabase: productos con colores y variantes (SKU + existencias por color y talla),
 * departamentos, categorías, banners, looks, preguntas, ajustes y contenido de la portada.
 * Lo usan la demostración del navegador y scripts/build-seed.mjs (que genera supabase/seed.sql).
 */
import { makeSku, sizeRank, mergeSettings, round2 } from './model.js';

/** Id estable (formato UUID) a partir de una clave: la semilla siempre produce los mismos ids. */
export function stableId(key) {
  const h = (seed) => {
    let x = seed >>> 0;
    for (let i = 0; i < key.length; i++) {
      x ^= key.charCodeAt(i);
      x = Math.imul(x, 0x01000193) >>> 0;
    }
    return x.toString(16).padStart(8, '0');
  };
  const hex = h(0x811c9dc5) + h(0x1b873593) + h(0xcc9e2d51) + h(0xe6546b64);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${(8 | (parseInt(hex[16], 16) & 3)).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Reparte las piezas de una talla entre sus colores (determinista). */
function distribute(total, n, offset) {
  const out = Array(n).fill(0);
  for (let k = 0; k < total; k++) out[(k + offset) % n]++;
  return out;
}

/** Costo de ejemplo (≈ 42 % del precio) para que los reportes de utilidad tengan sentido. */
const sampleCost = (price) => round2(Math.round((price * 0.42) / 10) * 10);

export function buildCatalog(src, { now = new Date() } = {}) {
  const seedDate = new Date(now.getTime() - 80 * 864e5).toISOString();

  const departments = (src.categories?.departments || []).map((d, i) => ({
    slug: d.slug, name: d.name, description: d.description || '', image: d.image || '', sort: i, active: true,
  }));

  const categories = (src.categories?.categories || []).map((c, i) => ({
    slug: c.slug, department: c.department, name: c.name, description: c.description || '', image: c.image || '',
    sort: c.order ?? i, active: true,
  }));

  const movements = [];
  const products = (src.products || []).map((rp, pi) => {
    const colors = rp.colors.map((c, ci) => ({
      id: stableId(`color:${rp.slug}:${c.name}`),
      name: c.name, hex: c.hex, family: c.family, images: [...(c.images || [])], sort: ci,
    }));
    const sizes = [...rp.sizes].sort((a, b) => sizeRank(a.label) - sizeRank(b.label));
    const variants = [];
    sizes.forEach((s, si) => {
      const per = distribute(s.stock || 0, colors.length, si);
      colors.forEach((c, ci) => {
        variants.push({
          id: stableId(`variant:${rp.slug}:${c.name}:${s.label}`),
          colorId: c.id, size: s.label, sku: makeSku(rp.sku, c.name, s.label),
          stock: per[ci], minStock: null, active: true, sort: si,
        });
      });
    });
    const product = {
      id: stableId(`product:${rp.slug}`),
      slug: rp.slug,
      code: rp.sku,
      name: rp.name,
      department: rp.department,
      category: rp.category,
      description: rp.description || '',
      details: [...(rp.details || [])],
      material: rp.material || '',
      care: rp.care || '',
      origin: rp.origin || 'Importado de EE. UU.',
      price: rp.price,
      compareAtPrice: rp.compareAtPrice ?? null,
      cost: sampleCost(rp.price),
      tags: [...(rp.tags || [])],
      isNew: !!rp.isNew,
      isBestseller: !!rp.isBestseller,
      isFeatured: !!rp.isFeatured,
      status: 'activo',
      sort: pi,
      createdAt: rp.createdAt ? new Date(`${rp.createdAt}T16:00:00Z`).toISOString() : seedDate,
      updatedAt: rp.createdAt ? new Date(`${rp.createdAt}T16:00:00Z`).toISOString() : seedDate,
      colors,
      variants,
    };
    for (const v of variants) {
      if (!v.stock) continue;
      const color = colors.find((c) => c.id === v.colorId);
      movements.push({
        id: stableId(`mov:inicial:${v.id}`), variantId: v.id, productId: product.id, sku: v.sku,
        productName: product.name, variantLabel: `${color.name} · ${v.size}`,
        type: 'inicial', qty: v.stock, stockAfter: v.stock, unitCost: product.cost,
        reason: 'Inventario inicial', reference: '', orderId: null,
        createdAt: seedDate, createdBy: null, createdByName: 'Sistema',
      });
    }
    return product;
  });

  // La portada solo muestra el carrusel principal; los demás lugares se arman con el contenido de cada sección.
  const banners = (src.banners || []).filter((b) => (b.placement || 'home-carousel') === 'home-carousel').map((b, i) => ({
    id: stableId(`banner:${b.id || i}`), placement: b.placement || 'home-carousel',
    eyebrow: b.eyebrow || '', title: b.title || '', text: b.text || '',
    ctaLabel: b.cta?.label || '', ctaHref: b.cta?.href || '', image: b.image || '', imageMobile: '',
    theme: b.theme || 'light', sort: i, active: true, startsAt: null, endsAt: null,
  }));

  const lookbooks = (src.lookbooks || []).map((l, i) => ({
    id: stableId(`look:${l.id || i}`), eyebrow: l.eyebrow || '', title: l.title || '', text: l.text || '',
    image: l.image || '', hotspots: (l.hotspots || []).map((h) => ({ ...h })), sort: i, active: true,
  }));

  const faq = (src.faq || []).map((f, i) => ({
    id: stableId(`faq:${i}`), question: f.q, answer: f.a, sort: i, active: true,
  }));

  const { whatsappNote, ...publicSettings } = src.settings || {};
  const settings = mergeSettings({ public: publicSettings });

  return {
    version: 1,
    departments,
    categories,
    products,
    movements,
    orders: [],
    cashSessions: [],
    cashMovements: [],
    banners,
    lookbooks,
    faq,
    content: JSON.parse(JSON.stringify(src.content || {})),
    settings,
    seq: { order: 1001, cash: 1 },
  };
}
