/**
 * Visitas de la tienda (Panel → Visitas): de dónde llegan, desde qué dispositivo y quién no se
 * cuenta. Lo usan la tienda (al registrar cada vista), /api/visita y el panel (al mostrarlas).
 * Todo es anónimo: no se guardan nombres, teléfonos ni direcciones IP.
 */

export const VISIT_SOURCES = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'google', label: 'Google' },
  { id: 'buscador', label: 'Otros buscadores' },
  { id: 'otro', label: 'Otros sitios' },
  { id: 'directo', label: 'Directo' },
] as const;

export type VisitSource = (typeof VISIT_SOURCES)[number]['id'];

export const VISIT_DEVICES = [
  { id: 'celular', label: 'Celular' },
  { id: 'computadora', label: 'Computadora' },
  { id: 'tableta', label: 'Tableta' },
] as const;

export type VisitDevice = (typeof VISIT_DEVICES)[number]['id'];

/** Lo que el navegador guarda para contar visitas (en el mismo sitio que la tienda y el panel). */
export const VISIT_KEYS = {
  /** Número al azar que identifica al navegador. */
  visitor: 'divani.visitante',
  /** Visita en curso: { id, source, last, isNew }. */
  session: 'divani.visita',
  /** Este navegador no se cuenta (el del equipo). */
  skip: 'divani.no-contar',
  /** Ya se borraron las vistas que este navegador hizo antes de entrar al panel. */
  forgotten: 'divani.visitas-olvidadas',
};

/** Una visita termina tras 30 minutos sin ver nada. */
export const VISIT_SESSION_MS = 30 * 60 * 1000;

export const sourceLabel = (id: string): string => VISIT_SOURCES.find((s) => s.id === id)?.label || 'Otros sitios';
export const deviceLabel = (id: string): string => VISIT_DEVICES.find((d) => d.id === id)?.label || 'Celular';

/** Robots, vistas previas de enlaces y navegadores automatizados: no son personas. */
export const isBotAgent = (ua: string): boolean =>
  !ua ||
  /bot\b|bot\/|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|whatsapp\/|telegrambot|preview|pingdom|uptime|monitor|curl\/|wget\/|python-requests|node-fetch/i.test(
    ua,
  );

const UTM: Record<string, VisitSource> = {
  ig: 'instagram',
  instagram: 'instagram',
  fb: 'facebook',
  facebook: 'facebook',
  wa: 'whatsapp',
  whatsapp: 'whatsapp',
  tiktok: 'tiktok',
  tt: 'tiktok',
  google: 'google',
};

/** Dominio de una dirección («https://l.instagram.com/…» → «l.instagram.com»); vacío si no es válida. */
function hostOf(url: string): string {
  try {
    return url ? new URL(url).hostname.toLowerCase() : '';
  } catch {
    return '';
  }
}

/**
 * De dónde llegó la visita. Primero lo que diga el enlace (?utm_source=instagram), después la
 * app desde la que se abrió (el navegador de Instagram o de Facebook) y al final la página de
 * origen. Sin ninguna pista: «directo» (escribieron la dirección o abrieron un enlace sin origen).
 */
export function sourceOf(referrer: string, ua: string, params: URLSearchParams, ownHost = ''): VisitSource {
  const utm = (params.get('utm_source') || '').trim().toLowerCase();
  if (utm) return UTM[utm] || (/insta/.test(utm) ? 'instagram' : /face|meta/.test(utm) ? 'facebook' : 'otro');
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'facebook';
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return 'tiktok';
  if (params.has('fbclid')) return 'facebook';
  if (params.has('gclid')) return 'google';
  const host = hostOf(referrer);
  if (!host || (ownHost && host === ownHost.toLowerCase())) return 'directo';
  if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
  if (/(^|\.)(facebook\.com|fb\.me|fb\.com|messenger\.com)$/.test(host)) return 'facebook';
  if (/(^|\.)(whatsapp\.com|whatsapp\.net|wa\.me)$/.test(host)) return 'whatsapp';
  if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok';
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return 'google';
  if (/(^|\.)(bing\.com|yahoo\.com|duckduckgo\.com|ecosia\.org|yandex\.[a-z]+|search\.brave\.com)$/.test(host))
    return 'buscador';
  return 'otro';
}

/** Celular, tableta o computadora (los iPad nuevos se presentan como Mac, pero tienen pantalla táctil). */
export function deviceOf(ua: string, touchPoints = 0): VisitDevice {
  if (/iPad|Tablet|PlayBook|Silk|Kindle|(Android(?!.*Mobile))/i.test(ua)) return 'tableta';
  if (/Mobi|iPhone|iPod|Android|Windows Phone|Opera Mini/i.test(ua)) return 'celular';
  if (/Macintosh/i.test(ua) && touchPoints > 1) return 'tableta';
  return 'computadora';
}

/** Nombre del país en español a partir de su código (GT → Guatemala). */
export function countryName(code: string | null | undefined): string {
  if (!code || code.length !== 2 || code === 'XX' || code === 'T1') return '';
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

// Cloudflare da las ciudades en inglés y sin tildes: «Guatemala City», «Sacatepequez»
const PLACE_NAMES: Record<string, string> = {
  'guatemala city': 'Ciudad de Guatemala',
  'mexico city': 'Ciudad de México',
  'new york': 'Nueva York',
};
const PLACE_WORDS: Record<string, string> = {
  amatitlan: 'Amatitlán',
  coban: 'Cobán',
  concepcion: 'Concepción',
  jose: 'José',
  lucia: 'Lucía',
  malacatan: 'Malacatán',
  peten: 'Petén',
  poptun: 'Poptún',
  quiche: 'Quiché',
  sacatepequez: 'Sacatepéquez',
  salama: 'Salamá',
  solola: 'Sololá',
  suchitepequez: 'Suchitepéquez',
  totonicapan: 'Totonicapán',
};

/** Nombre de una ciudad o departamento en español («Sacatepequez» → «Sacatepéquez»). */
export function placeName(name: string | null | undefined): string {
  const s = (name || '').trim();
  if (!s) return '';
  return PLACE_NAMES[s.toLowerCase()] || s.replace(/\p{L}+/gu, (w) => PLACE_WORDS[w.toLowerCase()] || w);
}

/**
 * Ciudad y, debajo, departamento (y el país cuando no es el de la tienda).
 * home: código del país de la tienda (GT).
 */
export function placeLabel(
  p: { country: string | null; region: string | null; city: string | null },
  home = 'GT',
): { label: string; sub: string } {
  const city = placeName(p.city);
  const region = placeName(p.region);
  const country = p.country && p.country.toUpperCase() !== home.toUpperCase() ? countryName(p.country) : '';
  if (city) return { label: city, sub: [region !== city ? region : '', country].filter(Boolean).join(' · ') };
  if (region) return { label: region, sub: country };
  if (country) return { label: country, sub: '' };
  return { label: 'Ubicación desconocida', sub: '' };
}
