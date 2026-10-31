/**
 * Fotos y videos: compresión en el navegador antes de subir y subida firmada a Cloudinary
 * (con progreso). La firma la hace Supabase: el API Secret nunca llega a la página.
 * Las fotos se guardan en WebP y con el lado mayor de hasta MAX_SIDE px: las convierte el
 * navegador y, si no puede (Safari, fotos HEIC), Cloudinary al recibirlas.
 */
import { number } from '@/lib/format';

export type MediaKind = 'image' | 'video';

/** Lado mayor máximo de las fotos que se guardan. */
export const MAX_SIDE = 2000;

/** Lo que devuelve una subida: dirección y pesos antes y después. */
export interface UploadedMedia {
  url: string;
  /** Bytes del archivo que se eligió. */
  before: number;
  /** Bytes que guardó Cloudinary. */
  after: number;
  /** Formato guardado (webp, jpg, mp4…). */
  format: string;
}

/** 2 870 000 → «2,7 MB»; 112 000 → «109 KB». */
export const fileSize = (bytes: number): string =>
  bytes >= 1048576 ? `${number(bytes / 1048576, 1)} MB` : `${number(Math.max(1, bytes / 1024))} KB`;

/** «2,7 MB → 109 KB en WebP (96 % menos)» para los avisos al subir fotos. */
export function savingsText({ before, after, format }: Pick<UploadedMedia, 'before' | 'after' | 'format'>): string {
  const name = format === 'webp' ? 'WebP' : format.toUpperCase();
  const fmt = name ? ` en ${name}` : '';
  if (!before || !after || after >= before) return `Guardada${fmt} (${fileSize(after || before)})`;
  return `${fileSize(before)} → ${fileSize(after)}${fmt} (${Math.round((1 - after / before) * 100)} % menos)`;
}

export interface SignedUpload {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  params: Record<string, string>;
}

let webpOk: boolean | null = null;
function canEncodeWebp(): boolean {
  if (webpOk !== null) return webpOk;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    webpOk = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpOk = false;
  }
  return webpOk;
}

/** Reduce una foto (lado mayor ≤ maxSide) y la convierte a WebP (o JPEG si el navegador no puede). */
export async function compressImage(file: File, { maxSide = MAX_SIDE, quality = 0.86 } = {}): Promise<File> {
  if (!file?.type?.startsWith('image/') || /svg|gif/.test(file.type)) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 900e3 && /webp|jpeg/.test(file.type)) return file;
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  const webp = canEncodeWebp();
  if (!webp) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const type = webp ? 'image/webp' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + (webp ? '.webp' : '.jpg'), { type });
}

export const isVideo = (file: File | null | undefined): boolean => !!file?.type?.startsWith('video/');

export function validateFile(
  file: File | null | undefined,
  { kind = 'image', maxMb }: { kind?: MediaKind; maxMb?: number } = {},
): asserts file is File {
  if (!file) throw new Error('Elige un archivo.');
  const okType = kind === 'video' ? isVideo(file) : file.type.startsWith('image/');
  if (!okType)
    throw new Error(kind === 'video' ? 'Elige un video (MP4 o WebM).' : 'Elige una imagen (JPG, PNG o WebP).');
  const limit = maxMb ?? (kind === 'video' ? 100 : 25);
  if (file.size > limit * 1024 * 1024) throw new Error(`El archivo pesa más de ${limit} MB.`);
}

/** Subida firmada a Cloudinary. `signed` viene de la función cloudinary_signature de Supabase. */
export function cloudinaryUpload(
  file: Blob,
  signed: SignedUpload,
  { kind = 'image', onProgress }: { kind?: MediaKind; onProgress?: (p: number) => void } = {},
): Promise<{ secure_url: string; bytes: number; format: string }> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('api_key', signed.apiKey);
    fd.append('signature', signed.signature);
    for (const [k, v] of Object.entries(signed.params || {})) fd.append(k, String(v));
    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/${kind === 'video' ? 'video' : 'image'}/upload`,
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.min(0.98, e.loaded / e.total));
    };
    xhr.onload = () => {
      let data: { secure_url?: string; bytes?: number; format?: string; error?: { message?: string } } | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* respuesta no JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data?.secure_url) {
        onProgress?.(1);
        resolve({ secure_url: data.secure_url, bytes: Number(data.bytes) || 0, format: String(data.format || '') });
      } else {
        reject(
          new Error(
            data?.error?.message ? `Cloudinary: ${data.error.message}` : 'No se pudo subir el archivo a Cloudinary.',
          ),
        );
      }
    };
    xhr.onerror = () => reject(new Error('Sin conexión con Cloudinary. Revisa tu internet.'));
    xhr.send(fd);
  });
}
