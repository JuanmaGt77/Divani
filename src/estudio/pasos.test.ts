import { describe, expect, it, vi } from 'vitest';
import { leerConfig } from './config';
import { ErrorIA } from './openai';
import { normalizarFicha, procesarMensaje, type ResultadoPaso, type Servicios } from './pasos';
import type { Contexto, Ficha, NombrePaso } from './tipos';

const taxonomia = {
  departamentos: [
    { slug: 'mujer', name: 'Mujer' },
    { slug: 'ninas', name: 'Niñas' },
  ],
  categorias: [
    { slug: 'vestidos', name: 'Vestidos', department: 'mujer' },
    { slug: 'vestidos-ninas', name: 'Vestidos', department: 'ninas' },
  ],
};

const fichaIA = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  departamento: 'mujer',
  categoria: 'vestidos',
  nombre: '  Vestido   midi ',
  detalles: ['Largo midi', '', 'Tirantes'],
  color: 'Negro',
  color_hex: '#1b1a19',
  familia_color: 'negro',
  modelo_id: 'modelo-3',
  motivo_modelo: 'Va con el estilo',
  etiquetas: ['Fiesta', 'midi', 'satín', 'noche', 'extra'],
  avisos: [],
  ...extra,
});

/** Una base falsa en memoria que se comporta como las funciones estudio_worker_*. */
function crear(opciones: { analizar?: Servicios['analizar']; modeloId?: string | null; modeloPorIA?: boolean } = {}) {
  const pasos = {
    ficha: { estado: 'en_cola', intento: 1, version: 0 },
    prenda: { estado: 'en_cola', intento: 1, version: 0 },
    modelo: { estado: 'en_cola', intento: 1, version: 0 },
  } as Contexto['pasos'];
  const estado: Contexto = {
    id: '11111111-aaaa',
    fotos: ['https://x/a.jpg'],
    ficha: null,
    modeloId: opciones.modeloId ?? null,
    modeloPorIA: opciones.modeloPorIA ?? true,
    pasos,
    uso: { 'modelo-1': 5, 'modelo-2': 5, 'modelo-3': 5, 'modelo-5': 5 },
    ...taxonomia,
  };
  const resultados: Partial<Record<NombrePaso, ResultadoPaso>> = {};
  const imagenModelo = vi.fn(async () => ({ archivo: 'data:modelo', uso: null }));
  const imagenPrenda = vi.fn(async () => ({ archivo: 'data:prenda', uso: null }));
  const servicios: Servicios = {
    cfg: leerConfig({}),
    ahora: () => Date.now(),
    analizar: opciones.analizar ?? (async () => ({ ficha: fichaIA(), uso: null })),
    imagenPrenda,
    imagenModelo,
    subir: async (archivo) => `https://res.cloudinary.com/${archivo}`,
    db: {
      contexto: async () => structuredClone(estado),
      tomar: async (_id, paso, intento) => {
        if (pasos[paso].estado !== 'en_cola' || pasos[paso].intento !== intento) return false;
        pasos[paso].estado = 'trabajando';
        return true;
      },
      elegir: async (_id, modelo) => {
        if (estado.modeloPorIA && !estado.modeloId) estado.modeloId = modelo;
      },
      terminar: async (_id, paso, _intento, datos) => {
        pasos[paso].estado = datos.estado;
        resultados[paso] = datos;
        if (datos.ficha) estado.ficha = datos.ficha;
        if (datos.modeloId && !estado.modeloId) estado.modeloId = datos.modeloId;
        return true;
      },
    },
  };
  return { servicios, estado, pasos, resultados, imagenModelo, imagenPrenda };
}

const mensaje = (paso: NombrePaso, encadenar = false) => ({ trabajoId: '11111111-aaaa', paso, intento: 1, encadenar });

describe('normalizarFicha', () => {
  it('limpia los textos y usa los registros reales', () => {
    const f = normalizarFicha(fichaIA(), taxonomia, { origen: 'Importado de EE. UU.' });
    expect(f).toMatchObject({
      nombre: 'Vestido midi',
      departamento: 'mujer',
      departamento_nombre: 'Mujer',
      categoria: 'vestidos',
      categoria_nombre: 'Vestidos',
      color_hex: '#1B1A19',
      origen: 'Importado de EE. UU.',
    });
    expect(f.detalles).toEqual(['Largo midi', 'Tirantes']);
    expect(f.etiquetas).toEqual(['fiesta', 'midi', 'satín', 'noche']);
  });

  it('no acepta una categoría de otro departamento', () => {
    const f = normalizarFicha(fichaIA({ categoria: 'vestidos-ninas' }), taxonomia, { origen: '' });
    expect(f.categoria).toBe('');
    expect(f.avisos.join()).toContain('elígela a mano');
  });

  it('deja vacío lo que no es válido', () => {
    const f = normalizarFicha(
      fichaIA({ categoria: 'otra', color_hex: 'azul', familia_color: 'turquesa', departamento: 'mascotas' }),
      taxonomia,
      { origen: '' },
    );
    expect(f).toMatchObject({ color_hex: '', familia_color: '', categoria: '', departamento: '' });
    expect(f.categoria_nombre).toContain('Otra');
  });
});

describe('procesarMensaje', () => {
  it('la ficha sigue con la foto de la modelo que eligió la IA', async () => {
    const { servicios, estado, resultados, imagenModelo } = crear();
    await procesarMensaje(mensaje('ficha', true), servicios);
    expect(resultados.ficha?.estado).toBe('listo');
    expect(estado.modeloId).toBe('modelo-3');
    expect(imagenModelo).toHaveBeenCalledOnce();
    expect(resultados.modelo).toMatchObject({ estado: 'listo', url: 'https://res.cloudinary.com/data:modelo' });
  });

  it('omite la foto con modelo si la prenda no es de mujer', async () => {
    const { servicios, resultados, imagenModelo } = crear({
      analizar: async () => ({ ficha: fichaIA({ departamento: 'ninas', categoria: 'vestidos-ninas' }), uso: null }),
    });
    await procesarMensaje(mensaje('ficha', true), servicios);
    expect(imagenModelo).not.toHaveBeenCalled();
    expect(resultados.modelo?.estado).toBe('omitido');
    expect(resultados.modelo?.nota).toContain('parece de niñas');
  });

  it('si falla el análisis usa la modelo menos usada y guarda el error en español', async () => {
    const { servicios, estado, resultados } = crear({
      analizar: async () => {
        throw new ErrorIA('OpenAI está saturado en este momento. Intenta de nuevo en un minuto.');
      },
    });
    await procesarMensaje(mensaje('ficha', true), servicios);
    expect(resultados.ficha).toMatchObject({ estado: 'error', error: expect.stringContaining('saturado') });
    expect(estado.modeloId).toBe('modelo-4');
    expect(resultados.modelo?.estado).toBe('listo');
  });

  it('un error inesperado no muestra detalles técnicos', async () => {
    const { servicios, resultados } = crear();
    servicios.imagenPrenda = async () => {
      throw new Error('TypeError interno');
    };
    await procesarMensaje(mensaje('prenda'), servicios);
    expect(resultados.prenda?.error).toBe('Ocurrió un error inesperado. Intenta de nuevo.');
  });

  it('un mensaje repetido no vuelve a generar: la foto no se cobra doble', async () => {
    const { servicios, imagenPrenda } = crear();
    await procesarMensaje(mensaje('prenda'), servicios);
    await procesarMensaje(mensaje('prenda'), servicios);
    expect(imagenPrenda).toHaveBeenCalledOnce();
  });

  it('reescribir la ficha no vuelve a generar la foto con modelo', async () => {
    const { servicios, imagenModelo } = crear();
    await procesarMensaje(mensaje('ficha', false), servicios);
    expect(imagenModelo).not.toHaveBeenCalled();
  });

  it('respeta la modelo elegida a mano aunque la prenda no sea de mujer', async () => {
    const { servicios, estado, imagenModelo } = crear({ modeloId: 'modelo-2', modeloPorIA: false });
    estado.ficha = { departamento: 'ninas' } as Ficha;
    await procesarMensaje(mensaje('modelo'), servicios);
    expect(imagenModelo).toHaveBeenCalledWith(
      expect.stringContaining('modelo-2.jpg'),
      ['https://x/a.jpg'],
      expect.anything(),
      expect.any(Number),
    );
  });
});
