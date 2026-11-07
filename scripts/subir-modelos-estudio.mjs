/**
 * Sube a Cloudinary las fotos de referencia de las modelos de Estudio IA: OpenAI las lee desde
 * una dirección pública y fija. Solo hay que correrlo una vez, o al cambiar o agregar una modelo.
 *
 *   npm run estudio:modelos -- <carpeta con modelo-1.jpg, modelo-2.jpg…>
 *
 * Firma igual que el panel (cloudinary_signature), así que entra con un administrador. Lee de
 * .env.local: PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, ADMIN_EMAIL y ADMIN_PASSWORD.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

function leerEnv() {
  const env = { ...process.env };
  try {
    for (const linea of readFileSync(resolve('.env.local'), 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(linea);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* sin .env.local */
  }
  return env;
}

function salir(mensaje) {
  console.error(mensaje);
  process.exit(1);
}

const env = leerEnv();
const url = (env.PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const llave = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const carpeta = process.argv[2];

if (!url || !llave || !env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
  salir('Faltan PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, ADMIN_EMAIL o ADMIN_PASSWORD en .env.local.');
}
if (!carpeta) salir('Indica la carpeta con las fotos: npm run estudio:modelos -- <carpeta>');

const fotos = readdirSync(carpeta).filter((f) => /^modelo-\d+\.jpg$/.test(f));
if (!fotos.length) salir(`No hay fotos modelo-N.jpg en ${carpeta}.`);

const entrada = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: llave, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }),
});
const sesion = await entrada.json().catch(() => null);
if (!entrada.ok || !sesion?.access_token) salir('No se pudo iniciar sesión: revisa ADMIN_EMAIL y ADMIN_PASSWORD.');

for (const foto of fotos) {
  const firmar = await fetch(`${url}/rest/v1/rpc/cloudinary_signature`, {
    method: 'POST',
    headers: { apikey: llave, Authorization: `Bearer ${sesion.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_params: { folder: 'divani/estudio/modelos', public_id: basename(foto, '.jpg'), overwrite: 'true' },
    }),
  });
  const firma = await firmar.json().catch(() => null);
  if (!firmar.ok || !firma?.signature) salir(`✗ ${foto}: ${firma?.message || 'no se pudo firmar la subida'}`);

  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(join(carpeta, foto))], { type: 'image/jpeg' }), foto);
  fd.append('api_key', firma.apiKey);
  fd.append('signature', firma.signature);
  for (const [k, v] of Object.entries(firma.params)) fd.append(k, String(v));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${firma.cloudName}/image/upload`, {
    method: 'POST',
    body: fd,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.secure_url) salir(`✗ ${foto}: ${data?.error?.message || res.status}`);
  console.log(`✓ ${foto} → ${data.secure_url}`);
}
