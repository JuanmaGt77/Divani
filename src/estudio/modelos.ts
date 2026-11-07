/**
 * Las modelos oficiales del catálogo. `descripcion` y `vaBienCon` son lo que lee la IA para
 * decidir cuál va mejor con cada prenda: ajústalas si quieres.
 *
 * La foto de referencia que recibe OpenAI vive en Cloudinary, en una dirección pública y fija
 * (la sube `npm run estudio:modelos`). La miniatura del selector vive en public/estudio/modelos.
 */
const REFERENCIAS = 'https://res.cloudinary.com/ompbjpp9/image/upload/divani/estudio/modelos';

export interface Modelo {
  id: string;
  nombre: string;
  descripcion: string;
  vaBienCon: string;
  /** Foto de referencia para la IA. */
  referencia: string;
  /** Miniatura para el selector del panel. */
  miniatura: string;
}

const modelo = (n: number, descripcion: string, vaBienCon: string): Modelo => ({
  id: `modelo-${n}`,
  nombre: `Modelo ${n}`,
  descripcion,
  vaBienCon,
  referencia: `${REFERENCIAS}/modelo-${n}.jpg`,
  miniatura: `/estudio/modelos/modelo-${n}.jpg`,
});

export const MODELOS: Modelo[] = [
  modelo(
    1,
    'Cabello oscuro y liso recogido en coleta baja, aretes de aro dorados, complexión delgada a media, expresión serena. Imagen pulida y sobria.',
    'prendas elegantes o formales, sastrería, blazers, camisas, blusas lisas, satinados sobrios, colores neutros y negro, looks de oficina.',
  ),
  modelo(
    2,
    'Cabello largo ondulado castaño con mechas caramelo, complexión curvy, sonrisa amplia, collar fino con perla. Cálida y cercana.',
    'ropa casual de diario, mezclilla, blusas y playeras, vestidos de día, suéteres y cárdigans, tonos tierra y cálidos.',
  ),
  modelo(
    3,
    'Cabello largo rizado oscuro, complexión curvy, sonrisa grande y alegre, aretes pequeños. Energía juvenil y divertida.',
    'shorts, ropa deportiva o cómoda, prendas juveniles, colores vivos, estampados divertidos, looks casuales de fin de semana.',
  ),
  modelo(
    4,
    'Cabello castaño claro a rubio recogido con mechones al frente, complexión delgada a media, collar con dije, look fresco y natural.',
    'tops y crop tops, faldas mini, tonos pastel y claros, prendas frescas de verano, básicos juveniles, ropa deportiva ligera.',
  ),
  modelo(
    5,
    'Cabello castaño en chongo bajo con mechones sueltos, aros dorados gruesos, pulsera dorada, complexión media con curvas, expresión coqueta.',
    'prendas románticas o femeninas (encaje, lazos, flores, vuelo), satinados, vestidos, ropa de fiesta o de noche.',
  ),
];

export const modeloPorId = (id: string | null | undefined): Modelo | undefined => MODELOS.find((m) => m.id === id);
