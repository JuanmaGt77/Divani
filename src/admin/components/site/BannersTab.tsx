/** Banners del carrusel de la portada: crear, ordenar, programar fechas y ocultar. */
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Copy,
  GalleryHorizontal,
  Image as ImageIcon,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { cdn } from '@/lib/model';
import type { Banner, Taxonomy } from '@/lib/types';
import { api } from '../../api';
import { invalidate } from '../../lib/query';
import { Button, Field, Switch, SwitchRow, TextField, cx } from '../../ui/controls';
import { MediaField } from '../../ui/media';
import { Sheet, confirmDialog, toast, toastError } from '../../ui/overlays';
import { Badge, Card, Empty, Menu, SkeletonRows } from '../../ui/surfaces';
import {
  EMPH,
  Emph,
  LinkField,
  MoveButtons,
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
  ctaLabel: 'Ver más',
  ctaHref: '/tienda',
  image: '',
  imageMobile: '',
  theme: 'light',
  active: true,
  startsAt: null,
  endsAt: null,
};

/** El banner como se ve en la tienda: foto con la tarjeta de vidrio a la izquierda. */
export function BannerVisual({ b, compact }: { b: Banner; compact?: boolean }) {
  return (
    <div className={cx('bvis', compact && 'bvis--compact')}>
      {b.image ? (
        <img src={cdn(b.image, { w: compact ? 640 : 1200 })} alt="" loading="lazy" />
      ) : (
        <span className="bvis__ph">
          <ImageIcon aria-hidden="true" />
        </span>
      )}
      <div className="bvis__card">
        {b.eyebrow && <span className="bvis__eyebrow">{b.eyebrow}</span>}
        <span className="bvis__title">
          <Emph text={b.title || 'Título del banner'} />
        </span>
        {!compact && b.text && <span className="bvis__text">{b.text}</span>}
        <span className="bvis__cta">
          {b.ctaLabel || 'Ver más'}
          <ArrowRight aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

export function BannersTab({
  data,
  tax,
  loading,
  onSaved,
}: {
  data: { banners: Banner[] } | undefined;
  tax: Taxonomy | undefined;
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
      toast({ title: active ? 'Banner visible en la tienda' : 'Banner oculto', sub: b.title.replace(/\*/g, '') });
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
              se ven en el carrusel de la portada.{' '}
            </>
          ) : null}
          El primero es el que aparece al entrar; arrastra o usa las flechas para cambiar el orden.
        </p>
        <Button variant="primary" icon={Plus} onClick={() => setEdit({ ...NEW_BANNER })}>
          Nuevo banner
        </Button>
      </div>

      <Card bodyClass={false}>
        {loading ? (
          <SkeletonRows rows={3} />
        ) : !list.length ? (
          <Empty
            icon={GalleryHorizontal}
            title="Aún no hay banners"
            action={
              <Button variant="primary" icon={Plus} onClick={() => setEdit({ ...NEW_BANNER })}>
                Crear el primero
              </Button>
            }
          >
            Úsalos para anunciar temporadas, rebajas o nuevos ingresos.
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
                    <BannerVisual b={b} compact />
                  </button>
                  <div className="banner-row__body">
                    {b.eyebrow && <span className="eyebrow">{b.eyebrow}</span>}
                    <button type="button" className="banner-row__title" onClick={() => setEdit(b)}>
                      <Emph text={b.title} />
                    </button>
                    <span className="small muted">
                      Botón «{b.ctaLabel || 'Ver más'}» → {linkLabel(b.ctaHref, tax)}
                    </span>
                    <span className="row" style={{ '--gap': '6px', marginTop: '4px' }}>
                      <Badge tone={st.tone} dot icon={st.id === 'programado' ? CalendarClock : undefined}>
                        {st.label}
                      </Badge>
                      {b.imageMobile && <Badge outline>Foto para celular</Badge>}
                    </span>
                  </div>
                  <div className="banner-row__end">
                    <MoveButtons i={i} n={list.length} onMove={(from, to) => void move(from, to)} label="banner" />
                    <Switch
                      checked={b.active !== false}
                      onChange={(v) => void toggle(b, v)}
                      label="Mostrar en la tienda"
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
  onClose,
}: {
  banner: Banner | null;
  tax: Taxonomy | undefined;
  onClose: (saved: boolean) => void;
}) {
  const [d, setD] = useState<Banner>(NEW_BANNER);
  const [schedule, setSchedule] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!banner) return;
    setD(structuredClone(banner));
    setSchedule(!!(banner.startsAt || banner.endsAt));
  }, [banner]);
  const set = (p: Partial<Banner>) => setD((x) => ({ ...x, ...p }));

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
        sub: d.active === false ? 'Quedó guardado sin publicar.' : 'Ya se ve en la tienda.',
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
      sub="Carrusel de promociones de la portada"
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
          <BannerVisual b={d} />
        </div>
        <div className="grid" style={{ '--cols': 2 }}>
          <MediaField
            label="Foto (computadora)"
            value={d.image}
            onChange={(v) => set({ image: v })}
            aspect="21 / 9"
            folder="divani/banners"
            hint="Horizontal, 2400 × 1000 px. Deja libre la izquierda: ahí va el texto."
          />
          <MediaField
            label="Foto para celular (opcional)"
            value={d.imageMobile}
            onChange={(v) => set({ imageMobile: v })}
            aspect="16 / 11"
            folder="divani/banners"
            hint="Si no la subes, se recorta la horizontal."
          />
        </div>
        <TextField
          label="Texto pequeño"
          value={d.eyebrow}
          onValue={(v) => set({ eyebrow: v })}
          placeholder="Rebajas de temporada"
          maxLength={60}
        />
        <TextField
          label="Título"
          value={d.title}
          onValue={(v) => set({ title: v })}
          placeholder="Hasta *30%* en piezas seleccionadas"
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
          maxLength={240}
        />
        <div className="grid" style={{ '--cols': 2 }}>
          <TextField
            label="Texto del botón"
            value={d.ctaLabel}
            onValue={(v) => set({ ctaLabel: v })}
            placeholder="Ver más"
            maxLength={40}
          />
          <div className="stack">
            <LinkField value={d.ctaHref} onValue={(v) => set({ ctaHref: v })} tax={tax} />
          </div>
        </div>
        <div className="list card card--flat">
          <SwitchRow
            title="Mostrar en la tienda"
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
    </Sheet>
  );
}
