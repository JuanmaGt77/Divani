/**
 * API del panel con Supabase. Lecturas con supabase-js (protegidas por RLS) y escrituras
 * importantes con funciones RPC de supabase/schema.sql (transacciones en el servidor).
 */
import { SUPABASE, AUTH_STORAGE_KEY } from '../../backend/config.js';
import { mergeSettings, normalizeBanner, normalizeLookbook, normalizeFaq } from '../../backend/model.js';
import * as ops from '../../backend/ops.js';
import { compressImage, cloudinaryUpload, validateFile } from '../lib/images.js';
import {
  productFromRow, orderFromRow, movementFromRow, sessionFromRow, cashMovementFromRow,
  bannerFromRow, bannerToRow, lookbookFromRow, lookbookToRow, faqFromRow, faqToRow,
} from './mappers.js';

let clientPromise = null;
export function client() {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(SUPABASE.url, SUPABASE.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_STORAGE_KEY },
  }));
  return clientPromise;
}

function friendly(err) {
  const msg = err?.message || '';
  if (err?.code === '42501' || /permission denied/i.test(msg)) return 'No tienes permiso para hacer esto.';
  if (/JWT|token is expired|refresh token/i.test(msg)) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg)) return 'Sin conexión con la base de datos. Revisa tu internet.';
  if (/Could not find the function|schema cache/i.test(msg)) return 'La base de datos no está preparada: ejecuta supabase/schema.sql en Supabase.';
  if (/relation .* does not exist/i.test(msg)) return 'Faltan tablas en la base de datos: ejecuta supabase/schema.sql en Supabase.';
  if (/duplicate key/i.test(msg)) return 'Ya existe un registro con esos datos.';
  return msg || 'Ocurrió un error con la base de datos.';
}
const toError = (err) => Object.assign(new Error(friendly(err)), { code: err?.code, cause: err });

async function rpc(name, args = {}) {
  const sb = await client();
  const { data, error } = await sb.rpc(name, args);
  if (error) throw toError(error);
  return data;
}

async function q(build) {
  const sb = await client();
  const { data, error } = await build(sb);
  if (error) throw toError(error);
  return data;
}

/** Trae todas las filas (Supabase devuelve como máximo 1000 por consulta). */
async function all(build, page = 1000) {
  const out = [];
  for (let from = 0; ; from += page) {
    const rows = await q((sb) => build(sb).range(from, from + page - 1));
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

const iso = (d) => (d ? new Date(d).toISOString() : null);

/** Actualiza la fila o la crea al final de la lista; devuelve la fila guardada. */
async function saveRow(table, id, row) {
  if (id) return q((sb) => sb.from(table).update(row).eq('id', id).select().single());
  const max = await q((sb) => sb.from(table).select('sort').order('sort', { ascending: false }).limit(1));
  return q((sb) => sb.from(table).insert({ ...row, sort: (max[0]?.sort ?? -1) + 1 }).select().single());
}
const PRODUCT_SELECT = '*, colors:product_colors(*), variants:product_variants(*)';
const ORDER_SELECT = '*, items:order_items(*)';

async function withStaff(user) {
  if (!user) return null;
  const who = await rpc('whoami').catch(() => null);
  if (!who?.isStaff) return null;
  return { id: user.id, email: user.email, name: who.name || user.email, role: who.role || 'admin' };
}

function authError(err) {
  const m = err?.message || '';
  if (/Invalid login credentials/i.test(m)) return new Error('Correo o contraseña incorrectos.');
  if (/Email not confirmed/i.test(m)) return new Error('Confirma tu correo antes de entrar (revisa tu bandeja).');
  if (/rate limit|too many/i.test(m)) return new Error('Demasiados intentos. Espera unos minutos y vuelve a probar.');
  if (/Password should be|weak/i.test(m)) return new Error('La contraseña es muy débil: usa al menos 8 caracteres con letras y números.');
  return new Error(friendly(err));
}

async function taxonomyRows() {
  const [departments, categories, used] = await Promise.all([
    q((sb) => sb.from('departments').select('*').order('sort')),
    q((sb) => sb.from('categories').select('*').order('sort')),
    all((sb) => sb.from('products').select('category')),
  ]);
  return { departments, categories, products: used };
}

async function sessionView(s) {
  const [summary, movements, orders] = await Promise.all([
    rpc('cash_session_summary', { p_session: s.id }),
    q((sb) => sb.from('cash_movements').select('*').eq('session_id', s.id).order('created_at', { ascending: false })),
    all((sb) => sb.from('orders').select(ORDER_SELECT).eq('cash_session_id', s.id).order('created_at', { ascending: false })),
  ]);
  return { session: sessionFromRow(s), summary, movements: movements.map(cashMovementFromRow), orders: orders.map(orderFromRow) };
}

export const supabaseApi = {
  mode: 'supabase',

  auth: {
    async session() {
      const sb = await client();
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      const user = await withStaff(data.session.user);
      return user ? { user } : null;
    },
    async signIn(email, password) {
      const sb = await client();
      const { data, error } = await sb.auth.signInWithPassword({ email: String(email).trim(), password });
      if (error) throw authError(error);
      const user = await withStaff(data.user);
      if (!user) {
        await sb.auth.signOut();
        throw new Error('Esta cuenta no tiene acceso al panel de administración.');
      }
      return { user };
    },
    async signOut() {
      const sb = await client();
      await sb.auth.signOut();
    },
    async resetPassword(email) {
      const sb = await client();
      const redirectTo = `${location.origin}${location.pathname}`;
      const { error } = await sb.auth.resetPasswordForEmail(String(email).trim(), { redirectTo });
      if (error) throw authError(error);
    },
    async updatePassword(password) {
      const sb = await client();
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw authError(error);
    },
    onChange(cb) {
      let unsub = () => {};
      client().then((sb) => {
        const { data } = sb.auth.onAuthStateChange((event) => cb(event));
        unsub = () => data.subscription.unsubscribe();
      });
      return () => unsub();
    },
  },

  catalog: {
    products: async () => (await all((sb) => sb.from('products').select(PRODUCT_SELECT).order('sort'))).map(productFromRow),
    async product(id) {
      const col = /^[0-9a-f-]{36}$/.test(id) ? 'id' : 'slug';
      const row = await q((sb) => sb.from('products').select(PRODUCT_SELECT).eq(col, id).maybeSingle());
      return row ? productFromRow(row) : null;
    },
    async save(payload) {
      const res = await rpc('save_product', { payload });
      return supabaseApi.catalog.product(res.id);
    },
    remove: (id) => rpc('delete_product', { p_id: id }),
    async taxonomy() {
      const { departments, categories } = await taxonomyRows();
      return { departments, categories };
    },
    async saveCategory(c) {
      const t = await taxonomyRows();
      const cat = ops.saveCategory(structuredClone(t), c);
      await q((sb) => sb.from('categories').upsert({
        slug: cat.slug, department: cat.department, name: cat.name, description: cat.description, image: cat.image, sort: cat.sort, active: cat.active,
      }));
      return cat;
    },
    async deleteCategory(slug) {
      const t = await taxonomyRows();
      ops.deleteCategory(structuredClone(t), slug);
      await q((sb) => sb.from('categories').delete().eq('slug', slug));
      return true;
    },
    async saveDepartment(d) {
      const t = await taxonomyRows();
      const dep = ops.saveDepartment(structuredClone(t), d);
      await q((sb) => sb.from('departments').update({ name: dep.name, description: dep.description, image: dep.image, active: dep.active }).eq('slug', dep.slug));
      return dep;
    },
    reorderCategories: (slugs) => rpc('reorder_rows', { p_table: 'categories', p_keys: slugs }),
  },

  inventory: {
    adjust: ({ variantId, mode = 'delta', qty, reason, note, reference }) =>
      rpc('inventory_adjust', { p_variant: variantId, p_mode: mode, p_qty: Math.trunc(Number(qty) || 0), p_reason: reason || 'Ajuste', p_note: note || '', p_reference: reference || '' }),
    receive: (payload) => rpc('inventory_receive', { payload }),
    async movements({ from, to, limit = 2000 } = {}) {
      const rows = await q((sb) => {
        let x = sb.from('inventory_movements').select('*').order('created_at', { ascending: false }).limit(limit);
        if (from) x = x.gte('created_at', iso(from));
        if (to) x = x.lte('created_at', iso(to));
        return x;
      });
      return rows.map(movementFromRow);
    },
  },

  orders: {
    async list({ from, to } = {}) {
      const rows = await all((sb) => {
        let x = sb.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false });
        if (from && to) x = x.or(`and(created_at.gte.${iso(from)},created_at.lte.${iso(to)}),and(paid_at.gte.${iso(from)},paid_at.lte.${iso(to)})`);
        return x;
      });
      return rows.map(orderFromRow);
    },
    async get(id) {
      const col = /^[0-9a-f-]{36}$/.test(id) ? 'id' : 'number';
      const row = await q((sb) => sb.from('orders').select(`${ORDER_SELECT}, events:order_events(*)`).eq(col, id).maybeSingle());
      return row ? orderFromRow(row) : null;
    },
    async countNew() {
      const sb = await client();
      const { count, error } = await sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'nuevo');
      if (error) throw toError(error);
      return count || 0;
    },
    setStatus: (id, status, { note = '', reason = '' } = {}) => rpc('order_set_status', { p_order: id, p_status: status, p_note: reason || note }),
    setPayment: (id, { status, method = null, payments = null, note = '' } = {}) =>
      rpc('order_set_payment', { p_order: id, p_status: status, p_method: method, p_payments: payments, p_note: note }),
    update: (id, patch) => rpc('order_update', { p_order: id, p_patch: patch }),
  },

  pos: {
    async checkout(payload) {
      const res = await rpc('pos_checkout', { payload });
      return supabaseApi.orders.get(res.id);
    },
  },

  cash: {
    async current() {
      const s = await q((sb) => sb.from('cash_sessions').select('*').eq('status', 'abierta').maybeSingle());
      return s ? sessionView(s) : null;
    },
    open: ({ amount, notes }) => rpc('cash_open', { p_amount: Number(amount) || 0, p_notes: notes || '' }),
    movement: ({ type, amount, reason }) => rpc('cash_movement', { p_type: type, p_amount: Number(amount) || 0, p_reason: reason || '' }),
    close: ({ counted, breakdown, notes }) => rpc('cash_close', { p_counted: Number(counted) || 0, p_breakdown: breakdown || null, p_notes: notes || '' }),
    async sessions({ from, to } = {}) {
      const rows = await all((sb) => {
        let x = sb.from('cash_sessions').select('*').order('opened_at', { ascending: false });
        if (from) x = x.gte('opened_at', iso(from));
        if (to) x = x.lte('opened_at', iso(to));
        return x;
      });
      return rows.map(sessionFromRow);
    },
    async session(id) {
      const col = /^\d+$/.test(String(id)) ? 'number' : 'id';
      const s = await q((sb) => sb.from('cash_sessions').select('*').eq(col, id).maybeSingle());
      return s ? sessionView(s) : null;
    },
  },

  content: {
    async all() {
      const [content, banners, lookbooks, faq] = await Promise.all([
        q((sb) => sb.from('site_content').select('key, value')),
        q((sb) => sb.from('banners').select('*').order('sort')),
        q((sb) => sb.from('lookbooks').select('*').order('sort')),
        q((sb) => sb.from('faq').select('*').order('sort')),
      ]);
      return {
        content: Object.fromEntries(content.map((r) => [r.key, r.value])),
        banners: banners.map(bannerFromRow),
        lookbooks: lookbooks.map(lookbookFromRow),
        faq: faq.map(faqFromRow),
      };
    },
    save: (key, value) => q((sb) => sb.from('site_content').upsert({ key, value, updated_at: new Date().toISOString() })),
    async saveBanner(b) {
      return bannerFromRow(await saveRow('banners', b.id, bannerToRow(normalizeBanner(b))));
    },
    deleteBanner: (id) => q((sb) => sb.from('banners').delete().eq('id', id)),
    reorderBanners: (ids) => rpc('reorder_rows', { p_table: 'banners', p_keys: ids }),
    async saveLookbook(l) {
      return lookbookFromRow(await saveRow('lookbooks', l.id, lookbookToRow(normalizeLookbook(l))));
    },
    deleteLookbook: (id) => q((sb) => sb.from('lookbooks').delete().eq('id', id)),
    reorderLookbooks: (ids) => rpc('reorder_rows', { p_table: 'lookbooks', p_keys: ids }),
    async saveFaq(f) {
      return faqFromRow(await saveRow('faq', f.id, faqToRow(normalizeFaq(f))));
    },
    deleteFaq: (id) => q((sb) => sb.from('faq').delete().eq('id', id)),
    reorderFaq: (ids) => rpc('reorder_rows', { p_table: 'faq', p_keys: ids }),
  },

  settings: {
    async get() {
      const row = await q((sb) => sb.from('settings').select('public, private').eq('id', 1).maybeSingle());
      return mergeSettings(row || {});
    },
    async save(next = {}) {
      const cur = await supabaseApi.settings.get();
      const merged = mergeSettings({ public: { ...cur.public, ...(next.public || {}) }, private: { ...cur.private, ...(next.private || {}) } });
      await q((sb) => sb.from('settings').update({ public: merged.public, private: merged.private, updated_at: new Date().toISOString() }).eq('id', 1));
      return merged;
    },
  },

  integrations: {
    status: () => rpc('integrations_status'),
    async saveCloudinary({ cloudName, apiKey, apiSecret, folder = 'divani' }) {
      const cur = await supabaseApi.settings.get();
      await supabaseApi.settings.save({ private: { cloudinary: { ...cur.private.cloudinary, cloudName: String(cloudName || '').trim(), apiKey: String(apiKey || '').trim(), folder: folder || 'divani' } } });
      if (apiSecret) await rpc('set_integration_secret', { p_name: 'cloudinary_api_secret', p_value: apiSecret });
      return supabaseApi.integrations.status();
    },
  },

  media: {
    async upload(file, { kind = 'image', folder = 'divani', onProgress } = {}) {
      validateFile(file, { kind });
      onProgress?.(0.02);
      const body = kind === 'video' ? file : await compressImage(file);
      const signed = await rpc('cloudinary_signature', { p_params: { folder } });
      const res = await cloudinaryUpload(body, signed, { kind, onProgress });
      return res.secure_url;
    },
  },

  subscribe(fn) {
    let channel = null;
    client().then((sb) => {
      channel = sb.channel('divani-panel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          const row = payload.new || {};
          const newOrder = payload.eventType === 'INSERT' && row.channel === 'web'
            ? { id: row.id, number: row.number, name: row.customer_name, total: Number(row.total) || 0 }
            : null;
          fn('orders', { remote: true, newOrder });
        })
        .subscribe();
    });
    return () => { channel?.unsubscribe(); };
  },

  async backup() {
    const tables = ['settings', 'departments', 'categories', 'products', 'product_colors', 'product_variants', 'orders', 'order_items',
      'order_events', 'inventory_movements', 'cash_sessions', 'cash_movements', 'banners', 'lookbooks', 'faq', 'site_content'];
    const out = { exportedAt: new Date().toISOString(), source: SUPABASE.url };
    for (const t of tables) out[t] = await all((sb) => sb.from(t).select('*'));
    return out;
  },
};
