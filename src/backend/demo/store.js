/**
 * Base de datos de demostración: vive en IndexedDB de este navegador.
 * La crea el panel (modo demostración) a partir de public/data/*.json y la lee la tienda,
 * así se puede probar todo el sistema —panel ↔ tienda— sin servidor.
 * Los cambios se avisan a las otras pestañas abiertas con BroadcastChannel.
 */
import { buildCatalog } from '../seed.js';

const DB_NAME = 'divani-demo';
const STORE = 'kv';
const KEY = 'db';
const CHANNEL = 'divani-demo';
const SCHEMA_VERSION = 1;

let memory = null;          // copia en memoria (fallback si IndexedDB no está disponible)
let idbPromise = null;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;

function openIdb() {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return idbPromise;
}

async function idb(mode, fn) {
  const db = await openIdb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => resolve(undefined);
      tx.onabort = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

const read = () => idb('readonly', (s) => s.get(KEY));
const write = (value) => idb('readwrite', (s) => s.put(value, KEY));

/** ¿Ya existe una base de demostración en este navegador? (la tienda la usa si existe) */
export async function hasDemoDb() {
  if (memory) return true;
  const v = await read();
  return Boolean(v && v.version === SCHEMA_VERSION);
}

async function fetchJson(name) {
  const res = await fetch(new URL(`data/${name}.json`, document.baseURI));
  if (!res.ok) throw new Error(`No se pudo cargar ${name}.json`);
  return res.json();
}

/** Crea la base a partir del catálogo de muestra y le agrega un historial de ventas de ejemplo. */
export async function createDemoDb({ withHistory = true } = {}) {
  const names = ['products', 'categories', 'banners', 'lookbooks', 'faq', 'settings', 'content'];
  const values = await Promise.all(names.map(fetchJson));
  const src = Object.fromEntries(names.map((n, i) => [n, values[i]]));
  const db = buildCatalog(src);
  db.demo = { createdAt: new Date().toISOString(), history: withHistory };
  if (withHistory) {
    const { addDemoHistory } = await import('./history.js');
    addDemoHistory(db);
  }
  await save(db);
  return db;
}

/** Lee la base. Con `create`, la genera si todavía no existe. */
export async function loadDemoDb({ create = false } = {}) {
  const v = await read();
  if (v && v.version === SCHEMA_VERSION) {
    memory = v;
    return v;
  }
  if (memory) return memory;
  if (!create) return null;
  return createDemoDb();
}

async function save(db) {
  memory = db;
  const ok = await write(db);
  return ok !== undefined || true;
}

/**
 * Aplica un cambio de forma atómica: lee la versión más reciente, ejecuta `fn(db)` y guarda.
 * Si `fn` lanza un error, no se guarda nada.
 */
let queue = Promise.resolve();
export function mutate(fn, { topic = 'data' } = {}) {
  const run = async () => {
    const db = structuredClone(await loadDemoDb({ create: true }));
    const result = await fn(db);
    await save(db);
    notify(topic);
    return result;
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

export async function resetDemoDb({ withHistory = true } = {}) {
  memory = null;
  await idb('readwrite', (s) => s.delete(KEY));
  const db = await createDemoDb({ withHistory });
  notify('reset');
  return db;
}

const listeners = new Set();
function notify(topic) {
  listeners.forEach((fn) => fn(topic));
  channel?.postMessage({ topic });
}
channel?.addEventListener('message', async (e) => {
  memory = null;
  await loadDemoDb();
  listeners.forEach((fn) => fn(e.data?.topic || 'data', { remote: true }));
});

/** Escucha cambios (de esta pestaña o de otras). Devuelve la función para dejar de escuchar. */
export function onDemoChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
