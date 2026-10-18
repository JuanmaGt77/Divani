/** Mapa del sitio para buscadores: páginas fijas y una dirección por prenda a la venta. */
import type { APIRoute } from 'astro';
import { rpc } from '@/lib/rpc';

export const prerender = false;

const PAGES = ['/', '/tienda', '/aviso-de-privacidad'];

export const GET: APIRoute = async ({ site, url }) => {
  const base = site ?? url;
  let products: { slug: string; updatedAt?: string }[] = [];
  try {
    products = (await rpc<typeof products | null>('storefront_sitemap', {}, { timeout: 8000 })) || [];
  } catch {
    // Sin conexión con la base: al menos las páginas fijas
  }
  const entry = (path: string, lastmod?: string) =>
    `<url><loc>${new URL(path, base).href}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}</url>`;
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...PAGES.map((p) => entry(p)),
    ...products.map((p) => entry(`/producto/${encodeURIComponent(p.slug)}`, p.updatedAt)),
    '</urlset>',
  ].join('\n');
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
};
