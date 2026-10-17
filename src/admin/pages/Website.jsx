/**
 * Sitio web: fotos, textos y promociones de la tienda con vista previa en vivo.
 * Portada (cada sección con su editor), banners, categorías, «Arma tu look» y preguntas.
 */
import { useRef, useState } from 'preact/hooks';
import {
  ExternalLink, Eye, House, GalleryHorizontal, LayoutGrid, Shirt, CircleHelp, ChevronRight, MousePointerClick,
  Megaphone, Clapperboard, Ribbon, Image as ImageIcon, Baby, BookHeart, User, Crown, Store,
} from 'lucide-preact';
import { api } from '../api/index.js';
import { useQuery } from '../lib/query.js';
import { setQuery, canLeave, navigate } from '../lib/router.js';
import { useStore } from '../lib/store.js';
import { settingsStore } from '../lib/session.js';
import { useMedia } from '../lib/hooks.js';
import { plural } from '../lib/format.js';
import { cdn } from '../../backend/model.js';
import { PageHeader, Card, Tabs } from '../ui/surfaces.jsx';
import { Button, LinkButton } from '../ui/controls.jsx';
import { Sheet } from '../ui/overlays.jsx';
import { SitePreview, scrollPreviewTo } from '../components/site/Preview.jsx';
import {
  HOME_SECTIONS, HeroEditor, RibbonsEditor, AnnouncementsEditor, EditorialEditor, KidsEditor, AboutEditor, MenEditor, VipEditor,
} from '../components/site/HomeEditors.jsx';
import { BannersTab } from '../components/site/BannersTab.jsx';
import { CategoriesTab } from '../components/site/CategoriesTab.jsx';
import { LookTab } from '../components/site/LookTab.jsx';
import { FaqTab } from '../components/site/FaqTab.jsx';

const TABS = [
  { value: 'portada', label: 'Portada', icon: House },
  { value: 'banners', label: 'Banners', icon: GalleryHorizontal },
  { value: 'categorias', label: 'Categorías', icon: LayoutGrid },
  { value: 'look', label: 'Arma tu look', icon: Shirt },
  { value: 'preguntas', label: 'Preguntas', icon: CircleHelp },
];

const ICONS = {
  announcements: Megaphone, hero: Clapperboard, ribbons: Ribbon, categories: LayoutGrid, banners: GalleryHorizontal, look: Shirt,
  editorial: ImageIcon, kids: Baby, about: BookHeart, men: User, faq: CircleHelp, vip: Crown,
};

export default function Website({ query }) {
  const tab = TABS.some((t) => t.value === query.tab) ? query.tab : 'portada';
  const settings = useStore(settingsStore);
  const { data, loading } = useQuery('content', () => api.content.all(), ['content']);
  const { data: tax, loading: taxLoading } = useQuery('taxonomy', () => api.catalog.taxonomy(), ['taxonomy']);
  const { data: products } = useQuery('products', () => api.catalog.products(), ['products', 'inventory']);
  const [version, setVersion] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const wide = useMedia('(min-width: 1100px)');
  const bump = () => setVersion((v) => v + 1);
  const go = (t) => { if (t !== tab && canLeave()) setQuery({ tab: t === 'portada' ? '' : t }); };

  return (
    <main class="page page--wide">
      <PageHeader
        title="Sitio web"
        sub="Cambia fotos, textos y promociones de tu tienda. Todo se publica al guardar."
        actions={(
          <>
            {!wide && tab === 'portada' && <Button icon={Eye} onClick={() => setPreviewOpen(true)}>Vista previa</Button>}
            <LinkButton icon={ExternalLink} href="index.html" target="_blank" rel="noopener">Ver tienda</LinkButton>
          </>
        )}
      />
      <div class="site-tabs"><Tabs value={tab} onChange={go} items={TABS} label="Secciones del sitio" /></div>

      {tab === 'portada' && (
        <HomeTab data={data} tax={tax} settings={settings} version={version} onSaved={bump} onTab={go} wide={wide} previewOpen={previewOpen} setPreviewOpen={setPreviewOpen} />
      )}
      {tab === 'banners' && <BannersTab data={data} tax={tax} loading={loading} onSaved={bump} />}
      {tab === 'categorias' && <CategoriesTab tax={tax} products={products} loading={taxLoading} onSaved={bump} />}
      {tab === 'look' && <LookTab data={data} products={products} loading={loading || !products} onSaved={bump} />}
      {tab === 'preguntas' && <FaqTab data={data} loading={loading} onSaved={bump} />}
    </main>
  );
}

function HomeTab({ data, tax, settings, version, onSaved, onTab, wide, previewOpen, setPreviewOpen }) {
  const [editing, setEditing] = useState(null);
  const frame = useRef(null);
  const content = data?.content || {};

  const open = (id) => {
    if (id === 'products') { navigate('/productos'); return; }
    if (id === 'store') { navigate('/ajustes?seccion=tienda'); return; }
    const s = HOME_SECTIONS.find((x) => x.id === id);
    if (!s) return;
    setPreviewOpen(false);
    if (s.tab) onTab(s.tab);
    else setEditing(id);
  };
  const close = (saved) => {
    setEditing(null);
    if (saved) onSaved();
  };

  const thumb = (s) => {
    if (s.id === 'banners') return data?.banners?.find((b) => b.active !== false)?.image;
    if (s.id === 'categories') return tax?.categories?.find((c) => c.department === 'mujer' && c.active !== false)?.image;
    if (s.id === 'look') return data?.lookbooks?.find((l) => l.active !== false)?.image;
    return s.thumb?.(content);
  };
  const meta = (s) => {
    if (s.id === 'announcements') return plural(settings?.public?.announcements?.length || 0, 'aviso', 'avisos');
    if (s.id === 'ribbons') return plural((content.ribbons?.primary?.length || 0) + (content.ribbons?.secondary?.length || 0), 'frase', 'frases');
    if (s.id === 'banners') return plural(data?.banners?.filter((b) => b.active !== false).length || 0, 'activo', 'activos');
    if (s.id === 'categories') return plural(tax?.categories?.filter((c) => c.department === 'mujer').length || 0, 'foto', 'fotos');
    if (s.id === 'look') return plural(data?.lookbooks?.find((l) => l.active !== false)?.hotspots?.length || 0, 'prenda', 'prendas');
    if (s.id === 'faq') return plural(data?.faq?.filter((f) => f.active !== false).length || 0, 'pregunta', 'preguntas');
    return null;
  };

  return (
    <div class="site-home">
      <div class="stack" style={{ '--gap': '14px' }}>
        <div class="hint-box">
          <MousePointerClick aria-hidden="true" />
          <p>Toca una sección para cambiar sus fotos y textos.{wide ? ' También puedes tocarla directo en la vista previa.' : ''}</p>
        </div>
        <Card bodyClass={false}>
          <div class="list">
            {HOME_SECTIONS.map((s, i) => {
              const Icon = ICONS[s.id] || ImageIcon;
              const src = thumb(s);
              return (
                <button
                  type="button"
                  class="list__row section-row"
                  style={{ '--inset': '92px' }}
                  onClick={() => open(s.id)}
                  onMouseEnter={() => wide && scrollPreviewTo(frame.current, s.id)}
                  onFocus={() => wide && scrollPreviewTo(frame.current, s.id)}
                >
                  <span class="section-row__thumb">
                    {src ? <img src={cdn(src, { w: 200 })} alt="" loading={i > 6 ? 'lazy' : undefined} /> : <Icon aria-hidden="true" />}
                  </span>
                  <span class="list__body">
                    <span class="list__title">{s.title}</span>
                    <span class="list__sub section-row__sub">{s.sub}</span>
                  </span>
                  {meta(s) && <span class="list__end small muted">{meta(s)}</span>}
                  <ChevronRight class="list__chev" aria-hidden="true" />
                </button>
              );
            })}
            <button type="button" class="list__row section-row" style={{ '--inset': '92px' }} onClick={() => navigate('/ajustes?seccion=tienda')}>
              <span class="section-row__thumb"><Store aria-hidden="true" /></span>
              <span class="list__body">
                <span class="list__title">Pie de página y contacto</span>
                <span class="list__sub section-row__sub">WhatsApp, horario, dirección y redes sociales</span>
              </span>
              <ChevronRight class="list__chev" aria-hidden="true" />
            </button>
          </div>
        </Card>
      </div>

      {wide && <SitePreview class="site-preview" version={version} onEdit={open} frameRef={frame} />}

      {!wide && (
        <Sheet open={previewOpen} onClose={() => setPreviewOpen(false)} title="Vista previa" sub="Toca una sección para editarla" size="xl" class="sheet--preview">
          <SitePreview bare version={version} onEdit={open} />
        </Sheet>
      )}

      <AnnouncementsEditor open={editing === 'announcements'} onClose={close} settings={settings} />
      <HeroEditor open={editing === 'hero'} onClose={close} content={content} />
      <RibbonsEditor open={editing === 'ribbons'} onClose={close} content={content} />
      <EditorialEditor open={editing === 'editorial'} onClose={close} content={content} />
      <KidsEditor open={editing === 'kids'} onClose={close} content={content} />
      <AboutEditor open={editing === 'about'} onClose={close} content={content} />
      <MenEditor open={editing === 'men'} onClose={close} content={content} />
      <VipEditor open={editing === 'vip'} onClose={close} content={content} />
    </div>
  );
}
