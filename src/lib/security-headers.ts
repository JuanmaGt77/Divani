/**
 * Cabeceras de seguridad de la tienda y el panel. Las páginas que genera el Worker las reciben en
 * src/worker.ts; los archivos estáticos, en public/_headers. Los dos lugares deben coincidir
 * (hay una prueba que lo revisa). Si la tienda empieza a cargar algo de otro dominio, agrégalo aquí.
 */
const CSP = [
  "default-src 'self'",
  // 'unsafe-inline': Astro arranca las islas con scripts en línea. Nada de 'unsafe-eval'.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "media-src 'self' blob: https://res.cloudinary.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.cloudinary.com https://res.cloudinary.com",
  // La vista previa del panel muestra la tienda en un iframe del mismo sitio
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP,
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  // Deja abrir WhatsApp en otra pestaña, pero aísla la ventana de las que la abren a ella
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
};
