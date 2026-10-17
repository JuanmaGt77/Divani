#!/usr/bin/env node
/**
 * Genera supabase/seed.sql a partir del catálogo de muestra (public/data/*.json).
 * Uso:  npm run seed:build
 * El SQL resultante se puede ejecutar varias veces: solo inserta lo que no existe y
 * no sobrescribe ajustes ni contenido que ya hayas cambiado desde el panel.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { buildCatalog } from '../src/backend/seed.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (name) => JSON.parse(readFileSync(resolve(root, 'public/data', `${name}.json`), 'utf8'));

const src = Object.fromEntries(['products', 'categories', 'banners', 'lookbooks', 'faq', 'settings', 'content'].map((n) => [n, read(n)]));
const db = buildCatalog(src, { now: new Date('2026-10-17T12:00:00Z') });

// Datos de Cloudinary que no son secretos (el API secret se guarda desde el panel)
db.settings.private.cloudinary = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'ompbjpp9',
  apiKey: process.env.CLOUDINARY_API_KEY || '572154871739513',
  folder: 'divani',
};

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => (v === null || v === undefined || v === '' ? 'null' : String(Number(v)));
const bool = (v) => (v ? 'true' : 'false');
const arr = (list) => (list?.length ? `array[${list.map(q).join(', ')}]::text[]` : "'{}'::text[]");
const json = (v) => `${q(JSON.stringify(v ?? null))}::jsonb`;
const rows = (list, fn) => list.map((x) => `  (${fn(x).join(', ')})`).join(',\n');

const out = [];
out.push(`-- =============================================================================
--  DIVANI · Catálogo inicial
--  Generado por scripts/build-seed.mjs a partir de public/data/*.json — no lo edites a mano.
--  Ejecútalo DESPUÉS de supabase/schema.sql. Se puede volver a ejecutar sin duplicar nada.
-- =============================================================================

begin;
`);

out.push(`insert into public.departments (slug, name, description, image, sort, active) values
${rows(db.departments, (d) => [q(d.slug), q(d.name), q(d.description), q(d.image), num(d.sort), bool(d.active)])}
on conflict (slug) do nothing;
`);

out.push(`insert into public.categories (slug, department, name, description, image, sort, active) values
${rows(db.categories, (c) => [q(c.slug), q(c.department), q(c.name), q(c.description), q(c.image), num(c.sort), bool(c.active)])}
on conflict (slug) do nothing;
`);

out.push(`insert into public.products (id, slug, code, name, department, category, description, details, material, care, origin,
  price, compare_at_price, cost, tags, is_new, is_bestseller, is_featured, status, sort, created_at, updated_at) values
${rows(db.products, (p) => [q(p.id), q(p.slug), q(p.code), q(p.name), q(p.department), q(p.category), q(p.description), arr(p.details),
    q(p.material), q(p.care), q(p.origin), num(p.price), num(p.compareAtPrice), num(p.cost), arr(p.tags),
    bool(p.isNew), bool(p.isBestseller), bool(p.isFeatured), q(p.status), num(p.sort), q(p.createdAt), q(p.updatedAt)])}
on conflict (id) do nothing;
`);

const colors = db.products.flatMap((p) => p.colors.map((c) => ({ ...c, productId: p.id })));
out.push(`insert into public.product_colors (id, product_id, name, hex, family, images, sort) values
${rows(colors, (c) => [q(c.id), q(c.productId), q(c.name), q(c.hex), q(c.family), arr(c.images), num(c.sort)])}
on conflict (id) do nothing;
`);

const variants = db.products.flatMap((p) => p.variants.map((v) => ({ ...v, productId: p.id })));
out.push(`insert into public.product_variants (id, product_id, color_id, size, sku, stock, min_stock, active, sort) values
${rows(variants, (v) => [q(v.id), q(v.productId), q(v.colorId), q(v.size), q(v.sku), num(v.stock), num(v.minStock), bool(v.active), num(v.sort)])}
on conflict (id) do nothing;
`);

out.push(`insert into public.inventory_movements (variant_id, product_id, sku, product_name, variant_label, type, qty, stock_after, unit_cost, reason, created_by_name, created_at)
select v.variant_id::uuid, v.product_id::uuid, v.sku, v.product_name, v.variant_label, 'inicial', v.qty, v.qty, v.unit_cost, 'Inventario inicial', 'Sistema', v.created_at::timestamptz
from (values
${rows(db.movements, (m) => [q(m.variantId), q(m.productId), q(m.sku), q(m.productName), q(m.variantLabel), num(m.qty), num(m.unitCost), q(m.createdAt)])}
) as v (variant_id, product_id, sku, product_name, variant_label, qty, unit_cost, created_at)
where not exists (select 1 from public.inventory_movements m where m.type = 'inicial' and m.variant_id = v.variant_id::uuid);
`);

out.push(`insert into public.banners (id, placement, eyebrow, title, text, cta_label, cta_href, image, image_mobile, theme, sort, active) values
${rows(db.banners, (b) => [q(b.id), q(b.placement), q(b.eyebrow), q(b.title), q(b.text), q(b.ctaLabel), q(b.ctaHref), q(b.image), q(b.imageMobile), q(b.theme), num(b.sort), bool(b.active)])}
on conflict (id) do nothing;
`);

out.push(`insert into public.lookbooks (id, eyebrow, title, text, image, hotspots, sort, active) values
${rows(db.lookbooks, (l) => [q(l.id), q(l.eyebrow), q(l.title), q(l.text), q(l.image), json(l.hotspots), num(l.sort), bool(l.active)])}
on conflict (id) do nothing;
`);

out.push(`insert into public.faq (id, question, answer, sort, active) values
${rows(db.faq, (f) => [q(f.id), q(f.question), q(f.answer), num(f.sort), bool(f.active)])}
on conflict (id) do nothing;
`);

out.push(`insert into public.site_content (key, value) values
${rows(Object.entries(db.content), ([k, v]) => [q(k), json(v)])}
on conflict (key) do nothing;
`);

out.push(`-- Ajustes: solo se escriben si todavía están vacíos (no pisa lo que cambies en el panel)
update public.settings set public = ${json(db.settings.public)} where id = 1 and public = '{}'::jsonb;
update public.settings set private = ${json(db.settings.private)} where id = 1 and private = '{}'::jsonb;

commit;
`);

const file = resolve(root, 'supabase/seed.sql');
writeFileSync(file, out.join('\n'));
console.log(`seed.sql: ${db.products.length} productos, ${variants.length} variantes, ${db.categories.length} categorías, ${db.banners.length} banners → ${file}`);
