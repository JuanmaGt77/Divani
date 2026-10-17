#!/usr/bin/env node
/**
 * Prepara tu proyecto de Supabase en un solo paso (opcional: también se puede hacer a mano,
 * ver docs/CONEXION.md).
 *   1. Ejecuta supabase/schema.sql y supabase/seed.sql      (si hay SUPABASE_ACCESS_TOKEN)
 *   2. Cierra el registro público y fija la URL del sitio  (si hay SUPABASE_ACCESS_TOKEN)
 *   3. Crea el usuario administrador, ya confirmado        (con SUPABASE_SECRET_KEY)
 *   4. Comprueba que la tienda lee el catálogo y que el administrador entra al panel
 *
 * Las llaves se leen de la terminal o de .env.local (ese archivo NO se sube a GitHub).
 *   VITE_SUPABASE_URL               https://xxxx.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY   sb_publishable_…   (pública; la usa la tienda)
 *   SUPABASE_SECRET_KEY             sb_secret_…        (privada; solo para crear el usuario)
 *   SUPABASE_ACCESS_TOKEN           sbp_…              (opcional; token personal para ejecutar el SQL)
 *   ADMIN_EMAIL                     correo del administrador (por defecto somosdivani@gmail.com)
 *   ADMIN_PASSWORD                  contraseña del administrador
 *   SITE_URL                        opcional: dirección pública de la tienda (https://…)
 *
 * Uso:  npm run setup:supabase            (agrega --reset-password para cambiar la contraseña
 *                                          de un administrador que ya existe)
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));

// Lee .env y .env.local sin dependencias (lo que ya está en la terminal tiene prioridad)
for (const file of ['.env', '.env.local']) {
  const path = resolve(root, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}

const env = process.env;
const URL_ = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const PUBLISHABLE = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim();
const SECRET = String(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const TOKEN = String(env.SUPABASE_ACCESS_TOKEN || '').trim();
const EMAIL = String(env.ADMIN_EMAIL || 'somosdivani@gmail.com').trim().toLowerCase();
const PASSWORD = String(env.ADMIN_PASSWORD || '');
const SITE_URL = String(env.SITE_URL || '').trim().replace(/\/+$/, '');
const RESET = process.argv.includes('--reset-password');

const ok = (m) => console.log(`  ✓ ${m}`);
const warn = (m) => console.log(`  ! ${m}`);
const fail = (m) => { console.error(`\n✗ ${m}\n`); process.exit(1); };
const title = (m) => console.log(`\n${m}`);

const MANAGEMENT_API = String(env.SUPABASE_API_URL || 'https://api.supabase.com').replace(/\/+$/, '');
if (!/^https?:\/\//.test(URL_)) fail('Falta VITE_SUPABASE_URL (por ejemplo https://abcd1234.supabase.co). Agrégala a .env.local.');
const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co$/.exec(URL_)?.[1] || String(env.SUPABASE_PROJECT_REF || '').trim();
if (TOKEN && !ref) fail('No pudimos leer el identificador del proyecto: agrega SUPABASE_PROJECT_REF a .env.local.');

async function call(url, { method = 'GET', headers = {}, body } = {}) {
  let res;
  try {
    res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (err) {
    throw new Error(`No hay conexión con ${new URL(url).host} (${err.cause?.code || err.message}).`);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data?.message || data?.msg || data?.error_description || data?.error || (typeof data === 'string' ? data.slice(0, 300) : '') || `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, data });
  }
  return data;
}

const management = (path, opts = {}) => call(`${MANAGEMENT_API}/v1/projects/${ref}${path}`, { ...opts, headers: { Authorization: `Bearer ${TOKEN}` } });
const admin = (path, opts = {}) => call(`${URL_}/auth/v1${path}`, { ...opts, headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` } });
const asPublic = (path, opts = {}) => call(`${URL_}${path}`, { ...opts, headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${opts.token || PUBLISHABLE}` } });

console.log(`Divani · preparando Supabase (${ref || URL_})`);

/* 1 y 2. Base de datos y ajustes de inicio de sesión */
title('1. Base de datos');
if (TOKEN) {
  for (const file of ['schema.sql', 'seed.sql']) {
    const sql = readFileSync(resolve(root, 'supabase', file), 'utf8');
    try {
      await management('/database/query', { method: 'POST', body: { query: sql } });
      ok(`supabase/${file} ejecutado`);
    } catch (err) {
      fail(`supabase/${file} no se pudo ejecutar: ${err.message}`);
    }
  }
  title('2. Inicio de sesión');
  const auth = { disable_signup: true };
  if (SITE_URL) Object.assign(auth, { site_url: SITE_URL, uri_allow_list: `${SITE_URL}/**` });
  try {
    await management('/config/auth', { method: 'PATCH', body: auth });
    ok('registro público cerrado: solo entran los usuarios que tú crees');
    if (SITE_URL) ok(`URL del sitio: ${SITE_URL}`);
  } catch (err) {
    warn(`no se pudo ajustar (${err.message}). Hazlo en Authentication → Sign In / Providers: desactiva «Allow new users to sign up».`);
  }
} else {
  warn('Sin SUPABASE_ACCESS_TOKEN: ejecuta supabase/schema.sql y luego supabase/seed.sql en el SQL Editor de Supabase.');
  warn('Después, en Authentication → Sign In / Providers, desactiva «Allow new users to sign up».');
}

/* 3. Usuario administrador */
title('3. Usuario administrador');
if (!SECRET) {
  warn('Sin SUPABASE_SECRET_KEY: crea el usuario en Authentication → Users → Add user (marca «Auto Confirm User»).');
} else if (!PASSWORD) {
  warn('Falta ADMIN_PASSWORD: escríbela en la terminal (no en el código) para crear el usuario.');
} else {
  if (PASSWORD.length < 8) fail('La contraseña debe tener al menos 8 caracteres.');
  try {
    await admin('/admin/users', { method: 'POST', body: { email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { name: 'Administración' } } });
    ok(`usuario creado: ${EMAIL}`);
  } catch (err) {
    if (!/already|registered|exists/i.test(err.message)) fail(`no se pudo crear el usuario: ${err.message}`);
    if (!RESET) {
      ok(`${EMAIL} ya existía (usa --reset-password si quieres cambiar su contraseña)`);
    } else {
      let found = null;
      for (let page = 1; page <= 20 && !found; page++) {
        const list = await admin(`/admin/users?page=${page}&per_page=200`);
        const users = list?.users || [];
        found = users.find((u) => String(u.email).toLowerCase() === EMAIL);
        if (users.length < 200) break;
      }
      if (!found) fail(`no encontramos a ${EMAIL} para cambiar su contraseña.`);
      await admin(`/admin/users/${found.id}`, { method: 'PUT', body: { password: PASSWORD, email_confirm: true } });
      ok(`contraseña actualizada para ${EMAIL}`);
    }
  }
}

/* 4. Comprobación */
title('4. Comprobación');
if (!PUBLISHABLE) {
  warn('Sin VITE_SUPABASE_PUBLISHABLE_KEY no se puede comprobar la tienda (cópiala de Project Settings → API Keys).');
} else {
  try {
    const sf = await asPublic('/rest/v1/rpc/storefront', { method: 'POST', body: {} });
    ok(`la tienda lee el catálogo: ${sf?.products?.length ?? 0} productos, ${sf?.categories?.length ?? 0} categorías`);
  } catch (err) {
    warn(`la tienda aún no puede leer el catálogo (${err.message}). ¿Ya ejecutaste schema.sql y seed.sql?`);
  }
  if (PASSWORD) {
    try {
      const session = await call(`${URL_}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: PUBLISHABLE }, body: { email: EMAIL, password: PASSWORD },
      });
      const who = await asPublic('/rest/v1/rpc/whoami', { method: 'POST', body: {}, token: session.access_token });
      if (who?.isStaff) ok(`${EMAIL} entra al panel como ${who.role === 'admin' ? 'administrador' : who.role}`);
      else warn(`${EMAIL} inició sesión pero no tiene permisos del panel: vuelve a ejecutar schema.sql (otorga acceso a los correos de private.bootstrap_admins).`);
    } catch (err) {
      warn(`no se pudo iniciar sesión con ${EMAIL} (${err.message}).`);
    }
  }
}

console.log(`
Listo. Siguientes pasos:
  • En tu hosting (o en .env.local para probar en tu computadora) define VITE_SUPABASE_URL y
    VITE_SUPABASE_PUBLISHABLE_KEY y vuelve a publicar la tienda (npm run build).
  • Entra a /admin.html con ${EMAIL} y en Configuración → Conexiones pega el API Secret de Cloudinary.
  • Nunca pongas la secret key ni el token personal en la página ni en GitHub.
`);
