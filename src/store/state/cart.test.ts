import { describe, expect, it } from 'vitest';
import type { StoreProduct } from '@/lib/types';
import { syncLines, type CartLine } from './cart';

const linea: CartLine = {
  key: 'vestido|Negro|M',
  slug: 'vestido',
  sku: 'DV-1',
  name: 'Vestido',
  price: 100,
  color: 'Negro',
  size: 'M',
  image: 'a.webp',
  qty: 3,
  max: 5,
};

const prenda = (precio: number, stock: number): StoreProduct =>
  ({
    slug: 'vestido',
    name: 'Vestido nuevo',
    price: precio,
    sizes: [{ label: 'M', stock, sku: 'DV-1' }],
    colors: [{ name: 'Negro', hex: '#000000', images: [], sizes: [{ label: 'M', stock, sku: 'DV-1' }] }],
  }) as unknown as StoreProduct;

describe('syncLines', () => {
  it('pone al día el nombre y el precio', () => {
    expect(syncLines([linea], [prenda(80, 5)])[0]).toMatchObject({ name: 'Vestido nuevo', price: 80, qty: 3, max: 5 });
  });

  it('baja la cantidad si ya no hay tantas piezas', () => {
    expect(syncLines([linea], [prenda(100, 2)])[0]).toMatchObject({ qty: 2, max: 2 });
  });

  it('deja la línea de una talla agotada: el aviso sale al enviar el pedido', () => {
    expect(syncLines([linea], [prenda(100, 0)])[0]).toMatchObject({ qty: 3, max: 0 });
  });

  it('no toca lo que ya no está a la venta', () => {
    expect(syncLines([linea], [])[0]).toEqual(linea);
  });
});
