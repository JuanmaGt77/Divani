/**
 * Fotos y videos: compresión en el navegador antes de subir, subida firmada a Cloudinary
 * (con progreso) y, en modo demostración, conversión a data URL para guardarla localmente.
 */

let webpOk = null;
function canEncodeWebp() {
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
export async function compressImage(file, { maxSide = 2000, quality = 0.86 } = {}) {
  if (!file?.type?.startsWith('image/') || /svg|gif/.test(file.type)) return file;
  let bitmap = null;
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
  const webp = canEncodeWebp();
  if (!webp) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const type = webp ? 'image/webp' : 'image/jpeg';
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + (webp ? '.webp' : '.jpg'), { type });
}

export function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    r.readAsDataURL(blob);
  });
}

export const isVideo = (file) => file?.type?.startsWith('video/');

export function validateFile(file, { kind = 'image', maxMb } = {}) {
  if (!file) throw new Error('Elige un archivo.');
  const okType = kind === 'video' ? isVideo(file) : file.type.startsWith('image/');
  if (!okType) throw new Error(kind === 'video' ? 'Elige un video (MP4 o WebM).' : 'Elige una imagen (JPG, PNG o WebP).');
  const limit = maxMb ?? (kind === 'video' ? 100 : 25);
  if (file.size > limit * 1024 * 1024) throw new Error(`El archivo pesa más de ${limit} MB.`);
}

/** Modo demostración: la imagen se guarda dentro de la base local como data URL (reducida). */
export async function toLocalDataUrl(file, { kind = 'image', onProgress } = {}) {
  validateFile(file, { kind, maxMb: kind === 'video' ? 30 : 25 });
  onProgress?.(0.2);
  const out = kind === 'video' ? file : await compressImage(file, { maxSide: 1500, quality: 0.82 });
  onProgress?.(0.7);
  const url = await readAsDataUrl(out);
  onProgress?.(1);
  return url;
}

/** Subida firmada a Cloudinary. `signed` viene de la función cloudinary_signature de Supabase. */
export function cloudinaryUpload(file, signed, { kind = 'image', onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('api_key', signed.apiKey);
    fd.append('signature', signed.signature);
    for (const [k, v] of Object.entries(signed.params || {})) fd.append(k, v);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/${kind === 'video' ? 'video' : 'image'}/upload`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.min(0.98, e.loaded / e.total)); };
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* respuesta no JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && data?.secure_url) {
        onProgress?.(1);
        resolve(data);
      } else {
        reject(new Error(data?.error?.message ? `Cloudinary: ${data.error.message}` : 'No se pudo subir el archivo a Cloudinary.'));
      }
    };
    xhr.onerror = () => reject(new Error('Sin conexión con Cloudinary. Revisa tu internet.'));
    xhr.send(fd);
  });
}
