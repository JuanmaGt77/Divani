/**
 * Recibe cada vista de la tienda (Panel → Visitas) y la guarda en Supabase en segundo plano.
 * Le agrega el país, el departamento y la ciudad aproximados que da Cloudflare. Nunca guarda la
 * dirección IP ni datos personales. Responde enseguida aunque falle el guardado.
 */
import type { APIRoute } from 'astro';
import { rpc } from '@/lib/rpc';
import { VISIT_DEVICES, VISIT_SOURCES, isBotAgent } from '@/lib/visits';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCES = new Set<string>(VISIT_SOURCES.map((s) => s.id));
const DEVICES = new Set<string>(VISIT_DEVICES.map((d) => d.id));

type CfRequest = Request & { cf?: { country?: string; region?: string; city?: string } };

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s || null;
};

export const POST: APIRoute = async ({ request, locals }) => {
  const done = new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  if (isBotAgent(request.headers.get('user-agent') || '')) return done;

  // Solo vistas enviadas desde la propia tienda
  const origin = request.headers.get('origin');
  try {
    if (origin && new URL(origin).host !== new URL(request.url).host) return done;
  } catch {
    return done;
  }

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 2000) return done;
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return done;
  }
  const visitor = String(body.visitor || '');
  const session = String(body.session || '');
  const path = text(body.path, 200) || '/';
  if (!UUID.test(visitor) || !UUID.test(session) || !path.startsWith('/') || path.startsWith('/admin')) return done;

  const cf = (request as CfRequest).cf;
  const payload = {
    visitor,
    session,
    kind: body.kind === 'product' ? 'product' : 'page',
    path,
    product: text(body.product, 120),
    source: SOURCES.has(String(body.source)) ? body.source : 'otro',
    device: DEVICES.has(String(body.device)) ? body.device : 'celular',
    isNew: body.isNew === true,
    country: text(cf?.country, 2),
    region: text(cf?.region, 80),
    city: text(cf?.city, 80),
  };

  const save = rpc('track_visit', { payload }, { timeout: 8000 }).catch(() => {});
  const ctx = (locals as { cfContext?: { waitUntil(p: Promise<unknown>): void } }).cfContext;
  if (ctx) ctx.waitUntil(save);
  else await save;
  return done;
};
