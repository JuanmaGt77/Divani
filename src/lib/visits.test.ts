import { describe, expect, it } from 'vitest';
import { countryName, deviceOf, isBotAgent, placeLabel, placeName, sourceOf } from './visits';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const INSTAGRAM_APP = `${IPHONE} Instagram 340.0.0.22.109 (iPhone15,2; iOS 17_5; es_GT)`;
const FACEBOOK_APP = `${IPHONE} [FBAN/FBIOS;FBAV/470.0.0.43.109]`;
const ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const none = new URLSearchParams();

describe('visitas: de dónde llegan', () => {
  it('reconoce el enlace con utm_source', () => {
    expect(sourceOf('', IPHONE, new URLSearchParams('utm_source=ig'))).toBe('instagram');
    expect(sourceOf('', IPHONE, new URLSearchParams('utm_source=Facebook'))).toBe('facebook');
    expect(sourceOf('', IPHONE, new URLSearchParams('utm_source=boletin'))).toBe('otro');
  });

  it('reconoce el navegador de Instagram y de Facebook aunque no haya página de origen', () => {
    expect(sourceOf('', INSTAGRAM_APP, none)).toBe('instagram');
    expect(sourceOf('', FACEBOOK_APP, none)).toBe('facebook');
  });

  it('reconoce la página de origen', () => {
    expect(sourceOf('https://l.instagram.com/?u=x', IPHONE, none)).toBe('instagram');
    expect(sourceOf('https://m.facebook.com/', IPHONE, none)).toBe('facebook');
    expect(sourceOf('https://web.whatsapp.com/', WINDOWS, none)).toBe('whatsapp');
    expect(sourceOf('https://www.google.com.gt/', IPHONE, none)).toBe('google');
    expect(sourceOf('https://duckduckgo.com/', IPHONE, none)).toBe('buscador');
    expect(sourceOf('https://unblog.com/post', IPHONE, none)).toBe('otro');
  });

  it('sin pistas o desde la misma tienda es «directo»', () => {
    expect(sourceOf('', IPHONE, none)).toBe('directo');
    expect(sourceOf('https://divani.gt/tienda', IPHONE, none, 'divani.gt')).toBe('directo');
    expect(sourceOf('esto no es una dirección', IPHONE, none)).toBe('directo');
  });
});

describe('visitas: dispositivo y robots', () => {
  it('distingue celular, tableta y computadora', () => {
    expect(deviceOf(IPHONE)).toBe('celular');
    expect(deviceOf(ANDROID_TABLET)).toBe('tableta');
    expect(deviceOf(WINDOWS)).toBe('computadora');
    expect(deviceOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 5)).toBe('tableta');
  });

  it('no cuenta robots ni vistas previas de enlaces', () => {
    expect(isBotAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
    expect(isBotAgent('facebookexternalhit/1.1')).toBe(true);
    expect(isBotAgent('WhatsApp/2.24.10.85 A')).toBe(true);
    expect(isBotAgent('Mozilla/5.0 HeadlessChrome/126.0')).toBe(true);
    expect(isBotAgent('')).toBe(true);
    expect(isBotAgent(IPHONE)).toBe(false);
    expect(isBotAgent(INSTAGRAM_APP)).toBe(false);
  });

  it('nombra el país en español', () => {
    expect(countryName('GT')).toBe('Guatemala');
    expect(countryName('XX')).toBe('');
    expect(countryName(null)).toBe('');
  });
});

describe('visitas: desde dónde', () => {
  it('pone las ciudades en español y con tildes', () => {
    expect(placeName('Guatemala City')).toBe('Ciudad de Guatemala');
    expect(placeName('Sacatepequez')).toBe('Sacatepéquez');
    expect(placeName('San Jose Pinula')).toBe('San José Pinula');
    expect(placeName('Mixco')).toBe('Mixco');
    expect(placeName(null)).toBe('');
  });

  it('muestra la ciudad con su departamento y el país solo si es otro', () => {
    expect(placeLabel({ country: 'GT', region: 'Guatemala', city: 'Guatemala City' })).toEqual({
      label: 'Ciudad de Guatemala',
      sub: 'Guatemala',
    });
    expect(placeLabel({ country: 'US', region: 'California', city: 'Los Angeles' })).toEqual({
      label: 'Los Angeles',
      sub: 'California · Estados Unidos',
    });
    expect(placeLabel({ country: 'GT', region: 'Peten', city: null })).toEqual({ label: 'Petén', sub: '' });
    expect(placeLabel({ country: null, region: null, city: null }).label).toBe('Ubicación desconocida');
  });
});
