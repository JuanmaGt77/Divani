/**
 * Modo demostración (ESTUDIO_DEMO=1): simula a OpenAI para probar la pantalla sin gastar saldo.
 * La «foto en gancho» devuelve la foto subida y la «foto con modelo», la foto de referencia de la
 * modelo elegida. Lo demás (cola, Supabase y Cloudinary) funciona igual que de verdad.
 */
import { MODELOS } from './modelos';
import type { ImagenGenerada, Uso } from './openai';
import type { ContextoAnalisis } from './prompts';

const esperar = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function crearMock({ rapido = false }: { rapido?: boolean } = {}) {
  const t = (ms: number): number => (rapido ? Math.round(ms / 6) : ms);
  return {
    async analizar(ctx: ContextoAnalisis): Promise<{ ficha: Record<string, unknown>; uso: Uso | null }> {
      await esperar(t(2200));
      const menosUsada = [...MODELOS].sort((a, b) => (ctx.uso[a.id] || 0) - (ctx.uso[b.id] || 0))[0];
      return {
        uso: null,
        ficha: {
          tipo_prenda: 'short',
          departamento: 'mujer',
          categoria: 'jeans-y-pantalones',
          grupo: 'abajo',
          estilo: 'casual',
          modelo_id: menosUsada?.id,
          motivo_modelo: 'Prenda casual y juvenil; además es la modelo menos usada (modo demostración).',
          nombre: 'Short fluido de cintura elástica',
          descripcion:
            'Ligero y con caída suelta, con cintura elástica y cordón para ajustarlo a tu medida. Ideal para días de calor, salir a pasear o estar en casa con estilo.',
          detalles: [
            'Cintura elástica con cordón',
            'Pierna amplia con vuelo',
            'Largo corto',
            'Tela ligera de caída suave',
          ],
          material: 'Poliéster ligero',
          material_de_etiqueta: false,
          cuidados: 'Lavar a máquina en frío con colores similares. Secar a la sombra.',
          cuidados_de_etiqueta: false,
          color: 'Azul marino',
          color_hex: '#1B2A49',
          familia_color: 'azul',
          talla: 'M',
          marca_visible: '',
          etiquetas: ['short', 'verano', 'casual'],
          avisos: ['Modo demostración: estos textos son de ejemplo, no salen de tu foto.'],
        },
      };
    },
    async imagenPrenda(fotos: string[]): Promise<ImagenGenerada> {
      await esperar(t(4500));
      return { archivo: fotos[0] as string, uso: null };
    },
    async imagenModelo(referencia: string): Promise<ImagenGenerada> {
      await esperar(t(7000));
      return { archivo: referencia, uso: null };
    },
  };
}
