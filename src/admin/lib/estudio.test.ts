import { describe, expect, it } from 'vitest';
import type { Taxonomy } from '@/lib/types';
import type { Ficha, PasoPublico, Trabajo } from '@/estudio/tipos';
import { fotosSinImportar, importarTrabajo, nombreArchivo, puedeImportar, tiempo, urlJpg } from './estudio';

const paso = (estado: PasoPublico['estado']): PasoPublico => ({
  estado,
  error: null,
  nota: null,
  version: 1,
  intento: 1,
  segundos: 3,
});

const ficha: Ficha = {
  tipo_prenda: 'vestido',
  departamento: 'mujer',
  departamento_nombre: 'Mujer',
  grupo: 'vestido',
  estilo: 'fiesta',
  nombre: 'Vestido slip satinado',
  descripcion: 'Caída líquida.',
  detalles: ['Tirantes ajustables', 'Largo midi'],
  material: '95% poliéster',
  material_de_etiqueta: true,
  cuidados: 'Lavar en frío.',
  cuidados_de_etiqueta: false,
  origen: 'Importado de EE. UU.',
  color: 'Azul marino',
  color_hex: '#1B2A49',
  familia_color: 'azul',
  categoria: 'vestidos',
  categoria_nombre: 'Vestidos',
  talla: 'M',
  marca_visible: '',
  etiquetas: ['satín', 'fiesta'],
  avisos: ['Parece tener una mancha.'],
};

const trabajo = (pasos: Partial<Trabajo['pasos']> = {}): Trabajo => ({
  id: 't1',
  creado: '',
  fotos: [],
  pasos: { ficha: paso('listo'), prenda: paso('listo'), modelo: paso('listo'), ...pasos },
  ficha,
  modelo: { id: 'modelo-1', porIA: true, motivo: null },
  imagenes: { modelo: 'https://x/modelo.webp', prenda: 'https://x/gancho.webp' },
  terminado: true,
});

const tax = {
  departments: [{ slug: 'mujer', name: 'Mujer' }],
  categories: [{ slug: 'vestidos', department: 'mujer', name: 'Vestidos' }],
} as Taxonomy;

describe('importarTrabajo', () => {
  it('llena el editor según la ficha, con la foto de modelo primero', () => {
    const d = importarTrabajo(trabajo(), ficha, tax);
    expect(d).toMatchObject({
      name: 'Vestido slip satinado',
      description: 'Caída líquida.',
      detailsText: 'Tirantes ajustables\nLargo midi',
      material: '95% poliéster',
      care: 'Lavar en frío.',
      origin: 'Importado de EE. UU.',
      department: 'mujer',
      category: 'vestidos',
      tags: ['satín', 'fiesta'],
      size: 'M',
    });
    expect(d.color).toEqual({
      name: 'Azul marino',
      hex: '#1B2A49',
      family: 'azul',
      images: ['https://x/modelo.webp', 'https://x/gancho.webp'],
    });
  });

  it('nunca toca precio, costo, SKU, existencias ni estado', () => {
    const d = importarTrabajo(trabajo(), ficha, tax);
    for (const campo of ['price', 'cost', 'compareAtPrice', 'status', 'sku', 'stock'])
      expect(d).not.toHaveProperty(campo);
  });

  it('no importa una foto que no esté lista y lo avisa', () => {
    const d = importarTrabajo(trabajo({ modelo: paso('error') }), ficha, tax);
    expect(d.color.images).toEqual(['https://x/gancho.webp']);
    expect(d.avisos.join(' ')).toContain('La foto con modelo no está lista');
  });

  it('marca lo que estimó la IA, junto con los avisos de la ficha', () => {
    const { avisos } = importarTrabajo(trabajo(), ficha, tax);
    expect(avisos).toContain('Parece tener una mancha.');
    expect(avisos).toContain('Cuidados estimados por la IA: confírmalos con la etiqueta.');
    expect(avisos.join(' ')).not.toContain('Material estimado');
  });

  it('avisa si la categoría ya no existe', () => {
    const d = importarTrabajo(trabajo(), { ...ficha, categoria: 'borrada' }, tax);
    expect(d.category).toBe('');
    expect(d.avisos.join(' ')).toContain('ya no existe');
  });

  it('sin talla no agrega fila, y sin tono usa el de fábrica', () => {
    const d = importarTrabajo(trabajo(), { ...ficha, talla: '', color_hex: '', familia_color: '' }, tax);
    expect(d.size).toBeNull();
    expect(d.color.hex).toBe('#D9C6A6');
    expect(d.color.family).toBe('beige');
  });
});

describe('puedeImportar', () => {
  it('pide la ficha lista y al menos una foto', () => {
    expect(puedeImportar(trabajo())).toBe(true);
    expect(puedeImportar(trabajo({ modelo: paso('error') }))).toBe(true);
    expect(puedeImportar(trabajo({ modelo: paso('trabajando'), prenda: paso('error') }))).toBe(false);
    expect(puedeImportar({ ...trabajo(), ficha: null })).toBe(false);
    expect(puedeImportar(trabajo({ ficha: paso('trabajando') }))).toBe(false);
  });

  it('fotosSinImportar nombra cada foto', () => {
    expect(fotosSinImportar(trabajo())).toEqual([]);
    expect(fotosSinImportar(trabajo({ prenda: paso('trabajando') }))).toEqual([
      'La foto en gancho no está lista y no se importa.',
    ]);
  });
});

describe('utilidades', () => {
  it('urlJpg pide el JPG a Cloudinary', () => {
    expect(urlJpg('https://res.cloudinary.com/n/image/upload/v1/divani/estudio/a.webp')).toBe(
      'https://res.cloudinary.com/n/image/upload/f_jpg,q_92/v1/divani/estudio/a.jpg',
    );
  });

  it('nombreArchivo quita acentos', () => {
    expect(nombreArchivo('Blusa de algodón', 'prenda')).toBe('divani-blusa-de-algodon-gancho.jpg');
    expect(nombreArchivo(undefined, 'modelo')).toBe('divani-prenda-modelo.jpg');
  });

  it('tiempo', () => {
    expect(tiempo(42)).toBe('42 s');
    expect(tiempo(125)).toBe('2 min 05 s');
  });
});
