/**
 * Configuración general de la tienda.
 * Lo que cambia por entorno (número de WhatsApp, URL del backend) viene de las
 * variables VITE_* del archivo .env (ver .env.example).
 */
const env = import.meta.env ?? {};

const whatsappNumber = String(env.VITE_WHATSAPP_NUMBER || '525500000000').replace(/\D/g, '');

export const SITE = {
  name: 'Divani',
  tagline: 'Fashion in you',
  description: 'Ropa americana premium con etiqueta original. Compra fácil por WhatsApp.',
  // Dominio público de la tienda (se usa en los enlaces que se comparten). Ej.: 'https://divani.mx'
  url: '',
  locale: 'es-MX',
  currency: 'MXN',
  currencyName: 'pesos mexicanos',
  shippingArea: 'todo México',
  cityLabel: 'Ciudad y estado',
  cityPlaceholder: 'Ej. Guadalajara, Jalisco',
  address: '',
  email: '',
  whatsapp: {
    number: whatsappNumber,
    // Cómo se muestra el número en la página
    display: formatPhone(whatsappNumber),
  },
  hours: 'Lunes a sábado · 10:00 a 19:00 h',
  city: 'México',
  // Deja una cadena vacía para ocultar la red social
  social: {
    instagram: 'https://www.instagram.com/',
    facebook: 'https://www.facebook.com/',
    tiktok: 'https://www.tiktok.com/',
  },
};

/** Cambia el número de WhatsApp en tiempo de ejecución (por ejemplo, desde settings.json o el backend). */
export function setWhatsAppNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 10) return false;
  SITE.whatsapp.number = digits;
  SITE.whatsapp.display = formatPhone(digits);
  return true;
}

export const API = {
  // Vacío = modo de datos de prueba (public/data/*.json)
  baseUrl: String(env.VITE_API_URL || '').replace(/\/$/, ''),
  mockPath: 'data',
  timeout: 12000,
};

export const CATALOG = {
  pageSize: 12,
  // A partir de cuántas piezas se muestra «Últimas piezas»
  lowStock: 2,
  // Días que un producto se considera «Nuevo» si no trae isNew
  newDays: 21,
};

export const STORAGE_KEYS = {
  cart: 'divani.cart.v1',
  favorites: 'divani.favorites.v1',
  recentSearches: 'divani.recent-searches.v1',
  customer: 'divani.customer.v1',
  introSeen: 'divani.intro.v1',
};

export function formatPhone(n) {
  // México: +52 55 1234 5678 · Guatemala: +502 5555 1234 · EE. UU.: +1 713 555 1234
  let m = n.match(/^(52)1?(\d{2})(\d{4})(\d{4})$/);
  if (m) return `+${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  m = n.match(/^(502)(\d{4})(\d{4})$/);
  if (m) return `+${m[1]} ${m[2]} ${m[3]}`;
  m = n.match(/^(1)(\d{3})(\d{3})(\d{4})$/);
  if (m) return `+${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  return `+${n}`;
}
