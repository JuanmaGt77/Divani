/**
 * Aplica en la tienda lo que se configura en el panel (Configuración): nombre, WhatsApp,
 * horario, redes y región (moneda, lada, a dónde se envía y cómo se pide la ciudad).
 */
import { SITE, setWhatsAppNumber } from '../config/site.config.js';
import { setMoneyFormat } from './format.js';

let last = '';

export function applySiteSettings(s) {
  if (!s) return s;
  const key = JSON.stringify([s.store, s.region, s.whatsapp]);
  if (key === last) return s;
  last = key;

  const store = s.store || {};
  if (store.name) SITE.name = store.name;
  if (store.hours) SITE.hours = store.hours;
  SITE.address = store.address || '';
  SITE.email = store.email || '';
  if (store.social) SITE.social = { ...store.social };
  setWhatsAppNumber(s.whatsapp);

  const r = s.region || {};
  for (const k of ['locale', 'currency', 'currencyName', 'shippingArea', 'cityLabel', 'cityPlaceholder']) {
    if (r[k]) SITE[k] = r[k];
  }
  setMoneyFormat(SITE.locale, SITE.currency);
  document.documentElement.lang = SITE.locale;
  return s;
}
