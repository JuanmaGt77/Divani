/**
 * Sube a Cloudinary lo que genera la cola. El navegador convierte las fotos del editor a WebP; aquí
 * no hay navegador, así que se usa el otro camino del mismo flujo: Cloudinary convierte al recibir
 * (`format=webp`) y limita el lado mayor a 2000 px, igual que con las fotos de Safari o HEIC.
 */
import type { FirmaCloudinary } from './supabase';

const CARPETA = 'divani/estudio/generadas';
const LADO_MAXIMO = 2000;

export async function subirGenerada(
  archivo: string,
  firmar: (params: Record<string, string>) => Promise<FirmaCloudinary>,
): Promise<string> {
  const firma = await firmar({
    folder: CARPETA,
    format: 'webp',
    transformation: `c_limit,w_${LADO_MAXIMO},h_${LADO_MAXIMO}`,
  });
  const fd = new FormData();
  fd.append('file', archivo);
  fd.append('api_key', firma.apiKey);
  fd.append('signature', firma.signature);
  for (const [k, v] of Object.entries(firma.params || {})) fd.append(k, String(v));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(firma.cloudName)}/image/upload`, {
    method: 'POST',
    body: fd,
  });
  const data = (await res.json().catch(() => null)) as { secure_url?: string; error?: { message?: string } } | null;
  if (!res.ok || !data?.secure_url) {
    throw new Error(
      data?.error?.message ? `Cloudinary: ${data.error.message}` : 'No se pudo subir la imagen a Cloudinary.',
    );
  }
  return data.secure_url;
}
