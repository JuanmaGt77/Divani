#!/usr/bin/env node
/**
 * Prepara tu proyecto de Supabase en un solo paso (opcional: también se puede hacer a mano,
 * ver docs/CONEXION.md).
 *   1. Ejecuta supabase/schema.sql, el catálogo de ejemplo (seed.sql, solo si la base está vacía)
 *      y las actualizaciones de supabase/actualizaciones/   (si hay SUPABASE_ACCESS_TOKEN)
 *   2. Cierra el registro público y fija la URL del sitio  (si hay SUPABASE_ACCESS_TOKEN)
 *   3. Crea el usuario administrador, ya confirmado        (con SUPABASE_SECRET_KEY)
 *   4. Comprueba que la tienda lee el catálogo y que el administrador entra al panel
 *   5. Conecta Cloudinary y prueba una subida              (si hay CLOUDINARY_*)
 *   6. Guarda en .env.local la URL y la clave publicable   (públicas; para npm run dev)
 *
 * Las llaves se leen de la terminal o de .env.local (ese archivo NO se sube a GitHub).
 *   PUBLIC_SUPABASE_URL             https://xxxx.supabase.co
 *   PUBLIC_SUPABASE_PUBLISHABLE_KEY sb_publishable_…   (pública; con el token se obtiene sola)
 *   SUPABASE_SECRET_KEY             sb_secret_…        (privada; con el token se obtiene sola)
 *   SUPABASE_ACCESS_TOKEN           sbp_…              (opcional; token personal para ejecutar el SQL)
 *   ADMIN_EMAIL                     correo del administrador (por defecto somosdivani@gmail.com)
 *   ADMIN_PASSWORD                  contraseña del administrador
 *   PUBLIC_SITE_URL                 opcional: dirección pública de la tienda (https://…)
 *   CLOUDINARY_CLOUD_NAME · CLOUDINARY_API_KEY · CLOUDINARY_API_SECRET   opcional: fotos en Cloudinary
 *
 * Uso:  npm run setup:supabase            (agrega --reset-password para cambiar la contraseña
 *                                          de un administrador que ya existe, o --seed para
 *                                          volver a cargar el catálogo de ejemplo)
 */
import { existsSync, readFileSync, readdirSync, appendFileSync } from 'node:fs';
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
const URL_ = String(env.PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || env.SUPABASE_URL || '')
  .trim()
  .replace(/\/+$/, '');
let PUBLISHABLE = String(
  env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '',
).trim();
let SECRET = String(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const TOKEN = String(env.SUPABASE_ACCESS_TOKEN || '').trim();
const EMAIL = String(env.ADMIN_EMAIL || 'somosdivani@gmail.com')
  .trim()
  .toLowerCase();
const PASSWORD = String(env.ADMIN_PASSWORD || '');
const SITE_URL = String(env.PUBLIC_SITE_URL || env.SITE_URL || '')
  .trim()
  .replace(/\/+$/, '');
const CLOUDINARY = {
  cloudName: String(env.CLOUDINARY_CLOUD_NAME || '').trim(),
  apiKey: String(env.CLOUDINARY_API_KEY || '').trim(),
  apiSecret: String(env.CLOUDINARY_API_SECRET || '').trim(),
  folder: String(env.CLOUDINARY_FOLDER || 'divani').trim(),
};
const CLOUDINARY_API = String(env.CLOUDINARY_API_URL || 'https://api.cloudinary.com').replace(/\/+$/, '');
const RESET = process.argv.includes('--reset-password');
const SEED = process.argv.includes('--seed');

const ok = (m) => console.log(`  ✓ ${m}`);
const warn = (m) => console.log(`  ! ${m}`);
const fail = (m) => {
  console.error(`\n✗ ${m}\n`);
  process.exit(1);
};
const title = (m) => console.log(`\n${m}`);

const MANAGEMENT_API = String(env.SUPABASE_API_URL || 'https://api.supabase.com').replace(/\/+$/, '');
if (!/^https?:\/\//.test(URL_))
  fail('Falta PUBLIC_SUPABASE_URL (por ejemplo https://abcd1234.supabase.co). Agrégala a .env.local.');
const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co$/.exec(URL_)?.[1] || String(env.SUPABASE_PROJECT_REF || '').trim();
if (TOKEN && !ref) fail('No pudimos leer el identificador del proyecto: agrega SUPABASE_PROJECT_REF a .env.local.');

async function call(url, { method = 'GET', headers = {}, body } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`No hay conexión con ${new URL(url).host} (${err.cause?.code || err.message}).`, { cause: err });
  }
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      data?.message ||
      data?.msg ||
      data?.error_description ||
      data?.error ||
      (typeof data === 'string' ? data.slice(0, 300) : '') ||
      `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, data });
  }
  return data;
}

const management = (path, opts = {}) =>
  call(`${MANAGEMENT_API}/v1/projects/${ref}${path}`, { ...opts, headers: { Authorization: `Bearer ${TOKEN}` } });
const admin = (path, opts = {}) =>
  call(`${URL_}/auth/v1${path}`, { ...opts, headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` } });
const asPublic = (path, opts = {}) =>
  call(`${URL_}${path}`, {
    ...opts,
    headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${opts.token || PUBLISHABLE}` },
  });
let staffToken = '';

console.log(`Divani · preparando Supabase (${ref || URL_})`);

/* 0. Con el token personal, las llaves del proyecto se obtienen solas (la secreta solo vive en memoria) */
if (TOKEN && (!PUBLISHABLE || !SECRET)) {
  title('0. Llaves del proyecto');
  try {
    const keys = await management('/api-keys?reveal=true');
    const pick = (type, legacyName) =>
      keys.find((k) => k.type === type)?.api_key || keys.find((k) => k.name === legacyName)?.api_key || '';
    if (!PUBLISHABLE) {
      PUBLISHABLE = pick('publishable', 'anon');
      if (PUBLISHABLE) ok('clave publicable obtenida');
    }
    if (!SECRET) {
      SECRET = pick('secret', 'service_role');
      if (SECRET) ok('clave secreta obtenida (solo para esta ejecución)');
    }
  } catch (err) {
    warn(`no se pudieron leer las llaves (${err.message}). Cópialas de Project Settings → API Keys.`);
  }
}

/* 1 y 2. Base de datos y ajustes de inicio de sesión */
title('1. Base de datos');
if (TOKEN) {
  const runSql = async (file) => {
    try {
      await management('/database/query', {
        method: 'POST',
        body: { query: readFileSync(resolve(root, 'supabase', file), 'utf8') },
      });
      ok(`supabase/${file} ejecutado`);
    } catch (err) {
      fail(`supabase/${file} no se pudo ejecutar: ${err.message}`);
    }
  };
  await runSql('schema.sql');
  // El catálogo de ejemplo solo se carga en una base vacía (si no, regresarían las prendas que ya borraste)
  const products = await management('/database/query', {
    method: 'POST',
    body: { query: 'select count(*)::int as n from public.products' },
  })
    .then((rows) => Number(rows?.[0]?.n) || 0)
    .catch(() => 0);
  if (!products || SEED) await runSql('seed.sql');
  else ok(`catálogo de ejemplo omitido: ya hay ${products} productos (usa --seed para cargarlo de todos modos)`);
  const updatesDir = resolve(root, 'supabase', 'actualizaciones');
  const updates = existsSync(updatesDir)
    ? readdirSync(updatesDir)
        .filter((f) => f.endsWith('.sql'))
        .sort()
    : [];
  for (const file of updates) await runSql(`actualizaciones/${file}`);
  title('2. Inicio de sesión');
  const auth = { disable_signup: true };
  if (SITE_URL) Object.assign(auth, { site_url: SITE_URL, uri_allow_list: `${SITE_URL}/**` });
  try {
    await management('/config/auth', { method: 'PATCH', body: auth });
    ok('registro público cerrado: solo entran los usuarios que tú crees');
    if (SITE_URL) ok(`URL del sitio: ${SITE_URL}`);
  } catch (err) {
    warn(
      `no se pudo ajustar (${err.message}). Hazlo en Authentication → Sign In / Providers: desactiva «Allow new users to sign up».`,
    );
  }
} else {
  warn('Sin SUPABASE_ACCESS_TOKEN: en el SQL Editor de Supabase ejecuta supabase/schema.sql, luego supabase/seed.sql');
  warn('(solo la primera vez) y después los archivos de supabase/actualizaciones/ en orden.');
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
    await admin('/admin/users', {
      method: 'POST',
      body: { email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { name: 'Administración' } },
    });
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
  warn('Sin PUBLIC_SUPABASE_PUBLISHABLE_KEY no se puede comprobar la tienda (cópiala de Project Settings → API Keys).');
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
        method: 'POST',
        headers: { apikey: PUBLISHABLE },
        body: { email: EMAIL, password: PASSWORD },
      });
      const who = await asPublic('/rest/v1/rpc/whoami', { method: 'POST', body: {}, token: session.access_token });
      if (who?.isStaff) {
        ok(`${EMAIL} entra al panel como ${who.role === 'admin' ? 'administrador' : who.role}`);
        staffToken = session.access_token;
      } else {
        warn(
          `${EMAIL} inició sesión pero no tiene permisos del panel: vuelve a ejecutar schema.sql (otorga acceso a los correos de private.bootstrap_admins).`,
        );
      }
    } catch (err) {
      warn(`no se pudo iniciar sesión con ${EMAIL} (${err.message}).`);
    }
  }
}

/* 5. Cloudinary: lo mismo que hace el panel en Configuración → Conexiones, y una subida de prueba */
if (CLOUDINARY.cloudName && CLOUDINARY.apiKey && CLOUDINARY.apiSecret) {
  title('5. Cloudinary');
  if (!staffToken) {
    warn('para conectar Cloudinary hace falta iniciar sesión como administrador (revisa los pasos anteriores).');
  } else {
    const asStaff = (path, opts = {}) => asPublic(path, { ...opts, token: staffToken });
    try {
      const [row] = await call(`${URL_}/rest/v1/settings?id=eq.1&select=private`, {
        headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${staffToken}` },
      });
      const priv = {
        ...(row?.private || {}),
        cloudinary: { cloudName: CLOUDINARY.cloudName, apiKey: CLOUDINARY.apiKey, folder: CLOUDINARY.folder },
      };
      await call(`${URL_}/rest/v1/settings?id=eq.1`, {
        method: 'PATCH',
        headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${staffToken}`, Prefer: 'return=minimal' },
        body: { private: priv, updated_at: new Date().toISOString() },
      });
      await asStaff('/rest/v1/rpc/set_integration_secret', {
        method: 'POST',
        body: { p_name: 'cloudinary_api_secret', p_value: CLOUDINARY.apiSecret },
      });
      ok(
        `datos guardados (nube «${CLOUDINARY.cloudName}», carpeta «${CLOUDINARY.folder}»; el secreto queda cifrado en la base de datos)`,
      );
      const signed = await asStaff('/rest/v1/rpc/cloudinary_signature', {
        method: 'POST',
        body: { p_params: { folder: `${CLOUDINARY.folder}/pruebas` } },
      });
      const form = new FormData();
      // Imagen de 1 × 1 px color arena
      form.append('file', 'data:image/gif;base64,R0lGODlhAQABAIAAANnGpgAAACwAAAAAAQABAAACAkQBADs=');
      form.append('api_key', signed.apiKey);
      form.append('timestamp', String(signed.timestamp));
      form.append('signature', signed.signature);
      for (const [k, v] of Object.entries(signed.params || {})) if (k !== 'timestamp') form.append(k, String(v));
      let res;
      try {
        res = await fetch(`${CLOUDINARY_API}/v1_1/${signed.cloudName}/image/upload`, { method: 'POST', body: form });
      } catch (err) {
        throw new Error(`No hay conexión con Cloudinary (${err.cause?.code || err.message}).`, { cause: err });
      }
      const up = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(up?.error?.message || `Cloudinary respondió ${res.status}`);
      ok(`subida de prueba correcta: ${up.secure_url}`);
    } catch (err) {
      warn(`Cloudinary no quedó listo (${err.message}). Revisa los datos en el panel → Configuración → Conexiones.`);
    }
  }
}

/* 6. Variables públicas para probar en esta computadora */
if (PUBLISHABLE) {
  const path = resolve(root, '.env.local');
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const missing = [
    ['PUBLIC_SUPABASE_URL', URL_],
    ['PUBLIC_SUPABASE_PUBLISHABLE_KEY', PUBLISHABLE],
  ].filter(([k]) => !new RegExp(`^\\s*${k}\\s*=\\s*\\S`, 'm').test(current));
  if (missing.length) {
    appendFileSync(
      path,
      `${current && !current.endsWith('\n') ? '\n' : ''}${missing.map(([k, v]) => `${k}=${v}`).join('\n')}\n`,
    );
    title('6. Tu computadora');
    ok('.env.local listo: npm run dev ya usa tu base de datos');
  }
}

console.log(`
Listo. Siguientes pasos:
  • En Cloudflare (o en .env.local para probar en tu computadora) define PUBLIC_SUPABASE_URL y
    PUBLIC_SUPABASE_PUBLISHABLE_KEY y vuelve a publicar la tienda (npm run deploy).
  • Entra a /admin con ${EMAIL}.${CLOUDINARY.apiSecret ? '' : ' En Configuración → Conexiones pega el API Secret de Cloudinary.'}
  • Nunca pongas la secret key, el token personal ni el API Secret en la página ni en GitHub.
`);
