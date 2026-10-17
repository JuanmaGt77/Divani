/**
 * API del panel en modo demostración: todo vive en IndexedDB de este navegador.
 * Misma interfaz que supabase.js, así las pantallas no saben con cuál trabajan.
 */
import { loadDemoDb, mutate, onDemoChange, resetDemoDb } from '../../backend/demo/store.js';
import * as ops from '../../backend/ops.js';
import { mergeSettings, cashSummary } from '../../backend/model.js';
import { toLocalDataUrl } from '../lib/images.js';

const SESSION_KEY = 'divani.demo.session';
export const DEMO_USER = { id: 'demo-admin', email: 'demo@divani', name: 'Administración', role: 'admin', demo: true };
const by = { user: { id: DEMO_USER.id, name: DEMO_USER.name } };

const clone = (v) => (v === undefined || v === null ? v : structuredClone(v));
const db = () => loadDemoDb({ create: true });
const write = (fn, topic) => mutate(fn, { topic }).then(clone);
const inRange = (iso, from, to) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return (!from || t >= new Date(from).getTime()) && (!to || t <= new Date(to).getTime());
};

function sessionView(d, s) {
  return {
    session: s,
    summary: cashSummary(s, d.orders, d.cashMovements),
    movements: d.cashMovements.filter((m) => m.sessionId === s.id),
    orders: d.orders.filter((o) => o.cashSessionId === s.id),
  };
}

export const demoApi = {
  mode: 'demo',

  auth: {
    async session() {
      try {
        const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        return s?.user ? { user: { ...DEMO_USER, ...s.user } } : null;
      } catch {
        return null;
      }
    },
    async signIn() {
      throw new Error('El panel está en modo demostración: usa el botón «Entrar a la demostración».');
    },
    async signInDemo() {
      await db();
      const s = { user: DEMO_USER, at: new Date().toISOString() };
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ }
      return s;
    },
    async signOut() {
      try { localStorage.removeItem(SESSION_KEY); } catch { /* sin almacenamiento */ }
    },
    async resetPassword() {
      throw new Error('En modo demostración no hay contraseñas.');
    },
    async updatePassword() {
      throw new Error('En modo demostración no hay contraseñas. Conecta Supabase para usar tu usuario real.');
    },
    onChange() {
      return () => {};
    },
  },

  catalog: {
    products: async () => clone((await db()).products),
    product: async (id) => clone((await db()).products.find((p) => p.id === id || p.slug === id) || null),
    save: (payload) => write((d) => ops.saveProduct(d, payload, by), 'products'),
    remove: (id) => write((d) => ops.deleteProduct(d, id), 'products'),
    taxonomy: async () => {
      const d = await db();
      return clone({ departments: d.departments, categories: d.categories });
    },
    saveCategory: (c) => write((d) => ops.saveCategory(d, c), 'taxonomy'),
    deleteCategory: (slug) => write((d) => ops.deleteCategory(d, slug), 'taxonomy'),
    saveDepartment: (dep) => write((d) => ops.saveDepartment(d, dep), 'taxonomy'),
    reorderCategories: (slugs) => write((d) => ops.reorder(d, 'categories', slugs, 'slug'), 'taxonomy'),
  },

  inventory: {
    adjust: (p) => write((d) => ops.inventoryAdjust(d, { ...p, ...by }), 'inventory'),
    receive: (p) => write((d) => ops.inventoryReceive(d, { ...p, ...by }), 'inventory'),
    movements: async ({ from, to, limit = 2000 } = {}) =>
      clone((await db()).movements.filter((m) => (!from && !to) || inRange(m.createdAt, from, to)).slice(0, limit)),
  },

  orders: {
    list: async ({ from, to } = {}) =>
      clone((await db()).orders.filter((o) => (!from && !to) || inRange(o.createdAt, from, to) || inRange(o.paidAt, from, to))),
    get: async (id) => clone((await db()).orders.find((o) => o.id === id || o.number === id) || null),
    countNew: async () => (await db()).orders.filter((o) => o.status === 'nuevo').length,
    setStatus: (id, status, opt = {}) => write((d) => ops.orderSetStatus(d, id, status, { ...opt, ...by }), 'orders'),
    setPayment: (id, opt = {}) => write((d) => ops.orderSetPayment(d, id, { ...opt, ...by }), 'orders'),
    update: (id, patch) => write((d) => ops.orderUpdate(d, id, patch, by), 'orders'),
  },

  pos: {
    checkout: (payload) => write((d) => ops.posCheckout(d, payload, by), 'orders'),
  },

  cash: {
    async current() {
      const d = await db();
      const s = d.cashSessions.find((x) => x.status === 'abierta');
      return s ? clone(sessionView(d, s)) : null;
    },
    open: (p) => write((d) => ops.cashOpen(d, { ...p, ...by }), 'cash'),
    movement: (p) => write((d) => ops.cashMovement(d, { ...p, ...by }), 'cash'),
    close: (p) => write((d) => ops.cashClose(d, { ...p, ...by }), 'cash'),
    sessions: async ({ from, to } = {}) =>
      clone((await db()).cashSessions.filter((s) => (!from && !to) || inRange(s.openedAt, from, to))),
    async session(id) {
      const d = await db();
      const s = d.cashSessions.find((x) => x.id === id || String(x.number) === String(id));
      return s ? clone(sessionView(d, s)) : null;
    },
  },

  content: {
    async all() {
      const d = await db();
      return clone({ content: d.content, banners: d.banners, lookbooks: d.lookbooks, faq: d.faq });
    },
    save: (key, value) => write((d) => ops.saveContent(d, key, value), 'content'),
    saveBanner: (b) => write((d) => ops.saveBanner(d, b), 'content'),
    deleteBanner: (id) => write((d) => ops.removeFrom(d, 'banners', id), 'content'),
    reorderBanners: (ids) => write((d) => ops.reorder(d, 'banners', ids), 'content'),
    saveLookbook: (l) => write((d) => ops.saveLookbook(d, l), 'content'),
    deleteLookbook: (id) => write((d) => ops.removeFrom(d, 'lookbooks', id), 'content'),
    reorderLookbooks: (ids) => write((d) => ops.reorder(d, 'lookbooks', ids), 'content'),
    saveFaq: (f) => write((d) => ops.saveFaq(d, f), 'content'),
    deleteFaq: (id) => write((d) => ops.removeFrom(d, 'faq', id), 'content'),
    reorderFaq: (ids) => write((d) => ops.reorder(d, 'faq', ids), 'content'),
  },

  settings: {
    get: async () => clone(mergeSettings((await db()).settings)),
    save: (next) => write((d) => ops.saveSettings(d, next), 'settings'),
  },

  integrations: {
    status: async () => ({ cloudinary: { cloudName: '', apiKey: '', folder: 'divani', hasSecret: false, demo: true } }),
    async saveCloudinary() {
      throw new Error('Cloudinary se conecta cuando el panel trabaja con Supabase (así el secreto queda protegido en el servidor).');
    },
  },

  media: {
    upload: (file, { kind = 'image', onProgress } = {}) => toLocalDataUrl(file, { kind, onProgress }),
  },

  subscribe(fn) {
    return onDemoChange(async (topic, meta = {}) => {
      let newOrder = null;
      if (meta.remote && (topic === 'orders' || topic === 'data')) {
        const o = (await db()).orders.find((x) => x.channel === 'web');
        if (o && Date.now() - new Date(o.createdAt).getTime() < 20000) newOrder = { id: o.id, number: o.number, name: o.customer?.name, total: o.total };
      }
      fn(topic, { ...meta, newOrder });
    });
  },

  backup: async () => clone(await db()),

  demo: {
    reset: (opt) => resetDemoDb(opt),
  },
};
