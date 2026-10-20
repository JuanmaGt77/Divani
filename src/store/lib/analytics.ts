/**
 * Contador de visitas anónimo (Panel → Visitas). Sin cookies ni datos personales: un número al
 * azar identifica al navegador y otro a la visita, que termina tras 30 minutos sin actividad.
 * Cada vista se envía en segundo plano a /api/visita (no hace esperar a la página).
 * No se cuentan: el equipo (navegadores con el panel abierto), la vista previa del panel,
 * las pruebas en la computadora (localhost), navegadores automatizados ni robots.
 */
import { AUTH_STORAGE_KEY } from '@/lib/env';
import { VISIT_KEYS, VISIT_SESSION_MS, deviceOf, isBotAgent, sourceOf, type VisitSource } from '@/lib/visits';
import { isEditMode } from './hydration';

const ENDPOINT = '/api/visita';

interface VisitSession {
  id: string;
  source: VisitSource;
  last: number;
  isNew: boolean;
}

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function counted(): boolean {
  try {
    if (navigator.webdriver || isEditMode() || location.pathname.startsWith('/admin')) return false;
    // Las pruebas en la computadora (npm run dev / preview) no son visitas reales
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return false;
    if (isBotAgent(navigator.userAgent)) return false;
    const doc = document as Document & { prerendering?: boolean };
    if (doc.prerendering) return false;
    return !localStorage.getItem(AUTH_STORAGE_KEY) && !localStorage.getItem(VISIT_KEYS.skip);
  } catch {
    // Sin acceso al almacenamiento (modo muy privado): no se cuenta
    return false;
  }
}

function savedSession(): VisitSession | null {
  try {
    return JSON.parse(localStorage.getItem(VISIT_KEYS.session) || 'null') as VisitSession | null;
  } catch {
    return null;
  }
}

/** Navegador y visita en curso (una visita nueva si pasaron 30 minutos sin ver nada). */
function current(): { visitor: string; session: VisitSession } {
  let visitor = localStorage.getItem(VISIT_KEYS.visitor);
  let firstTime = false;
  if (!visitor) {
    visitor = uuid();
    firstTime = true;
    localStorage.setItem(VISIT_KEYS.visitor, visitor);
  }
  const now = Date.now();
  let session = savedSession();
  if (!session?.id || now - (session.last || 0) > VISIT_SESSION_MS) {
    session = {
      id: uuid(),
      source: sourceOf(document.referrer, navigator.userAgent, new URLSearchParams(location.search), location.host),
      last: now,
      isNew: firstTime,
    };
  }
  session.last = now;
  localStorage.setItem(VISIT_KEYS.session, JSON.stringify(session));
  return { visitor, session };
}

function send(extra: { kind: 'page' | 'product'; path: string; product: string | null }): void {
  if (!counted()) return;
  try {
    const { visitor, session } = current();
    const body = JSON.stringify({
      ...extra,
      visitor,
      session: session.id,
      source: session.source,
      isNew: session.isNew,
      device: deviceOf(navigator.userAgent, navigator.maxTouchPoints || 0),
    });
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon?.(ENDPOINT, blob)) return;
    void fetch(ENDPOINT, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // El contador nunca debe estorbar a la tienda
  }
}

/** Una vista de página (se llama al cargar cada página de la tienda). */
export function trackPage(): void {
  const product = /^\/producto\/([^/?#]+)/.exec(location.pathname)?.[1];
  send({ kind: 'page', path: location.pathname, product: product ? decodeURIComponent(product) : null });
}

/** Una prenda vista en la vista rápida (cuenta para «prendas más vistas»). */
export function trackProduct(slug: string): void {
  send({ kind: 'product', path: location.pathname, product: slug });
}
