/**
 * Prompts de Estudio IA. PROMPT_PRENDA y PROMPT_MODELO son los mismos que ya funcionaban en
 * ChatGPT: no los cambies sin probar. Al final solo se les agrega lo que se sabe de cada prenda.
 * Las categorías y los departamentos del análisis se arman con los reales de la base de datos.
 */
import { COLOR_FAMILIES } from '@/lib/model';
import { MODELOS } from './modelos';
import type { Contexto, Ficha } from './tipos';

export type ContextoAnalisis = Pick<Contexto, 'departamentos' | 'categorias' | 'uso'>;

const FAMILIAS = COLOR_FAMILIES.map((f) => f.id);

// ---------------------------------------------------------------------------
// 1) Foto de la prenda en cercha (gancho)
// ---------------------------------------------------------------------------
export const PROMPT_PRENDA = `Edita la prenda de la foto adjunta y conviértela en una fotografía de producto profesional para el catálogo de una boutique de moda premium. Debe parecer una foto real tomada en estudio, no una imagen generada. Lo más importante: la prenda debe quedar IDÉNTICA a la real; solo cambia la presentación.

1. LA PRENDA NO SE MODIFICA
- Primero identifica qué prenda es (blusa, top, camisa, suéter, vestido, falda, pantalón, short, chamarra, conjunto, etc.).
- Debe quedar idéntica a la real: mismo color y tono exacto, tela, textura, corte, largo, ancho, cuello, mangas, tirantes y forma.
- Respeta exactamente todos los detalles: estampados, bordados, pedrería, botones, cierres, lazos, cordones, encajes, costuras, bolsillos, aberturas y adornos, con su misma forma, tamaño, cantidad y posición. No redibujes, simplifiques, agregues ni quites nada.
- No la alargues, no la ensanches y no cambies su corte ni su talla.

2. ETIQUETA DE LA PRENDA (regla obligatoria)
- Si la prenda tiene etiqueta (en el cuello, en la cintura, en una costura o colgante), debe aparecer tal cual está en la foto original: en su misma posición, con el mismo tamaño, forma, color, orientación, texto y tipografía. No la quites, no la muevas y no le cambies nada.
- Lo único permitido es mejorar su calidad: si las letras se ven borrosas, hazlas nítidas y legibles respetando exactamente las mismas letras, números y símbolos.
- No inventes ni adivines texto: si una letra o número no se distingue con claridad en la foto original, déjalo como está en vez de reconstruirlo.
- Si adjunto una foto de cerca de la etiqueta, úsala solo como referencia para copiar el texto exacto.
- La cercha y sus pinzas no deben tapar la etiqueta.

3. QUÉ SÍ CAMBIAR
- Plánchala: elimina todas las arrugas y dobleces para que se vea recién planchada, con la tela lisa y su textura real (que no parezca plástico ni render).
- Cuélgala de frente en una cercha según el tipo de prenda:
  - Blusas, tops, camisas, suéteres, vestidos, chamarras y prendas de arriba: cercha de madera clara natural con gancho de metal dorado mate, con la prenda colocada derecha y simétrica, con caída natural.
  - Pantalones, faldas y shorts: cercha de madera clara con pinzas doradas, sujetando la prenda de la cintura y colgando derecha, o pantalón doblado a la mitad sobre la barra de la cercha.
  - Conjuntos: la parte de arriba en la cercha y la de abajo colgada justo debajo en la misma cercha (o en una segunda cercha igual), de forma ordenada, para que se vean las dos piezas completas.
  - Bolsas o accesorios: colgados del gancho de una cercha de madera por su asa o correa.
- Quita por completo el fondo original, las superficies, los objetos, las manos, los precios, los stickers y cualquier texto o gráfico encima de la foto. Nada de eso es parte de la prenda.

4. ESTILO DE LA FOTO (igual en todo el catálogo)
- Fondo: pared lisa, sin textura, en tono lino/arena cálido (entre #F4EEE5 y #E9DFCF), un poco más claro detrás de la prenda y apenas más oscuro hacia las orillas.
- Luz suave y difusa de estudio, con una sombra tenue y realista de la prenda y la cercha sobre la pared para dar profundidad.
- Colores fieles a los reales, sin sobresaturar. Si la prenda es negra, que sea negro profundo, sin volverse azul ni gris.
- Debe parecer una foto real tomada con cámara profesional: nítida, con texturas reales de tela y madera, e imperfecciones naturales mínimas. Nada de ilustración, dibujo, render 3D ni efecto de IA.
- Formato vertical 4:5. La prenda va centrada, con la cercha visible arriba y aire arriba, abajo y a los lados, sin cortar ninguna parte.
- No agregues texto, precios, logos, marcas de agua, modelo ni maniquí. El único texto que debe verse es el de la etiqueta original de la prenda y el que forme parte de su diseño.`;

// ---------------------------------------------------------------------------
// 2) Foto de la modelo vistiendo la prenda
// ---------------------------------------------------------------------------
export const PROMPT_MODELO = `Tengo dos imágenes adjuntas:
- IMAGEN 1: la modelo oficial de mi catálogo.
- IMAGEN 2: la prenda que debe modelar (si adjunto más imágenes de la prenda, son de la misma pieza o del mismo conjunto, desde otros ángulos o en detalle).

Tu tarea: vestir a la modelo de la IMAGEN 1 con la prenda de la IMAGEN 2 y generar una foto profesional para el catálogo de una boutique de moda premium.

1. LA MODELO NO SE MODIFICA
- Debe ser exactamente la misma persona: mismo rostro, rasgos, tono de piel, color y tipo de cabello, peinado, maquillaje y complexión.
- No cambies su cuerpo: no la adelgaces, no la engordes, no le cambies la estatura, la musculatura ni las proporciones.
- Conserva sus mismos accesorios (aretes, collares, pulseras), salvo que tapen algún detalle de la prenda.
- Lo único que puede cambiar es su pose (ver punto 4).

2. LA PRENDA NO SE MODIFICA
- Debe quedar idéntica a la real: mismo color y tono exacto, tela, textura, corte, largo, ancho, cuello, mangas, tirantes y forma.
- Respeta exactamente todos los detalles: estampados, bordados, pedrería, botones, cierres, lazos, cordones, encajes, costuras, bolsillos, aberturas y adornos, con su misma forma, tamaño, cantidad y posición. No redibujes, simplifiques, agregues ni quites nada.
- Ajústala al cuerpo de la modelo de forma realista, con la caída y los pliegues naturales de esa tela. Debe verse planchada, sin arrugas de doblez, y sin estirar ni deformar estampados o detalles.
- SIN ETIQUETAS: puesta en la modelo, la prenda no debe mostrar ninguna etiqueta. Quita o deja oculta cualquier etiqueta de marca, de talla o de cuidado (incluida la del cuello, aunque en la foto original se vea por delante), así como etiquetas colgantes, etiquetas de precio, stickers o hilos de la tienda. La prenda debe verse como si la modelo la estuviera usando normalmente.
- Importante: esto aplica solo a etiquetas. Los logos, letras o textos que forman parte del diseño de la prenda (estampados, bordados o parches) se conservan exactamente igual.

3. ENCUADRE SEGÚN EL TIPO DE PRENDA
Primero identifica qué tipo de prenda es y usa el encuadre que le corresponde:
- Parte de arriba (blusa, top, crop top, body, camisa, playera, suéter, chaleco): encuadre desde la cabeza hasta la cadera o la parte alta del muslo. La prenda de arriba es la protagonista; de la parte de abajo solo debe verse un pedazo.
- Parte de abajo (pantalón, jeans, falda, short, leggings): cuerpo completo de la cabeza a los pies, con calzado visible.
- Conjunto (dos piezas de arriba y abajo), vestido, enterizo u overol: cuerpo completo de la cabeza a los pies, con calzado visible.
- Prenda exterior (chamarra, abrigo, blazer, cárdigan, kimono): encuadre desde la cabeza hasta la rodilla, para que se aprecie el largo completo de la prenda.
- Bolsa o accesorio: encuadre desde la cabeza hasta la mitad del muslo, con el accesorio bien visible y en primer plano.

4. POSE SEGÚN EL ESTILO DE LA PRENDA
Elige una pose natural de catálogo que vaya con el estilo de la prenda, distinta a una pose de frente rígida:
- Casual: relajada, con el peso en una pierna, las manos en los bolsillos o tocando el borde de la prenda y una sonrisa natural.
- Elegante o formal: postura erguida, ligeramente en tres cuartos, con los movimientos suaves y la expresión segura.
- Deportiva o fitness: postura dinámica y enérgica, con una mano en la cadera o un ligero movimiento.
- Romántica o femenina (lazos, encajes, flores, vuelo): pose suave, con la cabeza ligeramente inclinada y las manos delicadas.
- Fiesta o noche: pose con actitud, en tres cuartos, con una mano en la cintura y la mirada intensa.
- Prendas con vuelo (faldas, vestidos amplios): un ligero movimiento que muestre la caída de la tela.
Reglas de la pose: ni las manos, ni los brazos, ni el cabello deben tapar los detalles principales de la prenda (estampados, botones, lazos, escotes, cintura). Si el cabello está suelto, acomódalo detrás de los hombros.

5. PRENDAS COMPLEMENTARIAS
- Si la prenda es de arriba, complétala con una parte de abajo que combine (por ejemplo, jeans de tiro alto, pantalón de vestir o falda) en colores neutros (negro, blanco, beige, crema o mezclilla), sin logos ni estampados.
- Si es de abajo, complétala con una parte de arriba básica y lisa que combine, en colores neutros.
- En cuerpo completo usa calzado sencillo que combine (sandalias, tacones, tenis blancos o botines, según el estilo).
- Los complementos deben ser simples, sin etiquetas visibles, y no competir con la prenda principal. No agregues chamarras, bolsas ni capas encima que la tapen.

6. ESTILO DE LA FOTO (igual en todo el catálogo)
- Fondo de estudio liso en tono lino/arena cálido (entre #F4EEE5 y #E9DFCF), sin textura ni objetos.
- Luz suave y difusa de estudio, sombras suaves y colores fieles a los reales, sin sobresaturar.
- Fotografía hiperrealista y nítida, con piel de textura real. Nada de ilustración, render 3D ni efecto de IA.
- Formato vertical 4:5, con la modelo centrada y aire alrededor, sin cortar la prenda.
- No agregues texto, precios, logos ni marcas de agua. El único texto permitido es el que forma parte del diseño de la prenda.`;

const GRUPO_TEXTO: Record<string, string> = {
  arriba: 'parte de arriba',
  abajo: 'parte de abajo',
  conjunto: 'conjunto de dos piezas',
  vestido: 'vestido, enterizo u overol',
  exterior: 'prenda exterior',
  accesorio: 'bolsa o accesorio',
};

export function promptPrenda(numFotos: number): string {
  let extra = '';
  if (numFotos > 1) {
    extra = `\n\nNota: te adjunto ${numFotos} fotos de la misma prenda. La primera es la principal; las demás son otros ángulos o acercamientos (por ejemplo, de la etiqueta) y sirven solo como referencia.`;
  }
  return PROMPT_PRENDA + extra;
}

export function promptModelo(
  numFotosPrenda: number,
  ficha: Pick<Ficha, 'grupo' | 'tipo_prenda' | 'color' | 'estilo'> | null,
): string {
  const lineas: string[] = [];
  if (numFotosPrenda > 1) {
    lineas.push(
      `Te adjunto ${numFotosPrenda} fotos de la prenda (IMAGEN 2 en adelante). Si alguna es un acercamiento de la etiqueta, úsala solo para entender la prenda: la etiqueta no debe verse en la foto final.`,
    );
  }
  if (ficha) {
    const grupo = GRUPO_TEXTO[ficha.grupo] || ficha.grupo;
    lineas.push(
      `Datos de la prenda ya identificados: ${ficha.tipo_prenda} (${grupo}), color ${ficha.color}, estilo ${ficha.estilo}. Usa el encuadre y la pose que corresponden a eso.`,
    );
  }
  return lineas.length ? `${PROMPT_MODELO}\n\n${lineas.join('\n')}` : PROMPT_MODELO;
}

// ---------------------------------------------------------------------------
// 3) Análisis de la prenda + elección de modelo + ficha de producto
// ---------------------------------------------------------------------------
export function promptAnalisis(ctx: ContextoAnalisis): string {
  const listaModelos = MODELOS.map(
    (m) =>
      `- ${m.id}: ${m.descripcion} Le quedan bien: ${m.vaBienCon} (usada recientemente ${ctx.uso[m.id] || 0} veces)`,
  ).join('\n');

  const nombres = ctx.departamentos.map((d) => d.name.toLowerCase());
  const otros = ctx.departamentos.filter((d) => d.slug !== 'mujer').map((d) => d.name.toLowerCase());
  const nombresDepartamentos = enumerar(nombres);
  const otrosDepartamentos = enumerar(otros);
  const categoriasPorDepartamento = ctx.departamentos
    .map(
      (d) =>
        `${d.slug}: ${
          ctx.categorias
            .filter((c) => c.department === d.slug)
            .map((c) => c.slug)
            .join(', ') || 'ninguna'
        }`,
    )
    .join('; ');

  return `Eres la encargada de catálogo de Divani, una tienda en línea de Guatemala que vende ropa americana premium. La tienda vende sobre todo ropa casual de mujer: prendas comunes y de uso diario, pero bonitas.

Te adjunto una o varias fotos de UNA prenda (o de un conjunto), tomadas con celular. Puede haber un acercamiento de la etiqueta. Analízalas y devuelve la información pedida en el formato JSON indicado.

QUÉ HACER
1. Identifica la prenda: tipo, departamento (${nombresDepartamentos}), categoría de la tienda, grupo para el encuadre de la foto, estilo y color.
2. Elige la modelo que mejor le queda a la prenda (solo si es de mujer; si es de ${otrosDepartamentos}, usa "ninguna"):
${listaModelos}
   Elige por el estilo de la prenda. Si dos o más modelos le quedan igual de bien, prefiere la que se ha usado menos veces, para que el catálogo se vea variado.
3. Escribe la ficha del producto en español neutro, con el tono de la tienda (cálido, sencillo, sin exagerar):
   - nombre: 2 a 5 palabras, en minúsculas salvo la primera letra, sin marca ni color. Ejemplos del catálogo: "Vestido slip satinado", "Top de manga abullonada", "Jeans wide leg tiro alto", "Falda midi plisada".
   - descripcion: 1 o 2 frases (máximo 220 caracteres) que cuenten cómo es la prenda y para qué ocasión es ideal. Háblale a la clienta de tú si hace falta. Ejemplo: "Corte al bies con caída líquida y escote en V. El vestido que va de la cena al evento sin esfuerzo."
   - detalles: de 3 a 5 renglones cortos con características que SÍ se ven en las fotos (cuello, mangas, largo, cierres, bolsillos, cintura, forro, textura). Ejemplo: "Tirantes ajustables", "Largo midi", "Cintura elástica con cordón".
   - material: si la etiqueta se lee, cópialo traducido al español con sus porcentajes (por ejemplo "95% algodón, 5% elastano") y pon material_de_etiqueta en true. Si no se lee, escribe tu mejor estimación corta según lo que se ve (por ejemplo "Algodón elástico") y pon material_de_etiqueta en false.
   - cuidados: igual que el material. Si la etiqueta trae instrucciones, resúmelas en una frase ("Lavar a máquina en frío. No usar secadora.") y pon cuidados_de_etiqueta en true; si no, sugiere cuidados adecuados para esa tela y pon cuidados_de_etiqueta en false.
   - color: nombre corto y comercial del color, con mayúscula inicial ("Negro", "Marfil", "Azul marino", "Moka", "Rosa palo", "Floral marfil").
   - color_hex: el tono principal de la prenda en formato #RRGGBB, tal como se ve en las fotos (por ejemplo "#1B2A49" para azul marino). Si es estampada, el tono que más domina.
   - etiquetas: de 2 a 4 palabras cortas en minúsculas que ayuden a encontrar la prenda en la búsqueda de la tienda, como las del catálogo: tela, ocasión o largo (por ejemplo "satín", "fiesta", "midi", "básico"). Sin marca ni color.
   - talla: solo si se lee con claridad en la etiqueta (por ejemplo "M" o "28"); si no, cadena vacía.
   - marca_visible: la marca si se lee en la etiqueta; si no, cadena vacía. No pongas la marca en el nombre ni en la descripción.
4. avisos: lista corta (0 a 4) de cosas que la persona debe revisar antes de publicar, en frases cortas. Por ejemplo: "No se lee la composición en la etiqueta; confirma el material", "La etiqueta dice Nike; confirma que sea original antes de mencionarlo", "Parece tener una mancha en el bolsillo". Si todo está claro, lista vacía.

REGLAS
- No inventes datos que no se ven. Si algo no se distingue, dilo en avisos.
- No menciones precios, la IA ni las fotos en la ficha.
- Valores válidos de departamento: ${ctx.departamentos.map((d) => d.slug).join(', ')}.
- Valores válidos de categoria (usa una del departamento de la prenda; "otra" si ninguna le queda): ${categoriasPorDepartamento}; otra.
- Valores válidos de familia_color: ${FAMILIAS.join(', ')}.`;
}

/** «mujer, niñas, niños u hombre» */
function enumerar(lista: string[]): string {
  const ultimo = lista[lista.length - 1] || '';
  if (lista.length < 2) return ultimo;
  return `${lista.slice(0, -1).join(', ')} ${/^h?o/i.test(ultimo) ? 'u' : 'o'} ${ultimo}`;
}

export function esquemaAnalisis(ctx: ContextoAnalisis) {
  const ids = [...MODELOS.map((m) => m.id), 'ninguna'];
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'tipo_prenda',
      'departamento',
      'categoria',
      'grupo',
      'estilo',
      'modelo_id',
      'motivo_modelo',
      'nombre',
      'descripcion',
      'detalles',
      'material',
      'material_de_etiqueta',
      'cuidados',
      'cuidados_de_etiqueta',
      'color',
      'color_hex',
      'familia_color',
      'talla',
      'marca_visible',
      'etiquetas',
      'avisos',
    ],
    properties: {
      tipo_prenda: { type: 'string', description: 'Ej. short, blusa, vestido midi, conjunto de top y falda' },
      departamento: { type: 'string', enum: ctx.departamentos.map((d) => d.slug) },
      categoria: { type: 'string', enum: [...ctx.categorias.map((c) => c.slug), 'otra'] },
      grupo: { type: 'string', enum: ['arriba', 'abajo', 'conjunto', 'vestido', 'exterior', 'accesorio'] },
      estilo: { type: 'string', enum: ['casual', 'elegante', 'deportivo', 'romantico', 'fiesta'] },
      modelo_id: { type: 'string', enum: ids },
      motivo_modelo: { type: 'string', description: 'Una frase corta de por qué esa modelo' },
      nombre: { type: 'string' },
      descripcion: { type: 'string' },
      detalles: { type: 'array', items: { type: 'string' } },
      material: { type: 'string' },
      material_de_etiqueta: { type: 'boolean' },
      cuidados: { type: 'string' },
      cuidados_de_etiqueta: { type: 'boolean' },
      color: { type: 'string' },
      color_hex: { type: 'string', description: 'Tono principal de la prenda, #RRGGBB' },
      familia_color: { type: 'string', enum: FAMILIAS },
      talla: { type: 'string' },
      marca_visible: { type: 'string' },
      etiquetas: { type: 'array', items: { type: 'string' } },
      avisos: { type: 'array', items: { type: 'string' } },
    },
  };
}
