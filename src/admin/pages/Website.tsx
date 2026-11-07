/**
 * Sitio web: fotos, textos y promociones de la tienda con vista previa en vivo.
 * Portada (cada sección con su editor), banners, «Arma tu look» y preguntas. Las categorías
 * tienen su propia sección (/categorias).
 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  Baby,
  BookHeart,
  ChevronRight,
  CircleHelp,
  Crown,
  ExternalLink,
  Eye,
  GalleryHorizontal,
  Heart,
  House,
  Image as ImageIcon,
  LayoutGrid,
  ListOrdered,
  Megaphone,
  MousePointerClick,
  Ribbon,
  Shirt,
  Sparkles,
  Store,
  User,
  type LucideIcon,
} from 'lucide-react';
import { plural } from '@/lib/format';
import { cdn } from '@/lib/model';
import type { Banner, Faq, Lookbook, Settings, SiteContent, Taxonomy } from '@/lib/types';
import { api } from '../api';
import { BannersTab } from '../components/site/BannersTab';
import { FaqTab } from '../components/site/FaqTab';
import {
  AboutEditor,
  AnnouncementsEditor,
  EditorialEditor,
  HOME_SECTIONS,
  KidsEditor,
  MenEditor,
  RibbonsEditor,
  VipEditor,
  type HomeSection,
} from '../components/site/HomeEditors';
import { LookTab } from '../components/site/LookTab';
import { SitePreview, scrollPreviewTo } from '../components/site/Preview';
import { useMedia } from '../lib/hooks';
import { navigate, useSearch } from '../lib/navigation';
import { useData } from '../lib/query';
import { settingsStore } from '../lib/session';
import { Button, LinkButton, Switch, cx } from '../ui/controls';
import { Sheet, toast, toastError } from '../ui/overlays';
import { Badge, Card, PageHeader, Tabs } from '../ui/surfaces';

type Tab = 'portada' | 'banners' | 'look' | 'preguntas';

const TABS = [
  { value: 'portada' as Tab, label: 'Secciones', icon: House },
  { value: 'banners' as Tab, label: 'Portada', icon: GalleryHorizontal },
  { value: 'look' as Tab, label: 'Arma tu look', icon: Shirt },
  { value: 'preguntas' as Tab, label: 'Preguntas', icon: CircleHelp },
];

const ICONS: Record<string, LucideIcon> = {
  announcements: Megaphone,
  ribbons: Ribbon,
  categories: LayoutGrid,
  novedades: Sparkles,
  favoritas: Heart,
  banners: GalleryHorizontal,
  look: Shirt,
  editorial: ImageIcon,
  kids: Baby,
  about: BookHeart,
  howto: ListOrdered,
  men: User,
  faq: CircleHelp,
  vip: Crown,
};

type ContentData = { content: SiteContent; banners: Banner[]; lookbooks: Lookbook[]; faq: Faq[] };

export default function Website() {
  const { query, setQuery } = useSearch();
  const tab: Tab = TABS.some((t) => t.value === query.tab) ? (query.tab as Tab) : 'portada';
  const settings = useStore(settingsStore);
  const { data, loading } = useData(['content'], () => api.content.all(), ['content']);
  const { data: tax } = useData(['taxonomy'], () => api.catalog.taxonomy(), ['taxonomy']);
  const { data: products } = useData(['products'], () => api.catalog.products(), ['products', 'inventory']);
  const [version, setVersion] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const wide = useMedia('(min-width: 1100px)');
  const bump = () => setVersion((v) => v + 1);
  const go = (t: Tab) => {
    if (t !== tab) setQuery({ tab: t === 'portada' ? '' : t });
  };
  // Las categorías ahora tienen su propia sección
  useEffect(() => {
    if (query.tab === 'categorias') navigate('/categorias', { replace: true });
  }, [query.tab]);

  return (
    <main className="page page--wide">
      <PageHeader
        title="Sitio web"
        sub="Cambia fotos, textos y promociones de tu tienda. Todo se publica al guardar."
        actions={
          <>
            {!wide && tab === 'portada' && (
              <Button icon={Eye} onClick={() => setPreviewOpen(true)}>
                Vista previa
              </Button>
            )}
            <LinkButton icon={ExternalLink} href="/" target="_blank" rel="noopener">
              Ver tienda
            </LinkButton>
          </>
        }
      />
      <div className="site-tabs">
        <Tabs<Tab> value={tab} onChange={go} items={TABS} label="Secciones del sitio" />
      </div>

      {tab === 'portada' && (
        <HomeTab
          data={data}
          tax={tax}
          settings={settings}
          version={version}
          onSaved={bump}
          onTab={go}
          wide={wide}
          previewOpen={previewOpen}
          setPreviewOpen={setPreviewOpen}
        />
      )}
      {tab === 'banners' && <BannersTab data={data} tax={tax} products={products} loading={loading} onSaved={bump} />}
      {tab === 'look' && <LookTab data={data} products={products} loading={loading || !products} onSaved={bump} />}
      {tab === 'preguntas' && <FaqTab data={data} loading={loading} onSaved={bump} />}
    </main>
  );
}

function HomeTab({
  data,
  tax,
  settings,
  version,
  onSaved,
  onTab,
  wide,
  previewOpen,
  setPreviewOpen,
}: {
  data: ContentData | undefined;
  tax: Taxonomy | undefined;
  settings: Settings | null;
  version: number;
  onSaved: () => void;
  onTab: (t: Tab) => void;
  wide: boolean;
  previewOpen: boolean;
  setPreviewOpen: (v: boolean) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const content = data?.content || {};

  const open = (id: string) => {
    if (id === 'products') {
      navigate('/productos');
      return;
    }
    if (id === 'categories') {
      navigate('/categorias');
      return;
    }
    if (id === 'store') {
      navigate('/ajustes?seccion=tienda');
      return;
    }
    const s = HOME_SECTIONS.find((x) => x.id === id);
    if (!s) return;
    setPreviewOpen(false);
    if (s.tab) onTab(s.tab);
    else setEditing(id);
  };
  const close = (saved: boolean) => {
    setEditing(null);
    if (saved) onSaved();
  };

  // Ocultar no borra nada: la sección sigue aquí y se puede volver a mostrar
  const hidden = settings?.public?.hiddenSections || [];
  const setVisible = async (s: HomeSection, visible: boolean) => {
    const before = settingsStore.get();
    if (!before) return;
    const hiddenSections = visible ? hidden.filter((id) => id !== s.id) : [...hidden, s.id];
    settingsStore.set({ ...before, public: { ...before.public, hiddenSections } });
    try {
      settingsStore.set(await api.settings.save({ public: { hiddenSections } }));
      onSaved();
      toast({
        title: visible ? `«${s.title}» ya se ve en la tienda` : `«${s.title}» quedó oculta`,
        sub: visible ? undefined : 'No se borró nada: vuelve a activarla cuando quieras.',
      });
    } catch (err) {
      settingsStore.set(before);
      toastError(err, 'No se pudo cambiar');
    }
  };

  const thumb = (s: HomeSection) => {
    if (s.id === 'banners') return data?.banners?.find((b) => b.active !== false)?.image;
    if (s.id === 'categories')
      return tax?.categories?.find((c) => c.department === 'mujer' && c.active !== false)?.image;
    if (s.id === 'look') return data?.lookbooks?.find((l) => l.active !== false)?.image;
    return s.thumb?.(content);
  };
  const meta = (s: HomeSection) => {
    if (s.id === 'announcements') return plural(settings?.public?.announcements?.length || 0, 'aviso', 'avisos');
    if (s.id === 'ribbons') {
      return plural(
        (content.ribbons?.primary?.length || 0) + (content.ribbons?.secondary?.length || 0),
        'frase',
        'frases',
      );
    }
    if (s.id === 'banners')
      return plural(data?.banners?.filter((b) => b.active !== false).length || 0, 'activo', 'activos');
    if (s.id === 'categories')
      return plural(tax?.categories?.filter((c) => c.department === 'mujer').length || 0, 'foto', 'fotos');
    if (s.id === 'look')
      return plural(data?.lookbooks?.find((l) => l.active !== false)?.hotspots?.length || 0, 'prenda', 'prendas');
    if (s.id === 'faq')
      return plural(data?.faq?.filter((f) => f.active !== false).length || 0, 'pregunta', 'preguntas');
    return null;
  };

  return (
    <div className="site-home">
      <div className="stack" style={{ '--gap': '14px' }}>
        <div className="hint-box">
          <MousePointerClick aria-hidden="true" />
          <p>
            Toca una sección para cambiar sus fotos y textos, o apaga su interruptor para ocultarla de la tienda.
            {wide ? ' También puedes tocarla directo en la vista previa.' : ''}
          </p>
        </div>
        <Card bodyClass={false}>
          <div className="list">
            {HOME_SECTIONS.map((s, i) => {
              const Icon = ICONS[s.id] || ImageIcon;
              const src = thumb(s);
              const m = meta(s);
              const oculta = hidden.includes(s.id);
              const destino = s.edit || s.id;
              return (
                <div key={s.id} className={cx('section-item', oculta && 'is-hidden')} style={{ '--inset': '92px' }}>
                  <button
                    type="button"
                    className="list__row section-row"
                    disabled={s.fixed}
                    onClick={() => open(destino)}
                    onMouseEnter={() => wide && scrollPreviewTo(frame.current, destino)}
                    onFocus={() => wide && scrollPreviewTo(frame.current, destino)}
                  >
                    <span className="section-row__thumb">
                      {src ? (
                        <img src={cdn(src, { w: 200 })} alt="" loading={i > 6 ? 'lazy' : undefined} />
                      ) : (
                        <Icon aria-hidden="true" />
                      )}
                    </span>
                    <span className="list__body">
                      <span className="list__title">
                        {s.title} {oculta && <Badge tone="amber">Oculta</Badge>}
                      </span>
                      <span className="list__sub section-row__sub">{s.sub}</span>
                    </span>
                    {m && <span className="list__end small muted section-row__meta">{m}</span>}
                    {!s.fixed && <ChevronRight className="list__chev" aria-hidden="true" />}
                  </button>
                  <span className="section-item__switch">
                    <Switch
                      checked={!oculta}
                      label={`Mostrar «${s.title}» en la tienda`}
                      onChange={(v) => void setVisible(s, v)}
                    />
                  </span>
                </div>
              );
            })}
            <button
              type="button"
              className="list__row section-row"
              style={{ '--inset': '92px' }}
              onClick={() => navigate('/ajustes?seccion=tienda')}
            >
              <span className="section-row__thumb">
                <Store aria-hidden="true" />
              </span>
              <span className="list__body">
                <span className="list__title">Pie de página y contacto</span>
                <span className="list__sub section-row__sub">WhatsApp, horario, dirección y redes sociales</span>
              </span>
              <ChevronRight className="list__chev" aria-hidden="true" />
            </button>
          </div>
        </Card>
      </div>

      {wide && <SitePreview className="site-preview" version={version} onEdit={open} frameRef={frame} />}

      {!wide && (
        <Sheet
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title="Vista previa"
          sub="Toca una sección para editarla"
          size="xl"
          className="sheet--preview"
        >
          <SitePreview bare version={version} onEdit={open} />
        </Sheet>
      )}

      <AnnouncementsEditor open={editing === 'announcements'} onClose={close} settings={settings} />
      <RibbonsEditor open={editing === 'ribbons'} onClose={close} content={content} />
      <EditorialEditor open={editing === 'editorial'} onClose={close} content={content} />
      <KidsEditor open={editing === 'kids'} onClose={close} content={content} />
      <AboutEditor open={editing === 'about'} onClose={close} content={content} />
      <MenEditor open={editing === 'men'} onClose={close} content={content} />
      <VipEditor open={editing === 'vip'} onClose={close} content={content} />
    </div>
  );
}
