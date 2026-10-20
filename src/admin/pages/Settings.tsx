/**
 * Configuración al estilo Ajustes de iPhone: datos de la tienda, región y moneda, pedidos en línea,
 * punto de venta y caja, inventario, conexiones (Supabase y Cloudinary), cuenta y respaldo.
 */
import { useEffect, useRef, useState, type ComponentType, type SVGProps } from 'react';
import { useStore } from '@nanostores/react';
import {
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Cloud,
  Database,
  DatabaseBackup,
  Download,
  ExternalLink,
  Globe,
  Info,
  KeyRound,
  LogOut,
  PlugZap,
  Plus,
  Printer,
  RotateCcw,
  Save,
  ScanBarcode,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { phone as fmtPhone } from '@/lib/format';
import { SUPABASE } from '@/lib/env';
import { PAYMENT_METHODS, REGION_PRESETS, isRegionId, pickRegion, slugify, type RegionId } from '@/lib/model';
import type {
  CheckoutSettings,
  DeliveryMethod,
  Denominations,
  PaymentOption,
  PrivateSettings,
  RegionSettings,
  Settings as SettingsData,
  StoreInfo,
} from '@/lib/types';
import { api } from '../api';
import { download, fileStamp } from '../lib/csv';
import { printTicket } from '../lib/documents';
import { useIsMobile } from '../lib/hooks';
import { useSearch, useUnsavedChanges } from '../lib/navigation';
import { invalidate, useData } from '../lib/query';
import { loadSettings, session, settingsStore, signOut } from '../lib/session';
import { waNumber } from '../lib/whatsapp';
import {
  Button,
  Chip,
  Field,
  IconButton,
  MoneyField,
  PasswordInput,
  Segmented,
  Stepper,
  Switch,
  SwitchRow,
  TagInput,
  TextField,
  cx,
  type MoneyValue,
} from '../ui/controls';
import { confirmDialog, toast, toastError } from '../ui/overlays';
import { Badge, Card, PageHeader, Skeleton } from '../ui/surfaces';
import { WhatsAppIcon } from '../ui/icons';

/* Íconos de redes (lucide ya no trae logotipos de marcas) */
const svgProps: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};
const Instagram = () => (
  <svg {...svgProps}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const Facebook = () => (
  <svg {...svgProps}>
    <path d="M14 8.5h2.5V5H14a4 4 0 0 0-4 4v2H8v3.5h2V21h3.5v-6.5H16l.5-3.5h-3V9a.5.5 0 0 1 .5-.5Z" />
  </svg>
);
const TikTok = () => (
  <svg {...svgProps}>
    <path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5" />
    <path d="M14 4c.4 2.6 2.3 4.4 5 4.6" />
  </svg>
);

type SectionId = 'tienda' | 'region' | 'pedidos' | 'caja' | 'inventario' | 'integraciones' | 'cuenta' | 'datos';

const SECTIONS: { id: SectionId; label: string; sub: string; icon: LucideIcon; tone: string }[] = [
  { id: 'tienda', label: 'Tienda y contacto', sub: 'Nombre, WhatsApp, horario y redes', icon: Store, tone: '#171513' },
  { id: 'region', label: 'Región y moneda', sub: 'País, moneda y teléfonos', icon: Globe, tone: '#2a5d8f' },
  {
    id: 'pedidos',
    label: 'Pedidos en línea',
    sub: 'Entrega, formas de pago y envíos',
    icon: ShoppingBag,
    tone: '#2c6a4d',
  },
  {
    id: 'caja',
    label: 'Punto de venta y caja',
    sub: 'Cobro, fondo de caja y ticket',
    icon: ScanBarcode,
    tone: '#8c5c0e',
  },
  { id: 'inventario', label: 'Inventario', sub: 'SKU y avisos de existencias', icon: Boxes, tone: '#7a476c' },
  { id: 'integraciones', label: 'Conexiones', sub: 'Base de datos y fotos', icon: PlugZap, tone: '#1b6464' },
  { id: 'cuenta', label: 'Mi cuenta', sub: 'Contraseña y sesión', icon: KeyRound, tone: '#625c55' },
  { id: 'datos', label: 'Respaldo y datos', sub: 'Copia de seguridad', icon: DatabaseBackup, tone: '#625c55' },
];

export default function Settings() {
  const settings = useStore(settingsStore);
  const mobile = useIsMobile();
  const { query, setQuery } = useSearch();
  const active = SECTIONS.find((s) => s.id === query.seccion) || (mobile ? null : SECTIONS[0]);
  const go = (id: SectionId) => setQuery({ seccion: id });

  return (
    <main className="page page--wide">
      {(!mobile || !active) && (
        <PageHeader title="Configuración" sub="Datos de tu tienda, cómo cobras y cómo se conecta todo." />
      )}
      <div className="settings">
        {(!mobile || !active) && (
          <nav className="settings__nav card" aria-label="Secciones de configuración">
            <div className="list">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={cx('list__row settings__link', active?.id === s.id && 'is-active')}
                  aria-current={active?.id === s.id ? 'page' : undefined}
                  onClick={() => go(s.id)}
                  style={{ '--inset': '66px' }}
                >
                  <span className="settings__icon" style={{ background: s.tone }}>
                    <s.icon aria-hidden="true" />
                  </span>
                  <span className="list__body">
                    <span className="list__title">{s.label}</span>
                    <span className="list__sub">{s.sub}</span>
                  </span>
                  <ChevronRight className="list__chev" aria-hidden="true" />
                </button>
              ))}
            </div>
          </nav>
        )}
        {active && (
          <section className="settings__panel" aria-labelledby="settings-title">
            {mobile && (
              <button type="button" className="back-link" onClick={() => setQuery({ seccion: '' })}>
                <ChevronLeft aria-hidden="true" />
                Configuración
              </button>
            )}
            <header className="settings__head">
              <span className="settings__icon settings__icon--lg" style={{ background: active.tone }}>
                <active.icon aria-hidden="true" />
              </span>
              <div>
                <h1 className="settings__title" id="settings-title">
                  {active.label}
                </h1>
                <p className="muted small">{active.sub}</p>
              </div>
            </header>
            {!settings ? (
              <Card pad>
                <div className="stack">
                  <Skeleton h={18} w="40%" />
                  <Skeleton h={44} />
                  <Skeleton h={44} />
                </div>
              </Card>
            ) : (
              <>
                {active.id === 'tienda' && <StoreSection settings={settings} />}
                {active.id === 'region' && <RegionSection settings={settings} />}
                {active.id === 'pedidos' && <CheckoutSection settings={settings} />}
                {active.id === 'caja' && <PosSection settings={settings} />}
                {active.id === 'inventario' && <InventorySection settings={settings} />}
                {active.id === 'integraciones' && <IntegrationsSection />}
                {active.id === 'cuenta' && <AccountSection />}
                {active.id === 'datos' && <DataSection />}
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

/* ---------- formulario con barra de guardar ---------- */
function useForm<T extends object>(initial: T) {
  const snapshot = JSON.stringify(initial);
  const base = useRef(snapshot);
  const [d, setD] = useState<T>(() => structuredClone(initial));
  useEffect(() => {
    // Cuando los ajustes se recargan (después de guardar) el formulario toma los nuevos valores
    if (snapshot !== base.current) {
      base.current = snapshot;
      setD(JSON.parse(snapshot) as T);
    }
  }, [snapshot]);
  const dirty = JSON.stringify(d) !== base.current;
  const set = (patch: Partial<T> | ((x: T) => Partial<T>)) =>
    setD((x) => ({ ...x, ...(typeof patch === 'function' ? patch(x) : patch) }));
  return { d, set, setD, dirty, reset: () => setD(JSON.parse(base.current) as T) };
}

function SaveBar({
  dirty,
  busy,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  busy: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  useUnsavedChanges(dirty);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && dirty) {
        e.preventDefault();
        saveRef.current();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [dirty]);
  if (!dirty) return null;
  return (
    <div className="savebar glass is-dirty" role="region" aria-label="Guardar cambios">
      <span className="savebar__text">Tienes cambios sin guardar</span>
      <Button variant="ghost" onClick={onDiscard}>
        Descartar
      </Button>
      <Button variant="primary" icon={Save} loading={busy} onClick={onSave}>
        Guardar
      </Button>
    </div>
  );
}

function useSaver(fn: () => Promise<void>): [() => void, boolean] {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toastError(err, 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };
  return [() => void run(), busy];
}

async function persist(patch: { public?: object; private?: object }, title = 'Cambios guardados', sub?: string) {
  await api.settings.save(patch);
  await loadSettings();
  invalidate('settings');
  toast({ title, sub });
}

/* ---------- Tienda y contacto ---------- */
function StoreSection({ settings }: { settings: SettingsData }) {
  const pub = settings.public;
  const prefix = pub.region?.phonePrefix || '502';
  const { d, set, dirty, reset } = useForm<{ store: StoreInfo; whatsapp: string }>({
    store: pub.store,
    whatsapp: pub.whatsapp || '',
  });
  const setStore = (p: Partial<StoreInfo>) => set((x) => ({ store: { ...x.store, ...p } }));
  const setSocial = (p: Partial<StoreInfo['social']>) =>
    set((x) => ({ store: { ...x.store, social: { ...x.store.social, ...p } } }));
  const wa = waNumber(d.whatsapp, prefix);
  const waOk = wa.length >= 10;

  const [save, busy] = useSaver(async () => {
    if (!String(d.store.name || '').trim()) throw new Error('Escribe el nombre de la tienda.');
    if (d.whatsapp && !waOk) throw new Error(`El número de WhatsApp está incompleto. Escríbelo con lada (+${prefix}).`);
    for (const [k, v] of Object.entries(d.store.social || {})) {
      if (v && !/^https:\/\//.test(v)) throw new Error(`El enlace de ${k} debe empezar con https://`);
    }
    await persist(
      { public: { store: { ...d.store, name: d.store.name.trim() }, whatsapp: wa } },
      'Datos de la tienda guardados',
      'Ya se ven en la tienda y en los tickets.',
    );
  });

  return (
    <div className="stack">
      <Card title="Tu tienda">
        <div className="stack">
          <TextField
            label="Nombre de la tienda"
            value={d.store.name}
            onValue={(v) => setStore({ name: v })}
            maxLength={40}
            hint="Aparece en los tickets, mensajes de WhatsApp y reportes."
          />
          <TextField
            label="Horario de atención"
            value={d.store.hours}
            onValue={(v) => setStore({ hours: v })}
            placeholder="Lunes a sábado · 10:00 a 19:00 h"
            maxLength={80}
          />
          <TextField
            label="Dirección"
            optional
            value={d.store.address}
            onValue={(v) => setStore({ address: v })}
            placeholder="Calle, número, zona y municipio"
            maxLength={160}
            hint="Se imprime en el ticket. Déjala vacía si vendes solo en línea."
          />
          <TextField
            label="Correo"
            optional
            type="email"
            value={d.store.email}
            onValue={(v) => setStore({ email: v })}
            placeholder="hola@tutienda.com"
            maxLength={120}
          />
        </div>
      </Card>

      <Card title="WhatsApp de ventas" sub="Aquí llegan los pedidos de la tienda en línea" icon={WhatsAppIcon}>
        <div className="stack">
          <Field
            label="Número con lada"
            hint={
              d.whatsapp
                ? waOk
                  ? `Así queda: ${fmtPhone(wa)}`
                  : `Incompleto: escribe la lada +${prefix} y el número.`
                : 'Sin número, los botones de WhatsApp de la tienda no saben a quién escribir. Agrégalo antes de publicar.'
            }
          >
            <div className="affix affix--pre">
              <span className="affix__pre" aria-hidden="true">
                +
              </span>
              <input
                className="input"
                inputMode="tel"
                value={d.whatsapp}
                placeholder={prefix === '502' ? '502 5555 1234' : prefix === '1' ? '1 713 555 1234' : '52 33 1234 5678'}
                onChange={(e) => set({ whatsapp: e.currentTarget.value.replace(/[^\d\s]/g, '') })}
              />
            </div>
          </Field>
          {waOk && (
            <a
              className="link-btn small"
              href={`https://wa.me/${wa}?text=${encodeURIComponent('Prueba desde el panel de Divani')}`}
              target="_blank"
              rel="noopener"
            >
              <ExternalLink aria-hidden="true" />
              Probar que abre el chat correcto
            </a>
          )}
        </div>
      </Card>

      <Card title="Redes sociales" sub="Deja vacío el campo de la red que no uses y desaparece de la tienda">
        <div className="stack">
          <SocialField
            icon={Instagram}
            label="Instagram"
            value={d.store.social?.instagram}
            onValue={(v) => setSocial({ instagram: v })}
            placeholder="https://www.instagram.com/tutienda"
          />
          <SocialField
            icon={Facebook}
            label="Facebook"
            value={d.store.social?.facebook}
            onValue={(v) => setSocial({ facebook: v })}
            placeholder="https://www.facebook.com/tutienda"
          />
          <SocialField
            icon={TikTok}
            label="TikTok"
            value={d.store.social?.tiktok}
            onValue={(v) => setSocial({ tiktok: v })}
            placeholder="https://www.tiktok.com/@tutienda"
          />
        </div>
      </Card>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onDiscard={reset} />
    </div>
  );
}

function SocialField({
  icon: Icon,
  label,
  value,
  onValue,
  placeholder,
}: {
  icon: ComponentType;
  label: string;
  value: string | undefined;
  onValue: (v: string) => void;
  placeholder: string;
}) {
  return (
    <Field label={label}>
      <div className="affix affix--pre">
        <span className="affix__pre" aria-hidden="true">
          <Icon />
        </span>
        <input
          className="input"
          type="url"
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => onValue(e.currentTarget.value.trim())}
          aria-label={label}
        />
      </div>
    </Field>
  );
}

/* ---------- Región y moneda ---------- */
const PRESET_LIST: { id: RegionId; code: string }[] = [
  { id: 'gt', code: 'GT' },
  { id: 'mx', code: 'MX' },
  { id: 'us', code: 'US' },
];

function deepReplace<T>(v: T, from: string, to: string): T {
  if (typeof v === 'string') return v.split(from).join(to) as T;
  if (Array.isArray(v)) return v.map((x) => deepReplace(x, from, to)) as T;
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepReplace(x, from, to)])) as T;
  }
  return v;
}

function RegionSection({ settings }: { settings: SettingsData }) {
  const cur = settings.public.region;
  const { d, set, dirty, reset } = useForm<{ region: RegionSettings; denominations: Denominations }>({
    region: cur,
    denominations: settings.private.cash.denominations,
  });
  const [fixTexts, setFixTexts] = useState(true);
  const [advanced, setAdvanced] = useState(false);
  const setRegion = (p: Partial<RegionSettings>) =>
    set((x) => ({ region: { ...x.region, ...p, preset: p.preset ?? 'custom' } }));
  const pick = (id: RegionId) =>
    set({ region: { preset: id, ...pickRegion(REGION_PRESETS[id]) }, denominations: REGION_PRESETS[id].denominations });

  let sample = '—';
  let valid = true;
  try {
    const f = new Intl.NumberFormat(d.region.locale, { style: 'currency', currency: d.region.currency });
    sample = `${f.format(1250)} · ${f.format(89.5)}`;
  } catch {
    valid = false;
  }
  const areaChanged = !!cur.shippingArea && !!d.region.shippingArea && cur.shippingArea !== d.region.shippingArea;

  const [save, busy] = useSaver(async () => {
    if (!valid) throw new Error('Revisa el código de moneda (GTQ, MXN, USD…) y el idioma (es-GT, es-MX…).');
    let changed = 0;
    let announcements = settings.public.announcements;
    if (areaChanged && fixTexts) {
      const from = cur.shippingArea;
      const to = d.region.shippingArea;
      announcements = deepReplace(announcements, from, to);
      const all = await api.content.all();
      for (const [key, value] of Object.entries(all.content || {})) {
        const next = deepReplace(value, from, to);
        if (JSON.stringify(next) !== JSON.stringify(value)) {
          await api.content.save(key as keyof typeof all.content, next);
          changed++;
        }
      }
      for (const f of all.faq || []) {
        const next = deepReplace({ question: f.question, answer: f.answer }, from, to);
        if (next.question !== f.question || next.answer !== f.answer) {
          await api.content.saveFaq({ ...f, ...next });
          changed++;
        }
      }
      if (JSON.stringify(announcements) !== JSON.stringify(settings.public.announcements)) changed++;
      invalidate('content');
    }
    await persist(
      {
        public: { region: d.region, announcements },
        private: { cash: { ...settings.private.cash, denominations: d.denominations } },
      },
      'Región guardada',
      changed
        ? `También actualizamos ${changed} texto${changed === 1 ? '' : 's'} de la tienda que decían «${cur.shippingArea}».`
        : 'Precios y teléfonos ya usan el nuevo formato.',
    );
  });

  return (
    <div className="stack">
      <Card title="País de la tienda" sub="Define la moneda, el formato de los precios y la lada de los teléfonos">
        <div className="region-grid" role="radiogroup" aria-label="País">
          {PRESET_LIST.map((p) => {
            const r = REGION_PRESETS[p.id];
            const on = d.region.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={cx('region-card', on && 'is-on')}
                onClick={() => pick(p.id)}
              >
                <span className="region-card__code">{p.code}</span>
                <span className="region-card__body">
                  <strong>{r.name}</strong>
                  <small>
                    {r.currency} · {r.currencyName} · +{r.phonePrefix}
                  </small>
                </span>
                {on && <Check className="region-card__check" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <p className="region-sample">
          Así se verán tus precios: <strong>{sample}</strong>
        </p>
        {d.region.currency !== cur.currency && (
          <p className="hint-inline">
            <Info aria-hidden="true" />
            Cambiar la moneda no convierte los precios: después revisa los precios de tus productos.
          </p>
        )}
      </Card>

      {areaChanged && (
        <div className="list card">
          <SwitchRow
            title={`Cambiar «${cur.shippingArea}» por «${d.region.shippingArea}» en la tienda`}
            sub="Actualiza los avisos, cintas y preguntas frecuentes que mencionan a dónde envías."
            checked={fixTexts}
            onChange={setFixTexts}
          />
        </div>
      )}

      <Card
        title="Detalles"
        actions={
          <Button size="sm" variant="ghost" onClick={() => setAdvanced(!advanced)}>
            {advanced ? 'Ocultar' : 'Editar'}
          </Button>
        }
      >
        {advanced ? (
          <div className="grid" style={{ '--cols': 2 }}>
            <TextField
              label="Moneda (código)"
              value={d.region.currency}
              onValue={(v) => setRegion({ currency: v.toUpperCase().slice(0, 3) })}
              hint="GTQ, MXN, USD…"
            />
            <TextField
              label="Idioma y país"
              value={d.region.locale}
              onValue={(v) => setRegion({ locale: v })}
              hint="es-GT, es-MX, es-US…"
            />
            <TextField
              label="Lada telefónica"
              value={d.region.phonePrefix}
              onValue={(v) => setRegion({ phonePrefix: v.replace(/\D/g, '').slice(0, 4) })}
            />
            <TextField
              label="A dónde envías"
              value={d.region.shippingArea}
              onValue={(v) => setRegion({ shippingArea: v })}
              hint="Se usa en «Envíos a …»"
            />
            <TextField
              label="Nombre del campo ciudad"
              value={d.region.cityLabel}
              onValue={(v) => setRegion({ cityLabel: v })}
            />
            <TextField
              label="Ejemplo del campo ciudad"
              value={d.region.cityPlaceholder}
              onValue={(v) => setRegion({ cityPlaceholder: v })}
            />
          </div>
        ) : (
          <dl className="kv">
            <dt>Moneda</dt>
            <dd>
              {d.region.currency} · {d.region.currencyName || '—'}
            </dd>
            <dt>Teléfonos</dt>
            <dd>+{d.region.phonePrefix}</dd>
            <dt>Envíos a</dt>
            <dd>{d.region.shippingArea}</dd>
            <dt>Campo ciudad</dt>
            <dd>
              {d.region.cityLabel} <span className="faint">({d.region.cityPlaceholder})</span>
            </dd>
          </dl>
        )}
      </Card>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onDiscard={reset} />
    </div>
  );
}

/* ---------- Pedidos en línea ---------- */
type MethodItem = { id?: string; label: string; requiresAddress?: boolean };

function MethodList({
  items,
  onChange,
  withAddress,
  addLabel,
  placeholder,
}: {
  items: MethodItem[];
  onChange: (items: MethodItem[]) => void;
  withAddress?: boolean;
  addLabel: string;
  placeholder: string;
}) {
  const update = (i: number, p: Partial<MethodItem>) => onChange(items.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <div className="stack" style={{ '--gap': '8px' }}>
      {items.map((m, i) => (
        <div key={i} className="method-row">
          <input
            className="input"
            value={m.label}
            placeholder={placeholder}
            aria-label="Nombre"
            onChange={(e) => update(i, { label: e.currentTarget.value })}
          />
          {withAddress && (
            <label className="method-row__switch">
              <Switch
                checked={m.requiresAddress}
                onChange={(v) => update(i, { requiresAddress: v })}
                label="Pide dirección"
              />
              <span className="small">Pide dirección</span>
            </label>
          )}
          <IconButton
            icon={Trash2}
            danger
            label="Quitar"
            disabled={items.length <= 1}
            onClick={() => onChange(items.filter((_, k) => k !== i))}
          />
        </div>
      ))}
      <button
        type="button"
        className="link-btn small"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => onChange([...items, withAddress ? { label: '', requiresAddress: false } : { label: '' }])}
      >
        <Plus aria-hidden="true" />
        {addLabel}
      </button>
    </div>
  );
}

function withIds<T extends MethodItem>(list: T[]): (T & { id: string })[] {
  const used = new Set<string>();
  return list.map((m) => {
    let id = m.id || slugify(m.label) || 'metodo';
    for (let n = 2; used.has(id); n++) id = `${slugify(m.label) || 'metodo'}-${n}`;
    used.add(id);
    return { ...m, id, label: m.label.trim() };
  });
}

type CheckoutForm = {
  checkout: Omit<CheckoutSettings, 'freeShippingFrom'> & { freeShippingFrom: MoneyValue | null };
  popularSearches: string[];
};

function CheckoutSection({ settings }: { settings: SettingsData }) {
  const pub = settings.public;
  const { d, set, dirty, reset } = useForm<CheckoutForm>({
    checkout: pub.checkout,
    popularSearches: pub.popularSearches || [],
  });
  const setCo = (p: Partial<CheckoutForm['checkout']>) => set((x) => ({ checkout: { ...x.checkout, ...p } }));

  const [save, busy] = useSaver(async () => {
    const del = d.checkout.deliveryMethods.filter((m) => m.label.trim());
    const pay = d.checkout.paymentMethods.filter((m) => m.label.trim());
    if (!del.length) throw new Error('Agrega al menos una forma de entrega.');
    if (!pay.length) throw new Error('Agrega al menos una forma de pago.');
    const free =
      d.checkout.freeShippingFrom === '' || d.checkout.freeShippingFrom == null
        ? null
        : Number(d.checkout.freeShippingFrom) || null;
    await persist(
      {
        public: {
          checkout: {
            ...d.checkout,
            deliveryMethods: withIds(del).map((m) => ({
              id: m.id,
              label: m.label,
              requiresAddress: !!m.requiresAddress,
            })),
            paymentMethods: withIds(pay).map((m) => ({ id: m.id, label: m.label })),
            freeShippingFrom: free,
            note: String(d.checkout.note || '').trim(),
          },
          popularSearches: d.popularSearches,
        },
      },
      'Pedidos en línea guardados',
      'La tienda ya muestra las nuevas opciones.',
    );
  });

  return (
    <div className="stack">
      <Card title="Formas de entrega" sub="Lo que elige la clienta al enviar su pedido">
        <MethodList
          items={d.checkout.deliveryMethods}
          withAddress
          onChange={(v) => setCo({ deliveryMethods: v as DeliveryMethod[] })}
          addLabel="Agregar forma de entrega"
          placeholder="Ej. Recoger en tienda"
        />
      </Card>
      <Card title="Formas de pago" sub="Se muestran en la tienda; el pago se confirma por WhatsApp">
        <MethodList
          items={d.checkout.paymentMethods}
          onChange={(v) => setCo({ paymentMethods: v as PaymentOption[] })}
          addLabel="Agregar forma de pago"
          placeholder="Ej. Tarjeta con terminal"
        />
      </Card>
      <Card title="Envío y mensaje">
        <div className="stack">
          <MoneyField
            label="Envío gratis a partir de"
            optional
            value={d.checkout.freeShippingFrom ?? ''}
            onValue={(v) => setCo({ freeShippingFrom: v })}
            placeholder="Sin envío gratis"
            hint="Se avisa en la bolsa: «Te faltan Q X para envío gratis»."
          />
          <TextField
            label="Nota al enviar el pedido"
            multiline
            rows={2}
            value={d.checkout.note}
            onValue={(v) => setCo({ note: v })}
            maxLength={240}
          />
        </div>
      </Card>
      <Card title="Búsquedas sugeridas" sub="Aparecen al abrir el buscador de la tienda">
        <TagInput
          value={d.popularSearches}
          onChange={(v) => set({ popularSearches: v.slice(0, 10) })}
          placeholder="Escribe y presiona Enter"
        />
      </Card>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onDiscard={reset} />
    </div>
  );
}

/* ---------- Punto de venta y caja ---------- */
type PosForm = {
  pos: PrivateSettings['pos'];
  cash: Omit<PrivateSettings['cash'], 'suggestedFloat'> & { suggestedFloat: MoneyValue };
};

function PosSection({ settings }: { settings: SettingsData }) {
  const priv = settings.private;
  const { d, set, dirty, reset } = useForm<PosForm>({ pos: priv.pos, cash: priv.cash });
  const setPos = (p: Partial<PosForm['pos']>) => set((x) => ({ pos: { ...x.pos, ...p } }));
  const setCash = (p: Partial<PosForm['cash']>) => set((x) => ({ cash: { ...x.cash, ...p } }));
  const methods = d.pos.paymentMethods || [];
  const toggle = (id: string) =>
    setPos({
      paymentMethods: methods.includes(id)
        ? methods.filter((m) => m !== id)
        : PAYMENT_METHODS.map((m) => m.id).filter((m) => m === id || methods.includes(m)),
    });
  const denoms = (arr: string[]) =>
    [...new Set(arr.map((x) => Number(String(x).replace(/[^\d.]/g, ''))).filter((n) => n > 0))].sort((a, b) => b - a);
  const presetId = settings.public.region?.preset;
  const preset = isRegionId(presetId) ? REGION_PRESETS[presetId] : null;

  const [save, busy] = useSaver(async () => {
    if (!methods.length) throw new Error('Elige al menos una forma de cobro.');
    await persist(
      {
        private: {
          pos: { ...d.pos, ticketFooter: String(d.pos.ticketFooter || '').trim() },
          cash: { ...d.cash, suggestedFloat: Number(d.cash.suggestedFloat) || 0 },
        },
      },
      'Punto de venta guardado',
    );
  });

  const testTicket = () => {
    const at = new Date().toISOString();
    printTicket(
      {
        number: 'PRUEBA',
        channel: 'tienda',
        createdAt: at,
        paidAt: at,
        createdByName: session.get().user?.name || 'Caja',
        items: [
          { name: 'Blusa de satín', qty: 1, unitPrice: 190, color: 'Champagne', size: 'M' },
          { name: 'Jeans wide leg', qty: 1, unitPrice: 250, color: 'Azul claro', size: '28' },
        ],
        subtotal: 440,
        discount: 0,
        shipping: 0,
        total: 440,
        itemsCount: 2,
        payments: [{ method: 'efectivo', amount: 440, received: 500, change: 60 }],
      },
      { public: settings.public, private: { ...priv, pos: d.pos } },
    );
  };

  return (
    <div className="stack">
      <Card title="Formas de cobro" sub="Las que aparecen al cobrar en el punto de venta">
        <div className="chips">
          {PAYMENT_METHODS.map((m) => (
            <Chip
              key={m.id}
              pressed={methods.includes(m.id)}
              onClick={() => toggle(m.id)}
              icon={methods.includes(m.id) ? Check : undefined}
            >
              {m.label}
            </Chip>
          ))}
        </div>
      </Card>
      <Card title="Caja">
        <div className="stack">
          <MoneyField
            label="Fondo de caja sugerido"
            value={d.cash.suggestedFloat ?? ''}
            onValue={(v) => setCash({ suggestedFloat: v })}
            hint="Se propone al abrir la caja (el cambio con el que empiezas el día)."
          />
          <Field label="Billetes" hint="Para contar el efectivo al hacer el corte.">
            <TagInput
              value={(d.cash.denominations?.bills || []).map(String)}
              onChange={(v) => setCash({ denominations: { ...d.cash.denominations, bills: denoms(v) } })}
              placeholder="Ej. 100"
            />
          </Field>
          <Field label="Monedas">
            <TagInput
              value={(d.cash.denominations?.coins || []).map(String)}
              onChange={(v) => setCash({ denominations: { ...d.cash.denominations, coins: denoms(v) } })}
              placeholder="Ej. 0.50"
            />
          </Field>
          {preset && JSON.stringify(preset.denominations) !== JSON.stringify(d.cash.denominations) && (
            <button
              type="button"
              className="link-btn small"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setCash({ denominations: preset.denominations })}
            >
              <RotateCcw aria-hidden="true" />
              Usar las de {preset.name}
            </button>
          )}
        </div>
      </Card>
      <Card
        title="Ticket"
        actions={
          <Button size="sm" icon={Printer} onClick={testTicket}>
            Imprimir prueba
          </Button>
        }
      >
        <div className="stack">
          <Field label="Ancho del papel">
            <Segmented<number>
              value={Number(d.pos.ticketWidth) === 58 ? 58 : 80}
              onChange={(v) => setPos({ ticketWidth: v })}
              label="Ancho del papel"
              options={[
                { value: 58, label: '58 mm' },
                { value: 80, label: '80 mm' },
              ]}
            />
          </Field>
          <TextField
            label="Mensaje al pie del ticket"
            multiline
            rows={2}
            value={d.pos.ticketFooter}
            onValue={(v) => setPos({ ticketFooter: v })}
            maxLength={200}
          />
        </div>
      </Card>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onDiscard={reset} />
    </div>
  );
}

/* ---------- Inventario ---------- */
function InventorySection({ settings }: { settings: SettingsData }) {
  const { d, set, dirty, reset } = useForm(settings.private.inventory);
  const prefix = String(d.skuPrefix || 'DV');
  const [save, busy] = useSaver(async () => {
    if (!/^[A-Z0-9]{1,6}$/.test(prefix))
      throw new Error('El prefijo del SKU lleva de 1 a 6 letras o números, sin espacios.');
    await persist({ private: { inventory: { ...d, skuPrefix: prefix } } }, 'Inventario guardado');
  });
  return (
    <div className="stack">
      <Card title="Códigos SKU">
        <div className="stack">
          <TextField
            label="Prefijo"
            value={d.skuPrefix}
            onValue={(v) =>
              set({
                skuPrefix: v
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 6),
              })
            }
            hint="Los productos nuevos se codifican así; los SKU que ya existen no cambian."
          />
          <div className="sku-sample">
            <span className="muted small">Ejemplo</span>
            <code className="mono">{prefix}-MUJ-001-NEG-M</code>
            <span className="small muted">{prefix} · departamento · número de modelo · color · talla</span>
          </div>
        </div>
      </Card>
      <Card title="Avisos de existencias">
        <div className="stack">
          <Field
            label="«Últimas piezas» cuando un producto tenga"
            hint="Se marca en el panel y en la tienda para animar la compra."
          >
            <div className="row">
              <Stepper
                value={Number(d.lastPieces) || 0}
                min={0}
                max={20}
                onChange={(v) => set({ lastPieces: v })}
                label="Piezas"
              />
              <span className="muted">piezas o menos</span>
            </div>
          </Field>
          <Field
            label="Avisar de una talla cuando le queden"
            hint="0 = solo te avisa cuando se agota. Cada talla también puede tener su propio mínimo."
          >
            <div className="row">
              <Stepper
                value={Number(d.lowStock) || 0}
                min={0}
                max={50}
                onChange={(v) => set({ lowStock: v })}
                label="Mínimo por talla"
              />
              <span className="muted">piezas o menos</span>
            </div>
          </Field>
        </div>
      </Card>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onDiscard={reset} />
    </div>
  );
}

/* ---------- Conexiones ---------- */
function IntegrationsSection() {
  const { data: status, loading, refetch } = useData(['integrations'], () => api.integrations.status(), ['settings']);
  const cl = status?.cloudinary;
  const [f, setF] = useState<{ cloudName: string; apiKey: string; apiSecret: string; folder: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    if (cl && !f)
      setF({ cloudName: cl.cloudName || '', apiKey: cl.apiKey || '', apiSecret: '', folder: cl.folder || 'divani' });
  }, [cl, f]);
  const host = (() => {
    try {
      return new URL(SUPABASE.url).host;
    } catch {
      return '';
    }
  })();
  const ready = !!(cl?.cloudName && cl.apiKey && cl.hasSecret);

  const save = async () => {
    if (!f) return;
    setBusy(true);
    try {
      if (!f.cloudName.trim() || !f.apiKey.trim()) throw new Error('Escribe el Cloud name y la API Key.');
      if (!cl?.hasSecret && !f.apiSecret.trim()) throw new Error('Pega el API Secret (solo se pide una vez).');
      await api.integrations.saveCloudinary({
        cloudName: f.cloudName.trim(),
        apiKey: f.apiKey.trim(),
        apiSecret: f.apiSecret.trim(),
        folder: f.folder.trim() || 'divani',
      });
      setF((x) => (x ? { ...x, apiSecret: '' } : x));
      await loadSettings();
      refetch();
      toast({ title: 'Cloudinary conectado', sub: 'Las fotos nuevas se subirán ahí.' });
    } catch (err) {
      toastError(err, 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const g = c.getContext('2d');
      if (g) {
        g.fillStyle = '#d9c6a6';
        g.fillRect(0, 0, 64, 64);
      }
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
      if (!blob) throw new Error('No se pudo preparar la foto de prueba.');
      const url = await api.media.upload(new File([blob], 'prueba-divani.png', { type: 'image/png' }), {
        kind: 'image',
        folder: `${cl?.folder || 'divani'}/pruebas`,
      });
      toast({ title: 'Conexión correcta', sub: url.replace(/^https:\/\//, '').slice(0, 60) });
    } catch (err) {
      toastError(err, 'La prueba falló');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="stack">
      <Card title="Base de datos · Supabase" icon={Database}>
        <div className="conn-row">
          <span className="conn-row__dot is-ok" aria-hidden="true">
            <CircleCheck />
          </span>
          <div className="grow">
            <strong>Conectado</strong>
            <p className="small muted">{host} · inicio de sesión, permisos (RLS) y respaldos de Supabase</p>
          </div>
          <Badge tone="green" dot>
            En línea
          </Badge>
        </div>
      </Card>

      <Card
        title="Fotos y videos · Cloudinary"
        icon={Cloud}
        actions={
          ready && (
            <Button size="sm" loading={testing} onClick={() => void test()}>
              Probar subida
            </Button>
          )
        }
      >
        {loading || !f ? (
          <Skeleton h={120} />
        ) : (
          <div className="stack">
            <div className="conn-row">
              <span className={cx('conn-row__dot', ready ? 'is-ok' : 'is-warn')} aria-hidden="true">
                {ready ? <CircleCheck /> : <CircleAlert />}
              </span>
              <div className="grow">
                <strong>{ready ? 'Listo para subir fotos' : 'Falta configurar'}</strong>
                <p className="small muted">
                  {ready
                    ? `Carpeta «${cl?.folder}» en la nube «${cl?.cloudName}».`
                    : 'Copia los datos de tu cuenta en Cloudinary → Settings → API Keys.'}
                </p>
              </div>
            </div>
            <div className="grid" style={{ '--cols': 2 }}>
              <TextField
                label="Cloud name"
                value={f.cloudName}
                onValue={(v) => setF({ ...f, cloudName: v.trim() })}
                autoComplete="off"
                spellCheck={false}
              />
              <TextField
                label="API Key"
                value={f.apiKey}
                onValue={(v) => setF({ ...f, apiKey: v.trim() })}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <Field
              label="API Secret"
              hint={
                cl?.hasSecret
                  ? 'Ya está guardado y protegido. Escribe uno nuevo solo si lo cambiaste en Cloudinary (debe ser de la misma API Key).'
                  : 'Se guarda cifrado en tu base de datos y nunca se vuelve a mostrar.'
              }
            >
              <PasswordInput
                value={f.apiSecret}
                onValue={(v) => setF({ ...f, apiSecret: v })}
                placeholder={cl?.hasSecret ? '•••••••••• (guardado)' : 'Pega aquí tu API Secret'}
                autoComplete="new-password"
              />
            </Field>
            <TextField
              label="Carpeta"
              value={f.folder}
              onValue={(v) => setF({ ...f, folder: v.replace(/[^\w/-]/g, '') })}
              hint="Todo se guarda dentro de esta carpeta (productos, banners, sitio…)."
            />
            <div className="row row--end">
              <Button variant="primary" icon={ShieldCheck} loading={busy} onClick={() => void save()}>
                Guardar conexión
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Mi cuenta ---------- */
function AccountSection() {
  const s = useStore(session);
  const user = s.user;
  const [pw, setPw] = useState({ a: '', b: '' });
  const [busy, setBusy] = useState(false);
  const strong = pw.a.length >= 8 && /[A-Za-z]/.test(pw.a) && /\d/.test(pw.a);
  const change = async () => {
    if (!strong) {
      toastError(new Error('Usa al menos 8 caracteres con letras y números.'), 'Contraseña muy débil');
      return;
    }
    if (pw.a !== pw.b) {
      toastError(new Error('Las dos contraseñas no coinciden.'), 'Revisa la contraseña');
      return;
    }
    setBusy(true);
    try {
      await api.auth.updatePassword(pw.a);
      setPw({ a: '', b: '' });
      toast({ title: 'Contraseña actualizada', sub: 'Úsala la próxima vez que entres.' });
    } catch (err) {
      toastError(err, 'No se pudo cambiar');
    } finally {
      setBusy(false);
    }
  };
  const out = async () => {
    if (
      await confirmDialog({
        title: '¿Cerrar sesión?',
        message: 'Tendrás que volver a escribir tu correo y contraseña.',
        confirm: 'Cerrar sesión',
      })
    ) {
      await signOut();
    }
  };
  return (
    <div className="stack">
      <Card>
        <div className="conn-row">
          <span className="avatar" style={{ '--s': '48px' }} aria-hidden="true">
            {(user?.name || 'A').slice(0, 1).toUpperCase()}
          </span>
          <div className="grow">
            <strong>{user?.name || 'Administración'}</strong>
            <p className="small muted">
              {user?.email} · {user?.role === 'admin' ? 'Administradora' : 'Equipo'}
            </p>
          </div>
          <Button icon={LogOut} onClick={() => void out()}>
            Cerrar sesión
          </Button>
        </div>
      </Card>
      <Card title="Cambiar contraseña" icon={KeyRound}>
        <div className="stack">
          <Field label="Nueva contraseña" hint="Mínimo 8 caracteres, con letras y números.">
            <PasswordInput value={pw.a} onValue={(v) => setPw({ ...pw, a: v })} autoComplete="new-password" />
          </Field>
          <Field label="Repítela">
            <PasswordInput value={pw.b} onValue={(v) => setPw({ ...pw, b: v })} autoComplete="new-password" />
          </Field>
          <div className="row row--end">
            <Button variant="primary" loading={busy} disabled={!pw.a || !pw.b} onClick={() => void change()}>
              Cambiar contraseña
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Respaldo y datos ---------- */
function DataSection() {
  const [busy, setBusy] = useState(false);
  const backup = async () => {
    setBusy(true);
    try {
      const data = await api.backup();
      download(`divani-respaldo-${fileStamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
      toast({ title: 'Respaldo descargado', sub: 'Guárdalo en un lugar seguro.' });
    } catch (err) {
      toastError(err, 'No se pudo descargar');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <Card title="Copia de seguridad" icon={Download}>
        <div className="stack" style={{ '--gap': '12px' }}>
          <p className="small muted">
            Descarga todo —productos, inventario, pedidos, cortes de caja y contenido del sitio— en un archivo. Supabase
            además guarda respaldos automáticos de tu base de datos.
          </p>
          <div>
            <Button icon={Download} loading={busy} onClick={() => void backup()}>
              Descargar respaldo
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
