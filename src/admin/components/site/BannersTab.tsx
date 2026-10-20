/**
 * Portada de la tienda: cada banner es una «vitrina» con su color, su foto y prendas con su precio.
 * Si hay varios, se van turnando. Crear, ordenar, programar fechas y ocultar.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, Copy, GalleryHorizontal, Pencil, Plus, Shirt, Trash2, X } from 'lucide-react';
import { money } from '@/lib/format';
import {
  BANNER_THEMES,
  SHOWCASE_SIZE,
  SHOWCASE_SOURCES,
  bannerTheme,
  cdn,
  normalizeShowcase,
  productStock,
} from '@/lib/model';
import type { Banner, BannerShowcase, Product, ShowcaseSource, Taxonomy } from '@/lib/types';
import { api } from '../../api';
import { invalidate } from '../../lib/query';
import { Button, Field, SelectField, Switch, SwitchRow, TextField, cx } from '../../ui/controls';
import { MediaField } from '../../ui/media';
import { Sheet, confirmDialog, toast, toastError } from '../../ui/overlays';
import { Badge, Card, Empty, Menu, SkeletonRows, Thumb } from '../../ui/surfaces';
import {
  EMPH,
  Emph,
  LinkField,
  MoveButtons,
  ProductPicker,
  fromLocalInput,
  linkLabel,
  scheduleState,
  toLocalInput,
  useOrdered,
} from './shared';

const NEW_BANNER: Banner = {
  placement: 'home-carousel',
  eyebrow: '',
  title: '',
  text: '',
  ctaLabel: 'Ver colección',
  ctaHref: '/tienda',
  image: '',
  imageMobile: '',
  theme: 'arena',
  showcase: { source: 'nuevo' },
  active: true,
  startsAt: null,
  endsAt: null,
};

const sourceLabel = (s: BannerShowcase | undefined) =>
  SHOWCASE_SOURCES.find((x) => x.id === normalizeShowcase(s).source)?.label || 'Novedades';

const discount = (p: Product) => (p.compareAtPrice && p.compareAtPrice > p.price ? 1 - p.price / p.compareAtPrice : 0);

/** Las prendas que mostraría la tienda (aproximado, para la vista previa del panel). */
function previewProducts(products: Product[] | undefined, showcase: BannerShowcase | undefined): Product[] {
  const s = normalizeShowcase(showcase);
  const live = (products || []).filter((p) => p.status === 'activo' && productStock(p) > 0);
  const newest = (a: Product, b: Product) => String(b.createdAt).localeCompare(String(a.createdAt));
  switch (s.source) {
    case 'ninguna':
      return [];
    case 'elegidas':
      return (s.products || []).map((slug) => live.find((p) => p.slug === slug)).filter((p): p is Product => !!p);
    case 'ofertas':
      return live
        .filter((p) => discount(p) > 0)
        .sort((a, b) => discount(b) - discount(a))
        .slice(0, SHOWCASE_SIZE);
    case 'populares':
      return [...live].sort((a, b) => +b.isBestseller - +a.isBestseller || newest(a, b)).slice(0, SHOWCASE_SIZE);
    case 'categoria':
      return live
        .filter((p) => p.category === s.category)
        .sort((a, b) => +b.isFeatured - +a.isFeatured || newest(a, b))
        .slice(0, SHOWCASE_SIZE);
    default:
      return [...live].sort(newest).slice(0, SHOWCASE_SIZE);
  }
}

const photoOf = (p: Product) => p.colors.find((c) => c.images.length)?.images[0] || '';

/** El banner como se ve en la tienda: color, foto y la repisa de prendas en arcos. */
export function BannerVisual({ b, compact, products }: { b: Banner; compact?: boolean; products?: Product[] }) {
  const shelf = normalizeShowcase(b.showcase).source !== 'ninguna';
  const items = previewProducts(products, b.showcase);
  return (
    <div
      className={cx('bvis', compact && 'bvis--compact', b.image && 'bvis--photo', shelf && 'bvis--shelf')}
      data-theme={bannerTheme(b.theme)}
    >
      {b.image ? (
        <img className="bvis__img" src={cdn(b.image, { w: compact ? 640 : 1200 })} alt="" loading="lazy" />
      ) : null}
      <div className="bvis__copy">
        {b.eyebrow ? <span className="bvis__eyebrow">{b.eyebrow}</span> : null}
        <span className="bvis__title">
          <Emph text={b.title || 'Título de la portada'} />
        </span>
        {!compact && b.text ? <span className="bvis__text">{b.text}</span> : null}
        <span className="bvis__cta">
          {b.ctaLabel || 'Ver más'}
          <ArrowRight aria-hidden="true" />
        </span>
      </div>
      {shelf ? (
        <span className="bvis__shelf">
          {Array.from({ length: SHOWCASE_SIZE }, (_, i) => {
            const p = items[i];
            return (
              <span key={i} className="bvis__item">
                <span className="bvis__arch">
                  {p ? <img src={cdn(photoOf(p), { w: 200 })} alt="" loading="lazy" /> : null}
                </span>
                {p && !compact ? <span className="bvis__price">{money(p.price)}</span> : null}
              </span>
            );
          })}
        </span>
      ) : null}
    </div>
  );
}

export function BannersTab({
  data,
  tax,
  products,
  loading,
  onSaved,
}: {
  data: { banners: Banner[] } | undefined;
  tax: Taxonomy | undefined;
  products: Product[] | undefined;
  loading: boolean;
  onSaved?: () => void;
}) {
  const [list, move] = useOrdered(
    data?.banners,
    (b) => b.id || '',
    (ids) => api.content.reorderBanners(ids),
  );
  const [edit, setEdit] = useState<Banner | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [now] = useState(() => Date.now());
  const live = list.filter((b) => scheduleState(b, now).id === 'publicado').length;

  const toggle = async (b: Banner, active: boolean) => {
    try {
      await api.content.saveBanner({ ...b, active });
      invalidate('content');
      onSaved?.();
      toast({ title: active ? 'Banner visible en la portada' : 'Banner oculto', sub: b.title.replace(/\*/g, '') });
    } catch (err) {
      toastError(err);
    }
  };
  const remove = async (b: Banner) => {
    if (!b.id) return;
    const ok = await confirmDialog({
      title: '¿Eliminar este banner?',
      message: 'Se quita de la portada. Si solo quieres pausarlo, mejor apágalo.',
      confirm: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.content.deleteBanner(b.id);
      invalidate('content');
      onSaved?.();
      toast({ title: 'Banner eliminado' });
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <>
      <div className="tab-intro">
        <p className="muted">
          {list.length ? (
            <>
              <strong className="strong" style={{ color: 'var(--text)' }}>
                {live} de {list.length}
              </strong>{' '}
              se ven en la portada.{' '}
            </>
          ) : null}
          Cada banner es una pantalla de la portada con su color, su foto y prendas con su precio. El primero es el que
          aparece al entrar; arrastra o usa las flechas para cambiar el orden.
        </p>
        <Button variant="primary" icon={Plus} onClick={() => setEdit(structuredClone(NEW_BANNER))}>
          Nuevo banner
        </Button>
      </div>

      <Card bodyClass={false}>
        {loading ? (
          <SkeletonRows rows={3} />
        ) : !list.length ? (
          <Empty
            icon={GalleryHorizontal}
            title="La portada usa la vitrina de novedades"
            action={
              <Button variant="primary" icon={Plus} onClick={() => setEdit(structuredClone(NEW_BANNER))}>
                Crear el primer banner
              </Button>
            }
          >
            Crea banners para anunciar temporadas, rebajas o nuevos ingresos con las prendas que quieras mostrar.
          </Empty>
        ) : (
          <div className="list">
            {list.map((b, i) => {
              const st = scheduleState(b, now);
              return (
                <div
                  key={b.id}
                  className={cx('banner-row', st.id !== 'publicado' && 'is-off', dragFrom === i && 'is-dragging')}
                  draggable
                  onDragStart={(e) => {
                    setDragFrom(i);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(i));
                  }}
                  onDragEnd={() => setDragFrom(null)}
                  onDragOver={(e) => {
                    if (dragFrom !== null) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (dragFrom !== null) {
                      e.preventDefault();
                      void move(dragFrom, i);
                      setDragFrom(null);
                    }
                  }}
                >
                  <span className="banner-row__pos" aria-label={`Posición ${i + 1}`}>
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    className="banner-row__visual"
                    onClick={() => setEdit(b)}
                    aria-label={`Editar banner: ${b.title.replace(/\*/g, '')}`}
                  >
                    <BannerVisual b={b} compact products={products} />
                  </button>
                  <div className="banner-row__body">
                    {b.eyebrow && <span className="eyebrow">{b.eyebrow}</span>}
                    <button type="button" className="banner-row__title" onClick={() => setEdit(b)}>
                      <Emph text={b.title} />
                    </button>
                    <span className="small muted">
                      Botón «{b.ctaLabel || 'Ver más'}» → {linkLabel(b.ctaHref, tax)}
                    </span>
                    <span className="row" style={{ '--gap': '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <Badge tone={st.tone} dot icon={st.id === 'programado' ? CalendarClock : undefined}>
                        {st.label}
                      </Badge>
                      <Badge outline icon={Shirt}>
                        {sourceLabel(b.showcase)}
                      </Badge>
                    </span>
                  </div>
                  <div className="banner-row__end">
                    <MoveButtons i={i} n={list.length} onMove={(from, to) => void move(from, to)} label="banner" />
                    <Switch
                      checked={b.active !== false}
                      onChange={(v) => void toggle(b, v)}
                      label="Mostrar en la portada"
                    />
                    <Menu
                      items={[
                        { label: 'Editar', icon: Pencil, onClick: () => setEdit(b) },
                        {
                          label: 'Duplicar',
                          icon: Copy,
                          onClick: () => {
                            const copy = structuredClone(b);
                            delete copy.id;
                            setEdit({ ...copy, active: false });
                          },
                        },
                        '-',
                        { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => void remove(b) },
                      ]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <BannerSheet
        banner={edit}
        tax={tax}
        products={products}
        onClose={(saved) => {
          setEdit(null);
          if (saved) onSaved?.();
        }}
      />
    </>
  );
}

function BannerSheet({
  banner,
  tax,
  products,
  onClose,
}: {
  banner: Banner | null;
  tax: Taxonomy | undefined;
  products: Product[] | undefined;
  onClose: (saved: boolean) => void;
}) {
  const [d, setD] = useState<Banner>(NEW_BANNER);
  const [schedule, setSchedule] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    if (!banner) return;
    setD({
      ...structuredClone(banner),
      theme: bannerTheme(banner.theme),
      showcase: normalizeShowcase(banner.showcase),
    });
    setSchedule(!!(banner.startsAt || banner.endsAt));
  }, [banner]);
  const set = (p: Partial<Banner>) => setD((x) => ({ ...x, ...p }));
  const showcase = normalizeShowcase(d.showcase);
  const setShowcase = (p: Partial<BannerShowcase>) => set({ showcase: { ...showcase, ...p } });
  const chosen = useMemo(
    () =>
      (showcase.products || []).map((slug) => products?.find((p) => p.slug === slug)).filter((p): p is Product => !!p),
    [showcase.products, products],
  );
  const categories = (tax?.categories || [])
    .filter((c) => c.active !== false)
    .map((c) => ({
      value: c.slug,
      label: `${c.name} · ${tax?.departments.find((x) => x.slug === c.department)?.name || c.department}`,
    }));

  const save = async () => {
    if (schedule && d.startsAt && d.endsAt && new Date(d.endsAt) <= new Date(d.startsAt)) {
      toastError(new Error('La fecha final debe ser después de la inicial.'), 'Revisa las fechas');
      return;
    }
    setBusy(true);
    try {
      await api.content.saveBanner({
        ...d,
        startsAt: schedule ? d.startsAt : null,
        endsAt: schedule ? d.endsAt : null,
      });
      invalidate('content');
      toast({
        title: d.id ? 'Banner actualizado' : 'Banner creado',
        sub: d.active === false ? 'Quedó guardado sin publicar.' : 'Ya se ve en la portada.',
      });
      onClose(true);
    } catch (err) {
      toastError(err, 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={!!banner}
      onClose={() => onClose(false)}
      title={d.id ? 'Editar banner' : 'Nuevo banner'}
      sub="Portada de la tienda"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onClose(false)}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            {d.id ? 'Guardar cambios' : 'Crear banner'}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="bvis-live" aria-hidden="true">
          <BannerVisual b={d} products={products} />
        </div>

        <Field label="Color de fondo">
          <div className="theme-picker" role="radiogroup" aria-label="Color de fondo">
            {BANNER_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={d.theme === t.id}
                className="theme-picker__opt"
                onClick={() => set({ theme: t.id })}
              >
                <span className="theme-picker__swatch" style={{ '--c': t.swatch }} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </Field>

        <TextField
          label="Texto pequeño"
          value={d.eyebrow}
          onValue={(v) => set({ eyebrow: v })}
          placeholder="Nueva temporada"
          maxLength={60}
        />
        <TextField
          label="Título"
          value={d.title}
          onValue={(v) => set({ title: v })}
          placeholder="Capas que se sienten *tan bien* como se ven"
          hint={EMPH}
          maxLength={120}
        />
        <TextField
          label="Descripción"
          optional
          multiline
          rows={2}
          value={d.text}
          onValue={(v) => set({ text: v })}
          hint="Se ve en computadora; en el celular se oculta para dar espacio a las prendas."
          maxLength={240}
        />
        <div className="grid" style={{ '--cols': 2, '--cols-m': 1 }}>
          <TextField
            label="Texto del botón"
            value={d.ctaLabel}
            onValue={(v) => set({ ctaLabel: v })}
            placeholder="Ver colección"
            maxLength={40}
          />
          <div className="stack">
            <LinkField value={d.ctaHref} onValue={(v) => set({ ctaHref: v })} tax={tax} />
          </div>
        </div>

        <Field label="Prendas que se muestran" hint="Solo aparecen prendas publicadas y con existencias.">
          <div className="source-picker" role="radiogroup" aria-label="Prendas que se muestran">
            {SHOWCASE_SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={showcase.source === s.id}
                className="source-picker__opt"
                onClick={() => set({ showcase: { source: s.id as ShowcaseSource } })}
              >
                <strong>{s.label}</strong>
                <small>{s.hint}</small>
              </button>
            ))}
          </div>
        </Field>
        {showcase.source === 'categoria' && (
          <SelectField
            label="Categoría"
            value={showcase.category || ''}
            onValue={(v) => setShowcase({ category: v })}
            options={categories}
            placeholder="Elige una categoría"
          />
        )}
        {showcase.source === 'elegidas' && (
          <div className="stack" style={{ '--gap': '10px' }}>
            {chosen.length ? (
              <div className="pick-list">
                {chosen.map((p) => (
                  <div key={p.slug} className="pick-row">
                    <Thumb src={photoOf(p)} size={40} />
                    <span className="grow">
                      <strong>{p.name}</strong>
                      <small>{productStock(p) > 0 ? 'Con existencias' : 'Agotada: no se mostrará'}</small>
                    </span>
                    <span className="num strong">{money(p.price)}</span>
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      onClick={() => setShowcase({ products: (showcase.products || []).filter((x) => x !== p.slug) })}
                      aria-label={`Quitar ${p.name}`}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <Button
              icon={Plus}
              onClick={() => setPicking(true)}
              disabled={(showcase.products || []).length >= SHOWCASE_SIZE}
            >
              {(showcase.products || []).length >= SHOWCASE_SIZE
                ? `Ya elegiste ${SHOWCASE_SIZE} prendas`
                : 'Agregar prenda'}
            </Button>
          </div>
        )}

        <div className="grid" style={{ '--cols': 2, '--cols-m': 1 }}>
          <MediaField
            label="Foto (computadora)"
            value={d.image}
            onChange={(v) => set({ image: v })}
            aspect="16 / 9"
            folder="divani/banners"
            hint={
              showcase.source === 'ninguna'
                ? 'Necesaria si no muestras prendas. Horizontal, 1600 × 900 px o más.'
                : 'Opcional. Horizontal; deja la ropa del lado derecho: la izquierda se funde con el color.'
            }
          />
          <MediaField
            label="Foto para celular (opcional)"
            value={d.imageMobile}
            onChange={(v) => set({ imageMobile: v })}
            aspect="16 / 9"
            folder="divani/banners"
            hint="Se ve arriba del título. Si no la subes, se recorta la de computadora."
          />
        </div>

        <div className="list card card--flat">
          <SwitchRow
            title="Mostrar en la portada"
            sub="Apágalo para guardarlo sin publicar"
            checked={d.active !== false}
            onChange={(v) => set({ active: v })}
          />
          <SwitchRow
            title="Programar fechas"
            sub="Aparece y se quita solo, ideal para promociones"
            checked={schedule}
            onChange={setSchedule}
          />
        </div>
        {schedule && (
          <div className="grid" style={{ '--cols': 2, '--cols-m': 1 }}>
            <Field label="Desde" hint="Vacío: desde ahora">
              <input
                type="datetime-local"
                className="input"
                value={toLocalInput(d.startsAt)}
                onChange={(e) => set({ startsAt: fromLocalInput(e.currentTarget.value) })}
              />
            </Field>
            <Field label="Hasta" hint="Vacío: sin fecha de fin">
              <input
                type="datetime-local"
                className="input"
                value={toLocalInput(d.endsAt)}
                onChange={(e) => set({ endsAt: fromLocalInput(e.currentTarget.value) })}
              />
            </Field>
          </div>
        )}
      </div>
      <ProductPicker
        open={picking}
        products={products}
        exclude={showcase.products}
        onPick={(p) => {
          setShowcase({ products: [...(showcase.products || []), p.slug].slice(0, SHOWCASE_SIZE) });
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </Sheet>
  );
}
