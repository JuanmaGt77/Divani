/**
 * Sitio web: fotos, textos y promociones de la tienda con vista previa en vivo.
 * Portada (cada sección con su editor), banners, categorías, «Arma tu look» y preguntas.
 */
import { useRef, useState } from 'react';
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
  House,
  Image as ImageIcon,
  LayoutGrid,
  Megaphone,
  MousePointerClick,
  Ribbon,
  Shirt,
  Store,
  User,
  type LucideIcon,
} from 'lucide-react';
import { plural } from '@/lib/format';
import { cdn } from '@/lib/model';
import type { Banner, Faq, Lookbook, Settings, SiteContent, Taxonomy } from '@/lib/types';
import { api } from '../api';
import { BannersTab } from '../components/site/BannersTab';
import { CategoriesTab } from '../components/site/CategoriesTab';
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
import { Button, LinkButton } from '../ui/controls';
import { Sheet } from '../ui/overlays';
import { Card, PageHeader, Tabs } from '../ui/surfaces';

type Tab = 'portada' | 'banners' | 'categorias' | 'look' | 'preguntas';

const TABS = [
  { value: 'portada' as Tab, label: 'Secciones', icon: House },
  { value: 'banners' as Tab, label: 'Portada', icon: GalleryHorizontal },
  { value: 'categorias' as Tab, label: 'Categorías', icon: LayoutGrid },
  { value: 'look' as Tab, label: 'Arma tu look', icon: Shirt },
  { value: 'preguntas' as Tab, label: 'Preguntas', icon: CircleHelp },
];

const ICONS: Record<string, LucideIcon> = {
  announcements: Megaphone,
  ribbons: Ribbon,
  categories: LayoutGrid,
  banners: GalleryHorizontal,
  look: Shirt,
  editorial: ImageIcon,
  kids: Baby,
  about: BookHeart,
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
  const { data: tax, loading: taxLoading } = useData(['taxonomy'], () => api.catalog.taxonomy(), ['taxonomy']);
  const { data: products } = useData(['products'], () => api.catalog.products(), ['products', 'inventory']);
  const [version, setVersion] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const wide = useMedia('(min-width: 1100px)');
  const bump = () => setVersion((v) => v + 1);
  const go = (t: Tab) => {
    if (t !== tab) setQuery({ tab: t === 'portada' ? '' : t });
  };

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
      {tab === 'categorias' && <CategoriesTab tax={tax} products={products} loading={taxLoading} onSaved={bump} />}
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
            Toca una sección para cambiar sus fotos y textos.
            {wide ? ' También puedes tocarla directo en la vista previa.' : ''}
          </p>
        </div>
        <Card bodyClass={false}>
          <div className="list">
            {HOME_SECTIONS.map((s, i) => {
              const Icon = ICONS[s.id] || ImageIcon;
              const src = thumb(s);
              const m = meta(s);
              return (
                <button
                  key={s.id}
                  type="button"
                  className="list__row section-row"
                  style={{ '--inset': '92px' }}
                  onClick={() => open(s.id)}
                  onMouseEnter={() => wide && scrollPreviewTo(frame.current, s.id)}
                  onFocus={() => wide && scrollPreviewTo(frame.current, s.id)}
                >
                  <span className="section-row__thumb">
                    {src ? (
                      <img src={cdn(src, { w: 200 })} alt="" loading={i > 6 ? 'lazy' : undefined} />
                    ) : (
                      <Icon aria-hidden="true" />
                    )}
                  </span>
                  <span className="list__body">
                    <span className="list__title">{s.title}</span>
                    <span className="list__sub section-row__sub">{s.sub}</span>
                  </span>
                  {m && <span className="list__end small muted">{m}</span>}
                  <ChevronRight className="list__chev" aria-hidden="true" />
                </button>
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
