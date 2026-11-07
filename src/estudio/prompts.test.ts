import { describe, expect, it } from 'vitest';
import { COLOR_FAMILIES } from '@/lib/model';
import { PROMPT_MODELO, PROMPT_PRENDA, esquemaAnalisis, promptAnalisis, promptModelo, promptPrenda } from './prompts';

const ctx = {
  departamentos: [
    { slug: 'mujer', name: 'Mujer' },
    { slug: 'ninas', name: 'Niñas' },
    { slug: 'ninos', name: 'Niños' },
    { slug: 'hombre', name: 'Hombre' },
  ],
  categorias: [
    { slug: 'vestidos', name: 'Vestidos', department: 'mujer' },
    { slug: 'nueva-categoria', name: 'Nueva', department: 'ninas' },
  ],
  uso: { 'modelo-2': 7 },
};

describe('promptAnalisis', () => {
  const texto = promptAnalisis(ctx);

  it('presenta la ropa como lo pide la marca', () => {
    expect(texto).toContain('ropa americana premium');
    expect(texto).not.toContain('etiqueta original');
  });

  it('usa los departamentos y las categorías de la base', () => {
    expect(texto).toContain('departamento (mujer, niñas, niños u hombre)');
    expect(texto).toContain('si es de niñas, niños u hombre, usa "ninguna"');
    expect(texto).toContain('mujer: vestidos; ninas: nueva-categoria; ninos: ninguna; hombre: ninguna; otra.');
  });

  it('incluye cuánto se ha usado cada modelo', () => {
    expect(texto).toContain('(usada recientemente 7 veces)');
    expect(texto).toContain('(usada recientemente 0 veces)');
  });
});

describe('esquemaAnalisis', () => {
  const esquema = esquemaAnalisis(ctx);

  it('arma los enum con los registros reales', () => {
    expect(esquema.properties.departamento.enum).toEqual(['mujer', 'ninas', 'ninos', 'hombre']);
    expect(esquema.properties.categoria.enum).toEqual(['vestidos', 'nueva-categoria', 'otra']);
    expect(esquema.properties.familia_color.enum).toEqual(COLOR_FAMILIES.map((f) => f.id));
  });

  it('pide el tono y las etiquetas, y todo campo es obligatorio como exige strict', () => {
    expect(esquema.required).toEqual(expect.arrayContaining(['color_hex', 'etiquetas']));
    expect([...esquema.required].sort()).toEqual(Object.keys(esquema.properties).sort());
  });
});

describe('prompts de imagen', () => {
  it('agregan al final lo que se sabe de la prenda', () => {
    expect(promptPrenda(1)).toBe(PROMPT_PRENDA);
    expect(promptPrenda(2)).toContain('te adjunto 2 fotos');
    expect(promptModelo(1, null)).toBe(PROMPT_MODELO);
    const conFicha = promptModelo(2, { tipo_prenda: 'short', grupo: 'abajo', color: 'Negro', estilo: 'casual' });
    expect(conFicha.startsWith(PROMPT_MODELO)).toBe(true);
    expect(conFicha).toContain('short (parte de abajo), color Negro, estilo casual');
  });
});
