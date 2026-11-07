/**
 * Tipos de Estudio IA. Los comparten el panel (navegador) y la cola (Worker), así que aquí no
 * debe haber nada que dependa de uno de los dos.
 */
export type NombrePaso = 'ficha' | 'prenda' | 'modelo';
export type EstadoPaso = 'en_cola' | 'trabajando' | 'listo' | 'error' | 'omitido';

export interface PasoPublico {
  estado: EstadoPaso;
  error: string | null;
  nota: string | null;
  /** Cuántas veces ha terminado bien. */
  version: number;
  /** Número de intento: evita que un mensaje viejo pise uno más nuevo. */
  intento: number;
  segundos: number;
}

/** La ficha ya revisada: departamento y categoría vienen como slugs reales de la base. */
export interface Ficha {
  tipo_prenda: string;
  departamento: string;
  departamento_nombre: string;
  grupo: string;
  estilo: string;
  nombre: string;
  descripcion: string;
  detalles: string[];
  material: string;
  material_de_etiqueta: boolean;
  cuidados: string;
  cuidados_de_etiqueta: boolean;
  origen: string;
  color: string;
  /** Tono principal, #RRGGBB. */
  color_hex: string;
  /** Familia del filtro de la tienda (COLOR_FAMILIES). */
  familia_color: string;
  /** Slug de la categoría; vacío si hay que elegirla a mano. */
  categoria: string;
  categoria_nombre: string;
  talla: string;
  marca_visible: string;
  etiquetas: string[];
  avisos: string[];
}

export interface Trabajo {
  id: string;
  creado: string;
  fotos: string[];
  pasos: Record<NombrePaso, PasoPublico>;
  ficha: Ficha | null;
  modelo: { id: string; porIA: boolean; motivo: string | null } | null;
  imagenes: { prenda: string | null; modelo: string | null };
  terminado: boolean;
}

/** Mensaje de la cola: un paso de un trabajo. */
export interface MensajeCola {
  trabajoId: string;
  paso: NombrePaso;
  intento: number;
  /** Solo en la ficha inicial: al terminar sigue con la foto con modelo. */
  encadenar?: boolean;
}

/** Lo que el panel necesita saber del servidor. */
export interface EstudioPublico {
  demo: boolean;
  /** El servidor tiene lo necesario para generar. */
  listo: boolean;
  maxFotos: number;
}

export interface CategoriaContexto {
  slug: string;
  name: string;
  department: string;
}

export interface DepartamentoContexto {
  slug: string;
  name: string;
}

/** Lo que la cola lee de la base antes de trabajar. */
export interface Contexto {
  id: string;
  fotos: string[];
  ficha: Ficha | null;
  modeloId: string | null;
  modeloPorIA: boolean;
  pasos: Record<NombrePaso, { estado: EstadoPaso; intento: number; version: number }>;
  departamentos: DepartamentoContexto[];
  categorias: CategoriaContexto[];
  uso: Record<string, number>;
}
