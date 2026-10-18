import { describe, expect, it } from 'vitest';
import { facetsOf, queryProducts } from './catalog-query';
import type { StoreProduct } from './types';

const product = (over: Partial<StoreProduct>): StoreProduct => ({
  id: over.slug || 'x',
  sku: 'DV-MUJ-001',
  slug: 'x',
  name: 'Prenda',
  department: 'mujer',
  category: 'vestidos',
  price: 500,
  compareAtPrice: null,
  description: '',
  details: [],
  material: '',
  care: '',
  origin: '',
  colors: [{ name: 'Negro', hex: '#111', family: 'negro', images: [], sizes: [{ label: 'M', stock: 1 }] }],
  sizes: [{ label: 'M', stock: 1 }],
  isNew: false,
  isBestseller: false,
  isFeatured: false,
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});

const catalog = [
  product({ slug: 'vestido-satin', name: 'Vestido de satín', price: 899, isFeatured: true, createdAt: '2026-03-01' }),
  product({
    slug: 'jeans',
    name: 'Jeans wide leg',
    category: 'jeans',
    price: 799,
    compareAtPrice: 999,
    createdAt: '2026-05-01',
  }),
  product({
    slug: 'polo',
    name: 'Polo piqué',
    department: 'hombre',
    category: 'playeras',
    price: 450,
    isBestseller: true,
    sizes: [{ label: 'L', stock: 0 }],
  }),
];

describe('catálogo de la tienda', () => {
  it('filtra por departamento y busca sin acentos', () => {
    expect(queryProducts(catalog, { department: 'mujer' }).meta.total).toBe(2);
    expect(queryProducts(catalog, { q: 'SATIN' }).data.map((p) => p.slug)).toEqual(['vestido-satin']);
    expect(queryProducts(catalog, { q: 'vestidos' }).data.map((p) => p.slug)).toEqual(['vestido-satin']);
  });

  it('filtra ofertas, precio y existencias', () => {
    expect(queryProducts(catalog, { onSale: true }).data.map((p) => p.slug)).toEqual(['jeans']);
    expect(queryProducts(catalog, { minPrice: 500, maxPrice: 850 }).data.map((p) => p.slug)).toEqual(['jeans']);
    expect(queryProducts(catalog, { inStock: true }).meta.total).toBe(2);
  });

  it('ordena por precio y destacados', () => {
    expect(queryProducts(catalog, { sort: 'precio-asc' }).data.map((p) => p.price)).toEqual([450, 799, 899]);
    expect(queryProducts(catalog, {}).data[0]?.slug).toBe('vestido-satin');
  });

  it('pagina los resultados', () => {
    const res = queryProducts(catalog, { pageSize: 2, page: 2 });
    expect(res.data).toHaveLength(1);
    expect(res.meta).toEqual({ total: 3, page: 2, pageSize: 2, pages: 2 });
  });

  it('calcula las opciones de filtro', () => {
    const f = facetsOf(catalog);
    expect(f.categories).toEqual({ vestidos: 1, jeans: 1, playeras: 1 });
    expect(f.sizes).toEqual({ M: 2 });
    expect(f.price).toEqual({ min: 450, max: 899 });
  });
});
