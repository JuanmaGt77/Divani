/** Lo que el Worker recibe de Cloudflare: variables, secretos y la cola de Estudio IA. */
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown> & {
    ESTUDIO_COLA: {
      send(mensaje: unknown): Promise<void>;
      sendBatch(mensajes: { body: unknown }[]): Promise<void>;
    };
  };
}
