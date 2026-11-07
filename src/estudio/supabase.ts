/** Funciones de Supabase que usa el servidor de Estudio IA, con `fetch` y sin supabase-js. */
import type { BaseEstudio, ResultadoPaso } from './pasos';
import type { Contexto, NombrePaso } from './tipos';

export interface ConexionSupabase {
  url: string;
  key: string;
}

export class ErrorRpc extends Error {
  status: number;
  constructor(mensaje: string, status: number) {
    super(mensaje);
    this.name = 'ErrorRpc';
    this.status = status;
  }
}

/** Llama a una función. Con `jwt`, corre como ese usuario y aplican sus permisos. */
export async function rpcEstudio<T>(
  supabase: ConexionSupabase,
  nombre: string,
  args: object,
  jwt?: string,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(`${supabase.url}/rest/v1/rpc/${nombre}`, {
      method: 'POST',
      headers: {
        apikey: supabase.key,
        Authorization: `Bearer ${jwt || supabase.key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(args),
      signal: ctrl.signal,
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const mensaje = (data as { message?: string } | null)?.message || `Error ${res.status} de la base de datos.`;
      throw new ErrorRpc(mensaje, res.status);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface FirmaCloudinary {
  signature: string;
  apiKey: string;
  cloudName: string;
  params: Record<string, string>;
}

/** Las funciones de la cola: entran con su llave propia, sin usuario. */
export function crearBase(
  supabase: ConexionSupabase,
  token: string,
): BaseEstudio & {
  firmar(params: Record<string, string>): Promise<FirmaCloudinary>;
} {
  const rpc = <T>(nombre: string, args: object): Promise<T> =>
    rpcEstudio<T>(supabase, nombre, { p_token: token, ...args });
  return {
    contexto: (id) => rpc<Contexto | null>('estudio_worker_contexto', { p_id: id }),
    tomar: (id, paso: NombrePaso, intento) =>
      rpc<boolean>('estudio_worker_tomar', { p_id: id, p_paso: paso, p_intento: intento }),
    elegir: (id, modelo, motivo) =>
      rpc<void>('estudio_worker_elegir', { p_id: id, p_modelo: modelo, p_motivo: motivo }),
    terminar: (id, paso: NombrePaso, intento, datos: ResultadoPaso) =>
      rpc<boolean>('estudio_worker_terminar', { p_id: id, p_paso: paso, p_intento: intento, p_datos: datos }),
    firmar: (params) => rpc<FirmaCloudinary>('estudio_worker_firma', { p_params: params }),
  };
}
