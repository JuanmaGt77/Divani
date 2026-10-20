import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  REGION_PRESETS,
  cdn,
  colorCode,
  guessFamily,
  makeSku,
  mergeSettings,
  normalize,
  bannerTheme,
  normalizeBanner,
  normalizeShowcase,
  readBannerTheme,
  writeBannerTheme,
  normalizeFaq,
  normalizeLookbook,
  orderTotals,
  productStock,
  sizeCode,
  sizeRank,
  slugify,
  storeHref,
} from './model';
import type { Product } from './types';

describe('SKU por variante', () => {
  it('arma código + color + talla', () => {
    expect(makeSku('DV-MUJ-001', 'Negro', 'M')).toBe('DV-MUJ-001-NEG-M');
    expect(makeSku('DV-MUJ-001', 'Azul claro', '28')).toBe('DV-MUJ-001-AZC-28');
  });

  it('usa códigos cortos y sin acentos', () => {
    expect(colorCode('Champagne')).toBe('CHA');
    expect(colorCode('Café')).toBe('CAF');
    expect(colorCode('Rojo vino')).toBe('ROV');
    expect(colorCode('')).toBe('COL');
    expect(colorCode('Ok')).toBe('OKX');
    expect(sizeCode('Única')).toBe('UNI');
    expect(sizeCode('')).toBe('U');
    expect(sizeCode('2T')).toBe('2T');
  });
});

describe('orden de tallas', () => {
  it('ordena infantiles, números y letras', () => {
    const sizes = ['L', '2T', 'XS', '28', 'Única', '5', 'M'];
    expect([...sizes].sort((a, b) => sizeRank(a) - sizeRank(b))).toEqual(['2T', '5', '28', 'XS', 'M', 'L', 'Única']);
  });
});

describe('textos', () => {
  it('normaliza y crea direcciones', () => {
    expect(normalize('  Niñas ')).toBe('ninas');
    expect(slugify('Vestido Slip & Satín')).toBe('vestido-slip-y-satin');
  });

  it('sugiere la familia de color', () => {
    expect(guessFamily('#111111')).toBe('negro');
    expect(guessFamily('#F6F2EA')).toBe('blanco');
    expect(guessFamily('#2E5FA3')).toBe('azul');
    expect(guessFamily('nada')).toBe('beige');
  });
});

describe('totales del pedido', () => {
  it('aplica descuentos por prenda, del pedido y envío', () => {
    const t = orderTotals({
      items: [
        { unitPrice: 899, qty: 1, discount: 100, unitCost: 300 },
        { unitPrice: 799, qty: 2, unitCost: 250 },
      ],
      discount: 50,
      shipping: 35,
    });
    expect(t.subtotal).toBe(2497);
    expect(t.lineDiscount).toBe(100);
    expect(t.orderDiscount).toBe(50);
    expect(t.discountTotal).toBe(150);
    expect(t.net).toBe(2347);
    expect(t.total).toBe(2382);
    expect(t.itemsCount).toBe(3);
    expect(t.costTotal).toBe(800);
  });

  it('nunca descuenta más que el subtotal', () => {
    const t = orderTotals({ items: [{ unitPrice: 100, qty: 1, discount: 500 }], discount: 80 });
    expect(t.lineDiscount).toBe(100);
    expect(t.orderDiscount).toBe(0);
    expect(t.total).toBe(0);
  });
});

describe('existencias', () => {
  it('suma solo variantes activas y sin negativos', () => {
    const p = {
      variants: [
        { stock: 3, active: true },
        { stock: 2, active: false },
        { stock: -1, active: true },
      ],
    } as unknown as Product;
    expect(productStock(p)).toBe(3);
  });
});

describe('ajustes', () => {
  it('la región por defecto es Guatemala', () => {
    expect(DEFAULT_SETTINGS.public.region.preset).toBe('gt');
    expect(DEFAULT_SETTINGS.public.region.currency).toBe('GTQ');
    expect(DEFAULT_SETTINGS.private.cash.denominations).toEqual(REGION_PRESETS.gt.denominations);
  });

  it('los avisos de fábrica no hablan de etiquetas', () => {
    expect(DEFAULT_SETTINGS.public.announcements.join(' ')).not.toMatch(/etiqueta/i);
  });

  it('une lo guardado con los valores por defecto', () => {
    const s = mergeSettings({ public: { store: { name: 'Mi tienda' }, announcements: ['Hola'] } });
    expect(s.public.store.name).toBe('Mi tienda');
    expect(s.public.store.hours).toBe(DEFAULT_SETTINGS.public.store.hours);
    expect(s.public.announcements).toEqual(['Hola']);
    expect(s.private.inventory.skuPrefix).toBe('DV');
  });

  it('no modifica los valores por defecto', () => {
    const s = mergeSettings({});
    s.public.store.name = 'Otra';
    expect(DEFAULT_SETTINGS.public.store.name).toBe('Divani');
  });
});

describe('imágenes', () => {
  it('agrega formato y ancho a Cloudinary', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1/divani/foto.jpg';
    expect(cdn(url, { w: 640 })).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_640/v1/divani/foto.jpg',
    );
  });

  it('respeta las transformaciones que ya trae', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/w_100/divani/foto.jpg';
    expect(cdn(url, { w: 640 })).toBe(url);
  });

  it('vuelve absolutas las rutas locales', () => {
    expect(cdn('images/products/a.webp')).toBe('/images/products/a.webp');
    expect(cdn('/brand/logo.svg')).toBe('/brand/logo.svg');
    expect(cdn('data:image/png;base64,xx')).toBe('data:image/png;base64,xx');
    expect(cdn('')).toBe('');
  });
});

describe('enlaces de la tienda', () => {
  it('convierte los enlaces del formato anterior', () => {
    expect(storeHref('tienda.html?depto=mujer')).toBe('/tienda?depto=mujer');
    expect(storeHref('tienda.html')).toBe('/tienda');
    expect(storeHref('index.html#look')).toBe('/#look');
    expect(storeHref('/tienda?oferta=1')).toBe('/tienda?oferta=1');
    expect(storeHref('https://instagram.com/divani')).toBe('https://instagram.com/divani');
    expect(storeHref('')).toBe('/tienda');
  });
});

describe('contenido', () => {
  it('valida banners', () => {
    expect(() => normalizeBanner({ image: 'x.jpg' })).toThrow('Escribe el título del banner.');
    const b = normalizeBanner({ image: 'x.jpg', title: '  Rebajas  ', ctaHref: '' });
    expect(b.title).toBe('Rebajas');
    expect(b.ctaHref).toBe('/tienda');
    expect(b.active).toBe(true);
    // Sin foto basta con mostrar prendas; sin prendas hace falta la foto
    expect(normalizeBanner({ title: 'Novedades' }).showcase).toEqual({ source: 'nuevo' });
    expect(() => normalizeBanner({ title: 'Hola', showcase: { source: 'ninguna' } })).toThrow('Sube una foto');
    expect(() => normalizeBanner({ title: 'Hola', showcase: { source: 'categoria' } })).toThrow('Elige la categoría');
    expect(() => normalizeBanner({ title: 'Hola', showcase: { source: 'elegidas', products: [] } })).toThrow(
      'Elige al menos una prenda',
    );
  });

  it('acomoda el color y las prendas de la portada', () => {
    expect(bannerTheme('light')).toBe('arena');
    expect(bannerTheme('dark')).toBe('tinta');
    expect(bannerTheme('rosa')).toBe('rosa');
    expect(normalizeShowcase({ source: 'elegidas', products: ['a', 'a', ' b ', '', 'c', 'd'] })).toEqual({
      source: 'elegidas',
      products: ['a', 'b', 'c'],
    });
    expect(normalizeShowcase({ source: 'otra' as never })).toEqual({ source: 'nuevo' });
  });

  it('guarda color y prendas juntos en la columna theme', () => {
    expect(readBannerTheme('light')).toEqual({ theme: 'arena', showcase: { source: 'nuevo' } });
    expect(readBannerTheme('{roto')).toEqual({ theme: 'arena', showcase: { source: 'nuevo' } });
    const raw = writeBannerTheme('rosa', { source: 'categoria', category: 'vestidos' });
    expect(JSON.parse(raw)).toEqual({ color: 'rosa', showcase: { source: 'categoria', category: 'vestidos' } });
    expect(readBannerTheme(raw)).toEqual({ theme: 'rosa', showcase: { source: 'categoria', category: 'vestidos' } });
  });

  it('acomoda los puntos del look dentro de la foto', () => {
    const l = normalizeLookbook({
      image: 'x.jpg',
      title: 'Look',
      hotspots: [
        { product: 'a', color: '', x: 120, y: -5 },
        { product: '', color: '', x: 10, y: 10 },
      ],
    });
    expect(l.hotspots).toEqual([{ product: 'a', color: '', x: 97, y: 3 }]);
  });

  it('valida preguntas', () => {
    expect(() => normalizeFaq({ question: '¿Hacen envíos?' })).toThrow('Escribe la respuesta.');
  });
});
