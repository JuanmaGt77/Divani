/**
 * API del panel. Lecturas con supabase-js (protegidas por RLS) y escrituras importantes con
 * funciones RPC de supabase/schema.sql (transacciones en el servidor, con las reglas del negocio).
 */
import { mergeSettings, normalizeBanner, normalizeFaq, normalizeLookbook } from '@/lib/model';
import { SUPABASE } from '@/lib/env';
import type {
  Banner,
  CashSummary,
  CashView,
  Category,
  Department,
  Faq,
  InventoryMovement,
  Lookbook,
  Order,
  Product,
  SiteContent,
  SiteContentKey,
  Settings,
  Taxonomy,
} from '@/lib/types';
import { compressImage, cloudinaryUpload, validateFile, type MediaKind, type SignedUpload } from '../lib/images';
import { all, client, friendly, q, rpc } from './client';
import {
  bannerFromRow,
  bannerToRow,
  cashMovementFromRow,
  faqFromRow,
  faqToRow,
  lookbookFromRow,
  lookbookToRow,
  movementFromRow,
  orderFromRow,
  productFromRow,
  sessionFromRow,
} from './mappers';
import type {
  BannerRow,
  CashMovementRow,
  CashSessionRow,
  FaqRow,
  LookbookRow,
  MovementRow,
  OrderRow,
  ProductRow,
} from './rows';

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface Range {
  from?: Date | null;
  to?: Date | null;
}

/** Lo que se manda a save_product (colores con llave temporal para enlazar sus tallas). */
export interface ProductPayload {
  id?: string;
  slug?: string;
  code?: string;
  name: string;
  department: string;
  category: string | null;
  description: string;
  details: string[];
  material: string;
  care: string;
  origin: string;
  price: number;
  compareAtPrice: number | null;
  cost: number;
  tags: string[];
  isNew: boolean;
  isBestseller: boolean;
  isFeatured: boolean;
  status: string;
  colors: { key?: string; id?: string; name: string; hex: string; family: string; images: string[] }[];
  variants: {
    id?: string;
    colorKey?: string;
    colorId?: string;
    size: string;
    sku?: string;
    stock: number;
    minStock: number | null;
    active: boolean;
  }[];
}

export interface CheckoutPayload {
  items: { variantId: string; qty: number; discount: number }[];
  discount: number;
  customer: { name: string; phone: string };
  payments: { method: string; amount: number; received?: number }[];
}

export interface IntegrationsStatus {
  cloudinary: { cloudName: string; apiKey: string; folder: string; hasSecret: boolean };
}

export type RealtimeTopic = 'orders';
export interface RealtimeMeta {
  remote: boolean;
  newOrder: { id: string; number: string; name: string; total: number } | null;
}

const iso = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null);
const isUuid = (id: string): boolean => /^[0-9a-f-]{36}$/.test(id);

/** Actualiza la fila o la crea al final de la lista; devuelve la fila guardada. */
async function saveRow<T>(table: string, id: string | undefined, row: object): Promise<T> {
  if (id) return q<T>((sb) => sb.from(table).update(row).eq('id', id).select().single());
  const max = await q<{ sort: number }[]>((sb) =>
    sb.from(table).select('sort').order('sort', { ascending: false }).limit(1),
  );
  return q<T>((sb) =>
    sb
      .from(table)
      .insert({ ...row, sort: (max[0]?.sort ?? -1) + 1 })
      .select()
      .single(),
  );
}

const PRODUCT_SELECT = '*, colors:product_colors(*), variants:product_variants(*)';
const ORDER_SELECT = '*, items:order_items(*)';

interface WhoAmI {
  isStaff: boolean;
  name: string;
  role: string | null;
}

async function withStaff(user: { id: string; email?: string } | null | undefined): Promise<StaffUser | null> {
  if (!user) return null;
  const who = await rpc<WhoAmI>('whoami').catch(() => null);
  if (!who?.isStaff) return null;
  const email = user.email || '';
  return { id: user.id, email, name: who.name || email, role: who.role || 'admin' };
}

function authError(err: { message?: string } | null | undefined): Error {
  const m = err?.message || '';
  if (/Invalid login credentials/i.test(m)) return new Error('Correo o contraseña incorrectos.');
  if (/Email not confirmed/i.test(m)) return new Error('Confirma tu correo antes de entrar (revisa tu bandeja).');
  if (/rate limit|too many/i.test(m)) return new Error('Demasiados intentos. Espera unos minutos y vuelve a probar.');
  if (/Password should be|weak/i.test(m)) {
    return new Error('La contraseña es muy débil: usa al menos 8 caracteres con letras y números.');
  }
  return new Error(friendly(err));
}

async function sessionView(s: CashSessionRow): Promise<CashView> {
  const [summary, movements, orders] = await Promise.all([
    rpc<CashSummary>('cash_session_summary', { p_session: s.id }),
    q<CashMovementRow[]>((sb) =>
      sb.from('cash_movements').select('*').eq('session_id', s.id).order('created_at', { ascending: false }),
    ),
    all<OrderRow>((sb) =>
      sb.from('orders').select(ORDER_SELECT).eq('cash_session_id', s.id).order('created_at', { ascending: false }),
    ),
  ]);
  return {
    session: sessionFromRow(s),
    summary,
    movements: movements.map(cashMovementFromRow),
    orders: orders.map(orderFromRow),
  };
}

async function getSettings(): Promise<Settings> {
  const row = await q<{ public: unknown; private: unknown } | null>((sb) =>
    sb.from('settings').select('public, private').eq('id', 1).maybeSingle(),
  );
  return mergeSettings(row || {});
}

async function saveSettings(next: { public?: object; private?: object } = {}): Promise<Settings> {
  const cur = await getSettings();
  const merged = mergeSettings({
    public: { ...cur.public, ...(next.public || {}) },
    private: { ...cur.private, ...(next.private || {}) },
  });
  await q((sb) =>
    sb
      .from('settings')
      .update({ public: merged.public, private: merged.private, updated_at: new Date().toISOString() })
      .eq('id', 1),
  );
  return merged;
}

async function getProduct(id: string): Promise<Product | null> {
  const col = isUuid(id) ? 'id' : 'slug';
  const row = await q<ProductRow | null>((sb) => sb.from('products').select(PRODUCT_SELECT).eq(col, id).maybeSingle());
  return row ? productFromRow(row) : null;
}

async function getOrder(id: string): Promise<Order | null> {
  const col = isUuid(id) ? 'id' : 'number';
  const row = await q<OrderRow | null>((sb) =>
    sb.from('orders').select(`${ORDER_SELECT}, events:order_events(*)`).eq(col, id).maybeSingle(),
  );
  return row ? orderFromRow(row) : null;
}

async function integrationsStatus(): Promise<IntegrationsStatus> {
  return rpc<IntegrationsStatus>('integrations_status');
}

export const api = {
  auth: {
    async session(): Promise<{ user: StaffUser } | null> {
      const { data } = await client().auth.getSession();
      if (!data.session) return null;
      const user = await withStaff(data.session.user);
      return user ? { user } : null;
    },
    async signIn(email: string, password: string): Promise<{ user: StaffUser }> {
      const { data, error } = await client().auth.signInWithPassword({ email: String(email).trim(), password });
      if (error) throw authError(error);
      const user = await withStaff(data.user);
      if (!user) {
        await client().auth.signOut();
        throw new Error('Esta cuenta no tiene acceso al panel de administración.');
      }
      return { user };
    },
    async signOut(): Promise<void> {
      await client().auth.signOut();
    },
    async resetPassword(email: string): Promise<void> {
      const redirectTo = `${location.origin}/admin`;
      const { error } = await client().auth.resetPasswordForEmail(String(email).trim(), { redirectTo });
      if (error) throw authError(error);
    },
    async updatePassword(password: string): Promise<void> {
      const { error } = await client().auth.updateUser({ password });
      if (error) throw authError(error);
    },
    onChange(cb: (event: string) => void): () => void {
      const { data } = client().auth.onAuthStateChange((event) => cb(event));
      return () => data.subscription.unsubscribe();
    },
  },

  catalog: {
    products: async (): Promise<Product[]> =>
      (await all<ProductRow>((sb) => sb.from('products').select(PRODUCT_SELECT).order('sort'))).map(productFromRow),
    product: getProduct,
    async save(payload: ProductPayload): Promise<Product> {
      const res = await rpc<{ id: string }>('save_product', { payload });
      const saved = await getProduct(res.id);
      if (!saved) throw new Error('El producto se guardó pero no se pudo volver a leer. Recarga la página.');
      return saved;
    },
    remove: (id: string) => rpc('delete_product', { p_id: id }),
    async taxonomy(): Promise<Taxonomy> {
      const [departments, categories] = await Promise.all([
        q<Department[]>((sb) => sb.from('departments').select('*').order('sort')),
        q<Category[]>((sb) => sb.from('categories').select('*').order('sort')),
      ]);
      return { departments, categories };
    },
    saveCategory: (c: Partial<Category>) => rpc<Category>('save_category', { payload: c }),
    deleteCategory: (slug: string) => rpc('delete_category', { p_slug: slug }),
    saveDepartment: (d: Partial<Department>) => rpc<Department>('save_department', { payload: d }),
    reorderCategories: (slugs: string[]) => rpc('reorder_rows', { p_table: 'categories', p_keys: slugs }),
  },

  inventory: {
    adjust: ({
      variantId,
      mode = 'delta',
      qty,
      reason,
      note,
      reference,
    }: {
      variantId: string;
      mode?: 'delta' | 'set';
      qty: number;
      reason?: string;
      note?: string;
      reference?: string;
    }) =>
      rpc('inventory_adjust', {
        p_variant: variantId,
        p_mode: mode,
        p_qty: Math.trunc(Number(qty) || 0),
        p_reason: reason || 'Ajuste',
        p_note: note || '',
        p_reference: reference || '',
      }),
    receive: (payload: {
      items: { variantId: string; qty: number; unitCost: number }[];
      reference: string;
      note: string;
      updateCost: boolean;
    }) => rpc('inventory_receive', { payload }),
    async movements({ from, to, limit = 2000 }: Range & { limit?: number } = {}): Promise<InventoryMovement[]> {
      const rows = await q<MovementRow[]>((sb) => {
        let x = sb.from('inventory_movements').select('*').order('created_at', { ascending: false }).limit(limit);
        if (from) x = x.gte('created_at', iso(from));
        if (to) x = x.lte('created_at', iso(to));
        return x;
      });
      return rows.map(movementFromRow);
    },
  },

  orders: {
    async list({ from, to }: Range = {}): Promise<Order[]> {
      const rows = await all<OrderRow>((sb) => {
        let x = sb.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false });
        if (from && to) {
          x = x.or(
            `and(created_at.gte.${iso(from)},created_at.lte.${iso(to)}),and(paid_at.gte.${iso(from)},paid_at.lte.${iso(to)})`,
          );
        }
        return x;
      });
      return rows.map(orderFromRow);
    },
    get: getOrder,
    async countNew(): Promise<number> {
      const { count, error } = await client()
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'nuevo');
      if (error) throw new Error(friendly(error));
      return count || 0;
    },
    setStatus: (id: string, status: string, { note = '', reason = '' }: { note?: string; reason?: string } = {}) =>
      rpc('order_set_status', { p_order: id, p_status: status, p_note: reason || note }),
    setPayment: (
      id: string,
      {
        status,
        method = null,
        payments = null,
        note = '',
      }: { status: string; method?: string | null; payments?: unknown; note?: string },
    ) =>
      rpc('order_set_payment', { p_order: id, p_status: status, p_method: method, p_payments: payments, p_note: note }),
    update: (id: string, patch: object) => rpc('order_update', { p_order: id, p_patch: patch }),
  },

  pos: {
    async checkout(payload: CheckoutPayload): Promise<Order> {
      const res = await rpc<{ id: string }>('pos_checkout', { payload });
      const order = await getOrder(res.id);
      if (!order) throw new Error('La venta se registró pero no se pudo volver a leer. Revisa Pedidos.');
      return order;
    },
  },

  cash: {
    async current(): Promise<CashView | null> {
      const s = await q<CashSessionRow | null>((sb) =>
        sb.from('cash_sessions').select('*').eq('status', 'abierta').maybeSingle(),
      );
      return s ? sessionView(s) : null;
    },
    open: ({ amount, notes }: { amount: number; notes: string }) =>
      rpc('cash_open', { p_amount: Number(amount) || 0, p_notes: notes || '' }),
    movement: ({ type, amount, reason }: { type: string; amount: number; reason: string }) =>
      rpc('cash_movement', { p_type: type, p_amount: Number(amount) || 0, p_reason: reason || '' }),
    close: ({
      counted,
      breakdown,
      notes,
    }: {
      counted: number;
      breakdown: Record<string, number> | null;
      notes: string;
    }) =>
      rpc<{ id: string; expected: number; difference: number }>('cash_close', {
        p_counted: Number(counted) || 0,
        p_breakdown: breakdown || null,
        p_notes: notes || '',
      }),
    async sessions({ from, to }: Range = {}) {
      const rows = await all<CashSessionRow>((sb) => {
        let x = sb.from('cash_sessions').select('*').order('opened_at', { ascending: false });
        if (from) x = x.gte('opened_at', iso(from));
        if (to) x = x.lte('opened_at', iso(to));
        return x;
      });
      return rows.map(sessionFromRow);
    },
    async session(id: string): Promise<CashView | null> {
      const col = /^\d+$/.test(String(id)) ? 'number' : 'id';
      const s = await q<CashSessionRow | null>((sb) => sb.from('cash_sessions').select('*').eq(col, id).maybeSingle());
      return s ? sessionView(s) : null;
    },
  },

  content: {
    async all(): Promise<{ content: SiteContent; banners: Banner[]; lookbooks: Lookbook[]; faq: Faq[] }> {
      const [content, banners, lookbooks, faq] = await Promise.all([
        q<{ key: string; value: unknown }[]>((sb) => sb.from('site_content').select('key, value')),
        q<BannerRow[]>((sb) => sb.from('banners').select('*').order('sort')),
        q<LookbookRow[]>((sb) => sb.from('lookbooks').select('*').order('sort')),
        q<FaqRow[]>((sb) => sb.from('faq').select('*').order('sort')),
      ]);
      return {
        content: Object.fromEntries(content.map((r) => [r.key, r.value])) as SiteContent,
        banners: banners.map(bannerFromRow),
        lookbooks: lookbooks.map(lookbookFromRow),
        faq: faq.map(faqFromRow),
      };
    },
    save: <K extends SiteContentKey>(key: K, value: SiteContent[K]) =>
      q((sb) => sb.from('site_content').upsert({ key, value, updated_at: new Date().toISOString() })),
    async saveBanner(b: Partial<Banner>): Promise<Banner> {
      const nb = normalizeBanner(b);
      return bannerFromRow(await saveRow<BannerRow>('banners', nb.id, bannerToRow(nb)));
    },
    deleteBanner: (id: string) => q((sb) => sb.from('banners').delete().eq('id', id)),
    reorderBanners: (ids: string[]) => rpc('reorder_rows', { p_table: 'banners', p_keys: ids }),
    async saveLookbook(l: Partial<Lookbook>): Promise<Lookbook> {
      const nl = normalizeLookbook(l);
      return lookbookFromRow(await saveRow<LookbookRow>('lookbooks', nl.id, lookbookToRow(nl)));
    },
    deleteLookbook: (id: string) => q((sb) => sb.from('lookbooks').delete().eq('id', id)),
    reorderLookbooks: (ids: string[]) => rpc('reorder_rows', { p_table: 'lookbooks', p_keys: ids }),
    async saveFaq(f: Partial<Faq>): Promise<Faq> {
      const nf = normalizeFaq(f);
      return faqFromRow(await saveRow<FaqRow>('faq', nf.id, faqToRow(nf)));
    },
    deleteFaq: (id: string) => q((sb) => sb.from('faq').delete().eq('id', id)),
    reorderFaq: (ids: string[]) => rpc('reorder_rows', { p_table: 'faq', p_keys: ids }),
  },

  settings: {
    get: getSettings,
    save: saveSettings,
  },

  integrations: {
    status: integrationsStatus,
    async saveCloudinary({
      cloudName,
      apiKey,
      apiSecret,
      folder = 'divani',
    }: {
      cloudName: string;
      apiKey: string;
      apiSecret: string;
      folder?: string;
    }): Promise<IntegrationsStatus> {
      const cur = await getSettings();
      await saveSettings({
        private: {
          cloudinary: {
            ...cur.private.cloudinary,
            cloudName: String(cloudName || '').trim(),
            apiKey: String(apiKey || '').trim(),
            folder: folder || 'divani',
          },
        },
      });
      if (apiSecret) await rpc('set_integration_secret', { p_name: 'cloudinary_api_secret', p_value: apiSecret });
      return integrationsStatus();
    },
  },

  media: {
    async upload(
      file: File,
      {
        kind = 'image',
        folder = 'divani',
        onProgress,
      }: { kind?: MediaKind; folder?: string; onProgress?: (p: number) => void } = {},
    ): Promise<string> {
      validateFile(file, { kind });
      onProgress?.(0.02);
      const body = kind === 'video' ? file : await compressImage(file);
      const signed = await rpc<SignedUpload>('cloudinary_signature', { p_params: { folder } });
      const res = await cloudinaryUpload(body, signed, { kind, ...(onProgress ? { onProgress } : {}) });
      return res.secure_url;
    },
  },

  /** Avisa de pedidos nuevos o cambios hechos desde otro lugar (Supabase Realtime). */
  subscribe(fn: (topic: RealtimeTopic, meta: RealtimeMeta) => void): () => void {
    const channel = client()
      .channel('divani-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const row = (payload.new || {}) as Partial<OrderRow>;
        const newOrder =
          payload.eventType === 'INSERT' && row.channel === 'web' && row.id && row.number
            ? { id: row.id, number: row.number, name: row.customer_name || '', total: Number(row.total) || 0 }
            : null;
        fn('orders', { remote: true, newOrder });
      })
      .subscribe();
    return () => {
      void channel.unsubscribe();
    };
  },

  /** Copia de todas las tablas del negocio en un archivo. */
  async backup(): Promise<Record<string, unknown>> {
    const tables = [
      'settings',
      'departments',
      'categories',
      'products',
      'product_colors',
      'product_variants',
      'orders',
      'order_items',
      'order_events',
      'inventory_movements',
      'cash_sessions',
      'cash_movements',
      'banners',
      'lookbooks',
      'faq',
      'site_content',
    ];
    const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), source: SUPABASE.url };
    for (const t of tables) out[t] = await all((sb) => sb.from(t).select('*'));
    return out;
  },
};

export type Api = typeof api;
