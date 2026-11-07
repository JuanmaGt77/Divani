/**
 * La llamada real a OpenAI contra un servidor falso: mismo código que en producción, cambiando
 * solo la red y el reloj (no gasta saldo).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leerConfig } from './config';
import { analizarPrenda, editarImagen, olvidarRechazados, type Herramientas } from './openai';

const cfg = leerConfig({ OPENAI_API_KEY: 'sk-prueba' });
const ctx = {
  departamentos: [{ slug: 'mujer', name: 'Mujer' }],
  categorias: [{ slug: 'vestidos', name: 'Vestidos', department: 'mujer' }],
  uso: {},
};

const respuesta = (status: number, cuerpo: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(cuerpo), { status, headers });
const imagen = () => respuesta(200, { data: [{ b64_json: 'QUJD' }], usage: { output_tokens: 10 } });

/** Un servidor falso: responde en orden y anota lo que le mandaron. */
function servidor(respuestas: (() => Response)[]) {
  const pedidos: Record<string, unknown>[] = [];
  const esperas: number[] = [];
  const h: Herramientas = {
    fetch: vi.fn(async (_url: string, init: RequestInit) => {
      pedidos.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      const siguiente = respuestas.shift();
      if (!siguiente) throw new Error('No se esperaban más peticiones');
      return siguiente();
    }),
    esperar: async (ms) => {
      esperas.push(ms);
    },
    ahora: () => Date.now(),
  };
  return { h, pedidos, esperas };
}

const editar = (h: Herramientas) =>
  editarImagen({ imagenes: ['https://res.cloudinary.com/x/a.jpg'], prompt: 'Plancha', complexity: 'medium' }, cfg, h);

beforeEach(() => olvidarRechazados());

describe('editarImagen', () => {
  it('manda las fotos por dirección y devuelve un data URL', async () => {
    const { h, pedidos } = servidor([imagen]);
    const res = await editar(h);
    expect(res.archivo).toBe('data:image/jpeg;base64,QUJD');
    expect(pedidos[0]).toMatchObject({
      model: 'gpt-image-2.6-sunburst',
      images: [{ image_url: 'https://res.cloudinary.com/x/a.jpg' }],
      size: '1152x1440',
      quality: 'high',
      moderation: 'low',
      complexity: 'medium',
    });
  });

  it('reintenta en 503 respetando Retry-After', async () => {
    const { h, pedidos, esperas } = servidor([
      () => respuesta(503, { error: { message: 'saturado' } }, { 'retry-after': '7' }),
      imagen,
    ]);
    await expect(editar(h)).resolves.toMatchObject({ archivo: 'data:image/jpeg;base64,QUJD' });
    expect(pedidos).toHaveLength(2);
    expect(esperas).toEqual([7000]);
  });

  it('se rinde tras 3 intentos con el mensaje en español', async () => {
    const saturado = () => respuesta(503, { error: { message: 'saturado' } });
    const { h, pedidos } = servidor([saturado, saturado, saturado]);
    await expect(editar(h)).rejects.toThrow('OpenAI está saturado en este momento');
    expect(pedidos).toHaveLength(3);
  });

  it('quita el parámetro que el modelo no acepta y lo recuerda', async () => {
    const { h, pedidos } = servidor([
      () => respuesta(400, { error: { param: 'complexity', message: 'Unknown parameter: complexity' } }),
      imagen,
      imagen,
    ]);
    await editar(h);
    expect(pedidos[0]).toHaveProperty('complexity');
    expect(pedidos[1]).not.toHaveProperty('complexity');
    await editar(h);
    expect(pedidos[2]).not.toHaveProperty('complexity');
  });

  it('muestra moderation_blocked en español y no reintenta', async () => {
    const { h, pedidos } = servidor([
      () => respuesta(400, { error: { code: 'moderation_blocked', message: 'blocked by moderation' } }),
    ]);
    await expect(editar(h)).rejects.toThrow('El filtro de seguridad de OpenAI bloqueó esta imagen');
    expect(pedidos).toHaveLength(1);
  });

  it.each([
    [401, { error: { message: 'bad key' } }, 'La clave de OpenAI no es válida'],
    [403, { error: { message: 'Your organization must be verified' } }, 'debe estar verificada'],
    [429, { error: { code: 'insufficient_quota', message: 'quota' } }, 'se quedó sin saldo'],
  ])('traduce el error %i', async (status, cuerpo, mensaje) => {
    const { h } = servidor([() => respuesta(status, cuerpo)]);
    await expect(editar(h)).rejects.toThrow(mensaje);
  });

  it('no reintenta si se agotó el tiempo: la imagen pudo haberse cobrado', async () => {
    const { h, pedidos } = servidor([
      () => {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      },
    ]);
    await expect(editar(h)).rejects.toThrow('OpenAI tardó demasiado');
    expect(pedidos).toHaveLength(1);
  });

  it('no llama si el paso ya no tiene tiempo', async () => {
    const { h, pedidos } = servidor([imagen]);
    await expect(
      editarImagen({ imagenes: ['https://x/a.jpg'], prompt: 'p', limite: Date.now() - 1000 }, cfg, h),
    ).rejects.toThrow('OpenAI tardó demasiado');
    expect(pedidos).toHaveLength(0);
  });
});

describe('analizarPrenda', () => {
  it('pide la ficha con los registros reales y las fotos por dirección', async () => {
    const { h, pedidos } = servidor([() => respuesta(200, { output_text: '{"nombre":"Vestido"}' })]);
    const res = await analizarPrenda(['https://x/a.jpg'], ctx, cfg, { h });
    expect(res.ficha.nombre).toBe('Vestido');
    const pedido = pedidos[0] as {
      input: { content: { type: string; image_url?: string }[] }[];
      text: { format: { schema: { properties: Record<string, { enum?: string[] }> } } };
    };
    expect(pedido.input[0]?.content[1]).toEqual({ type: 'input_image', image_url: 'https://x/a.jpg' });
    expect(pedido.text.format.schema.properties.categoria?.enum).toEqual(['vestidos', 'otra']);
  });

  it('avisa si la IA se niega', async () => {
    const { h } = servidor([
      () => respuesta(200, { output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no puedo' }] }] }),
    ]);
    await expect(analizarPrenda(['https://x/a.jpg'], ctx, cfg, { h })).rejects.toThrow(
      'La IA no quiso analizar la prenda',
    );
  });

  it('avisa si la ficha llega en un formato inesperado', async () => {
    const { h } = servidor([() => respuesta(200, { output_text: 'esto no es JSON' })]);
    await expect(analizarPrenda(['https://x/a.jpg'], ctx, cfg, { h })).rejects.toThrow('formato inesperado');
  });
});
