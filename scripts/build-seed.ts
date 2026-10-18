/**
 * Genera supabase/seed.sql a partir del catálogo de ejemplo (supabase/datos/*.json).
 * Uso:  npm run seed:build
 *
 * Convierte los JSON en la base normalizada: productos con colores y variantes (SKU y existencias
 * por color y talla), departamentos, categorías, banners, looks, preguntas, ajustes y contenido de
 * la portada. Los ids son estables (siempre los mismos), así que el SQL se puede ejecutar varias
 * veces: solo inserta lo que no existe y no pisa lo que cambies desde el panel.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeSku, mergeSettings, round2, sizeRank } from '../src/lib/model';
import type { Hotspot, PublicSettings, SiteContent } from '../src/lib/types';

/* ---------- lo que traen los JSON ---------- */
interface RawProduct {
  sku: string;
  slug: string;
  name: string;
  department: string;
  category: string | null;
  price: number;
  compareAtPrice?: number | null;
  description?: string;
  details?: string[];
  material?: string;
  care?: string;
  origin?: string;
  colors: { name: string; hex: string; family: string; images?: string[] }[];
  sizes: { label: string; stock?: number }[];
  isNew?: boolean;
  isBestseller?: boolean;
  isFeatured?: boolean;
  tags?: string[];
  createdAt?: string;
}
interface RawTaxonomy {
  departments: { slug: string; name: string; description?: string; image?: string }[];
  categories: {
    slug: string;
    department: string;
    name: string;
    description?: string;
    image?: string;
    order?: number;
  }[];
}
interface RawBanner {
  id?: string;
  placement?: string;
  eyebrow?: string;
  title?: string;
  text?: string;
  cta?: { label?: string; href?: string };
  image?: string;
  theme?: string;
}
interface RawLookbook {
  id?: string;
  eyebrow?: string;
  title?: string;
  text?: string;
  image?: string;
  hotspots?: Hotspot[];
}

const root = fileURLToPath(new URL('..', import.meta.url));
const read = <T>(name: string): T =>
  JSON.parse(readFileSync(resolve(root, 'supabase/datos', `${name}.json`), 'utf8')) as T;

/** Id estable (formato UUID) a partir de una clave: la semilla siempre produce los mismos ids. */
export function stableId(key: string): string {
  const h = (seed: number) => {
    let x = seed >>> 0;
    for (let i = 0; i < key.length; i++) {
      x ^= key.charCodeAt(i);
      x = Math.imul(x, 0x01000193) >>> 0;
    }
    return x.toString(16).padStart(8, '0');
  };
  const hex = h(0x811c9dc5) + h(0x1b873593) + h(0xcc9e2d51) + h(0xe6546b64);
  const variant = (8 | (parseInt(hex[16] ?? '0', 16) & 3)).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Reparte las piezas de una talla entre sus colores (determinista). */
function distribute(total: number, n: number, offset: number): number[] {
  const out = Array<number>(n).fill(0);
  for (let k = 0; k < total; k++) out[(k + offset) % n]! += 1;
  return out;
}

/** Costo de ejemplo (≈ 42 % del precio) para que los reportes de utilidad tengan sentido. */
const sampleCost = (price: number) => round2(Math.round((price * 0.42) / 10) * 10);

/* ---------- catálogo ---------- */
const now = new Date('2026-10-17T12:00:00Z');
const seedDate = new Date(now.getTime() - 80 * 864e5).toISOString();
const taxonomy = read<RawTaxonomy>('categories');

const departments = taxonomy.departments.map((d, i) => ({
  slug: d.slug,
  name: d.name,
  description: d.description || '',
  image: d.image || '',
  sort: i,
  active: true,
}));

const categories = taxonomy.categories.map((c, i) => ({
  slug: c.slug,
  department: c.department,
  name: c.name,
  description: c.description || '',
  image: c.image || '',
  sort: c.order ?? i,
  active: true,
}));

const movements: {
  variantId: string;
  productId: string;
  sku: string;
  productName: string;
  variantLabel: string;
  qty: number;
  unitCost: number;
}[] = [];

const products = read<RawProduct[]>('products').map((rp, pi) => {
  const id = stableId(`product:${rp.slug}`);
  const cost = sampleCost(rp.price);
  const colors = rp.colors.map((c, ci) => ({
    id: stableId(`color:${rp.slug}:${c.name}`),
    name: c.name,
    hex: c.hex,
    family: c.family,
    images: [...(c.images || [])],
    sort: ci,
  }));
  const sizes = [...rp.sizes].sort((a, b) => sizeRank(a.label) - sizeRank(b.label));
  const variants = sizes.flatMap((s, si) => {
    const per = distribute(s.stock || 0, colors.length, si);
    return colors.map((c, ci) => ({
      id: stableId(`variant:${rp.slug}:${c.name}:${s.label}`),
      colorId: c.id,
      colorName: c.name,
      size: s.label,
      sku: makeSku(rp.sku, c.name, s.label),
      stock: per[ci] ?? 0,
      minStock: null,
      active: true,
      sort: si,
    }));
  });
  for (const v of variants) {
    if (v.stock) {
      movements.push({
        variantId: v.id,
        productId: id,
        sku: v.sku,
        productName: rp.name,
        variantLabel: `${v.colorName} · ${v.size}`,
        qty: v.stock,
        unitCost: cost,
      });
    }
  }
  const created = rp.createdAt ? new Date(`${rp.createdAt}T16:00:00Z`).toISOString() : seedDate;
  return {
    id,
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
    cost,
    tags: [...(rp.tags || [])],
    isNew: !!rp.isNew,
    isBestseller: !!rp.isBestseller,
    isFeatured: !!rp.isFeatured,
    status: 'activo',
    sort: pi,
    createdAt: created,
    updatedAt: created,
    colors,
    variants,
  };
});

// La portada solo muestra el carrusel principal; los demás lugares se arman con el contenido de cada sección
const banners = read<RawBanner[]>('banners')
  .filter((b) => (b.placement || 'home-carousel') === 'home-carousel')
  .map((b, i) => ({
    id: stableId(`banner:${b.id || i}`),
    placement: b.placement || 'home-carousel',
    eyebrow: b.eyebrow || '',
    title: b.title || '',
    text: b.text || '',
    ctaLabel: b.cta?.label || '',
    ctaHref: b.cta?.href || '',
    image: b.image || '',
    imageMobile: '',
    theme: b.theme || 'light',
    sort: i,
    active: true,
  }));

const lookbooks = read<RawLookbook[]>('lookbooks').map((l, i) => ({
  id: stableId(`look:${l.id || i}`),
  eyebrow: l.eyebrow || '',
  title: l.title || '',
  text: l.text || '',
  image: l.image || '',
  hotspots: (l.hotspots || []).map((h) => ({ ...h })),
  sort: i,
  active: true,
}));

const faq = read<{ q: string; a: string }[]>('faq').map((f, i) => ({
  id: stableId(`faq:${i}`),
  question: f.q,
  answer: f.a,
  sort: i,
  active: true,
}));

const content = read<SiteContent>('content');
const settings = mergeSettings({ public: read<Partial<PublicSettings>>('settings') });
// Datos de Cloudinary que no son secretos; el API Secret se guarda cifrado desde el panel
settings.private.cloudinary = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'ompbjpp9',
  apiKey: process.env.CLOUDINARY_API_KEY || '',
  folder: 'divani',
};

/* ---------- SQL ---------- */
type Value = string | number | boolean | null | undefined;
const q = (v: Value) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const num = (v: Value) => (v === null || v === undefined || v === '' ? 'null' : String(Number(v)));
const bool = (v: Value) => (v ? 'true' : 'false');
const arr = (list: string[] | undefined) =>
  list?.length ? `array[${list.map(q).join(', ')}]::text[]` : "'{}'::text[]";
const json = (v: unknown) => `${q(JSON.stringify(v ?? null))}::jsonb`;
const rows = <T>(list: T[], fn: (x: T) => string[]) => list.map((x) => `  (${fn(x).join(', ')})`).join(',\n');

const colors = products.flatMap((p) => p.colors.map((c) => ({ ...c, productId: p.id })));
const variants = products.flatMap((p) => p.variants.map((v) => ({ ...v, productId: p.id })));

const out = [
  `-- =============================================================================
--  DIVANI · Catálogo inicial
--  Generado por scripts/build-seed.ts a partir de supabase/datos/*.json — no lo edites a mano.
--  Ejecútalo DESPUÉS de supabase/schema.sql. Se puede volver a ejecutar sin duplicar nada.
-- =============================================================================

begin;
`,
  `insert into public.departments (slug, name, description, image, sort, active) values
${rows(departments, (d) => [q(d.slug), q(d.name), q(d.description), q(d.image), num(d.sort), bool(d.active)])}
on conflict (slug) do nothing;
`,
  `insert into public.categories (slug, department, name, description, image, sort, active) values
${rows(categories, (c) => [q(c.slug), q(c.department), q(c.name), q(c.description), q(c.image), num(c.sort), bool(c.active)])}
on conflict (slug) do nothing;
`,
  `insert into public.products (id, slug, code, name, department, category, description, details, material, care, origin,
  price, compare_at_price, cost, tags, is_new, is_bestseller, is_featured, status, sort, created_at, updated_at) values
${rows(products, (p) => [
  q(p.id),
  q(p.slug),
  q(p.code),
  q(p.name),
  q(p.department),
  q(p.category),
  q(p.description),
  arr(p.details),
  q(p.material),
  q(p.care),
  q(p.origin),
  num(p.price),
  num(p.compareAtPrice),
  num(p.cost),
  arr(p.tags),
  bool(p.isNew),
  bool(p.isBestseller),
  bool(p.isFeatured),
  q(p.status),
  num(p.sort),
  q(p.createdAt),
  q(p.updatedAt),
])}
on conflict (id) do nothing;
`,
  `insert into public.product_colors (id, product_id, name, hex, family, images, sort) values
${rows(colors, (c) => [q(c.id), q(c.productId), q(c.name), q(c.hex), q(c.family), arr(c.images), num(c.sort)])}
on conflict (id) do nothing;
`,
  `insert into public.product_variants (id, product_id, color_id, size, sku, stock, min_stock, active, sort) values
${rows(variants, (v) => [q(v.id), q(v.productId), q(v.colorId), q(v.size), q(v.sku), num(v.stock), num(v.minStock), bool(v.active), num(v.sort)])}
on conflict (id) do nothing;
`,
  `insert into public.inventory_movements (variant_id, product_id, sku, product_name, variant_label, type, qty, stock_after, unit_cost, reason, created_by_name, created_at)
select v.variant_id::uuid, v.product_id::uuid, v.sku, v.product_name, v.variant_label, 'inicial', v.qty, v.qty, v.unit_cost, 'Inventario inicial', 'Sistema', v.created_at::timestamptz
from (values
${rows(movements, (m) => [q(m.variantId), q(m.productId), q(m.sku), q(m.productName), q(m.variantLabel), num(m.qty), num(m.unitCost), q(seedDate)])}
) as v (variant_id, product_id, sku, product_name, variant_label, qty, unit_cost, created_at)
where not exists (select 1 from public.inventory_movements m where m.type = 'inicial' and m.variant_id = v.variant_id::uuid);
`,
  `insert into public.banners (id, placement, eyebrow, title, text, cta_label, cta_href, image, image_mobile, theme, sort, active) values
${rows(banners, (b) => [
  q(b.id),
  q(b.placement),
  q(b.eyebrow),
  q(b.title),
  q(b.text),
  q(b.ctaLabel),
  q(b.ctaHref),
  q(b.image),
  q(b.imageMobile),
  q(b.theme),
  num(b.sort),
  bool(b.active),
])}
on conflict (id) do nothing;
`,
  `insert into public.lookbooks (id, eyebrow, title, text, image, hotspots, sort, active) values
${rows(lookbooks, (l) => [q(l.id), q(l.eyebrow), q(l.title), q(l.text), q(l.image), json(l.hotspots), num(l.sort), bool(l.active)])}
on conflict (id) do nothing;
`,
  `insert into public.faq (id, question, answer, sort, active) values
${rows(faq, (f) => [q(f.id), q(f.question), q(f.answer), num(f.sort), bool(f.active)])}
on conflict (id) do nothing;
`,
  `insert into public.site_content (key, value) values
${rows(Object.entries(content), ([k, v]) => [q(k), json(v)])}
on conflict (key) do nothing;
`,
  `-- Ajustes: solo se escriben si todavía están vacíos (no pisa lo que cambies en el panel)
update public.settings set public = ${json(settings.public)} where id = 1 and public = '{}'::jsonb;
update public.settings set private = ${json(settings.private)} where id = 1 and private = '{}'::jsonb;

commit;
`,
];

const file = resolve(root, 'supabase/seed.sql');
writeFileSync(file, out.join('\n'));
console.log(
  `seed.sql: ${products.length} productos, ${variants.length} variantes, ${categories.length} categorías, ${banners.length} banners → ${file}`,
);
