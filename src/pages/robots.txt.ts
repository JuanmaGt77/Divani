/** robots.txt: todo visible para buscadores menos el panel, con la dirección del mapa del sitio. */
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = ({ site, url }) => {
  const sitemap = new URL('/sitemap.xml', site ?? url).href;
  const body = [
    'User-agent: *',
    'Allow: /',
    '# El panel de administración no debe aparecer en buscadores',
    'Disallow: /admin',
    '',
    `Sitemap: ${sitemap}`,
    '',
  ].join('\n');
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  });
};
