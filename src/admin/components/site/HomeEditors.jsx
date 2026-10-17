/**
 * Editores de cada sección de la portada (fotos, video y textos). Cada uno guarda su llave
 * en el contenido del sitio (site_content) y la tienda lo aplica al cargar.
 */
import { useEffect, useState } from 'preact/hooks';
import { Info } from 'lucide-preact';
import { api } from '../../api/index.js';
import { invalidate } from '../../lib/query.js';
import { loadSettings } from '../../lib/session.js';
import { Button, TextField, Field } from '../../ui/controls.jsx';
import { Sheet, toast, toastError } from '../../ui/overlays.jsx';
import { MediaField } from '../../ui/media.jsx';
import { EMPH } from './shared.jsx';


export const HOME_SECTIONS = [
  { id: 'announcements', title: 'Cinta de avisos', sub: 'Los mensajes que corren arriba del menú' },
  { id: 'hero', title: 'Portada con video', sub: 'Video de marca, foto de respaldo y textos de bienvenida', thumb: (c) => c.hero?.poster },
  { id: 'ribbons', title: 'Cintas cruzadas', sub: 'Frases que se deslizan debajo de la portada' },
  { id: 'categories', title: 'Compra por categoría', sub: 'Fotos y nombres de las categorías', tab: 'categorias' },
  { id: 'banners', title: 'Banners de promociones', sub: 'Carrusel de ofertas y temporadas', tab: 'banners' },
  { id: 'look', title: 'Arma tu look', sub: 'Foto con puntos que llevan a cada prenda', tab: 'look' },
  { id: 'editorial', title: 'Banda editorial', sub: 'Foto panorámica con frase de marca', thumb: (c) => c.editorial?.image },
  { id: 'kids', title: 'Niñas y niños', sub: 'Textos y las dos fotos de la sección infantil', thumb: (c) => c.kids?.girlsImage },
  { id: 'about', title: 'Acerca de nosotros', sub: 'Historia de la marca y su foto', thumb: (c) => c.about?.image },
  { id: 'men', title: 'Hombre', sub: 'Banner y título de la sección de hombre', thumb: (c) => c.men?.image },
  { id: 'faq', title: 'Preguntas frecuentes', sub: 'Dudas sobre compras, envíos y pagos', tab: 'preguntas' },
  { id: 'vip', title: 'Lista VIP', sub: 'Invitación a la lista de difusión de WhatsApp', thumb: (c) => c.vip?.image },
];

function useDraft(open, initial) {
  const [d, setD] = useState(() => structuredClone(initial || {}));
  useEffect(() => { if (open) setD(structuredClone(initial || {})); }, [open]);
  return [d, (patch) => setD((x) => ({ ...x, ...patch }))];
}

function EditorSheet({ open, onClose, title, sub, onSave, children, size = 'lg' }) {
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await onSave();
      invalidate('content', 'settings');
      toast({ title: 'Cambios publicados', sub: 'Ya se ven en la tienda.' });
      onClose(true);
    } catch (err) {
      toastError(err, 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={() => onClose(false)} title={title} sub={sub} size={size}
      footer={<><Button variant="ghost" onClick={() => onClose(false)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>Guardar y publicar</Button></>}>
      {children}
    </Sheet>
  );
}

const lines = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);

export function HeroEditor({ open, onClose, content }) {
  const [d, set] = useDraft(open, content.hero);
  return (
    <EditorSheet open={open} onClose={onClose} title="Portada con video" sub="Lo primero que ven tus clientas" onSave={() => api.content.save('hero', d)}>
      <div class="stack">
        <div class="grid" style={{ '--cols': 2 }}>
          <MediaField kind="video" label="Video horizontal (computadora)" value={d.video} onChange={(v) => set({ video: v })} aspect="16 / 9" folder="divani/sitio" hint="MP4, idealmente 1920 × 1080 y menos de 20 s." />
          <MediaField kind="video" label="Video vertical (celular)" value={d.videoPortrait} onChange={(v) => set({ videoPortrait: v })} aspect="16 / 9" folder="divani/sitio" hint="Opcional. Si no lo subes se usa el horizontal." />
        </div>
        <div class="grid" style={{ '--cols': 2 }}>
          <MediaField label="Foto de respaldo (computadora)" value={d.poster} onChange={(v) => set({ poster: v })} aspect="16 / 9" folder="divani/sitio" hint="Se ve mientras carga el video." />
          <MediaField label="Foto de respaldo (celular)" value={d.posterPortrait} onChange={(v) => set({ posterPortrait: v })} aspect="16 / 9" folder="divani/sitio" />
        </div>
        <TextField label="Texto pequeño" value={d.eyebrow} onValue={(v) => set({ eyebrow: v })} placeholder="Otoño · Invierno 2026" />
        <TextField label="Título" value={d.title} onValue={(v) => set({ title: v })} hint={EMPH} />
        <TextField label="Subtítulo" multiline rows={2} value={d.subtitle} onValue={(v) => set({ subtitle: v })} />
      </div>
    </EditorSheet>
  );
}

export function RibbonsEditor({ open, onClose, content }) {
  const [d, set] = useDraft(open, { primary: (content.ribbons?.primary || []).join('\n'), secondary: (content.ribbons?.secondary || []).join('\n') });
  return (
    <EditorSheet open={open} onClose={onClose} title="Cintas cruzadas" size="md" onSave={() => api.content.save('ribbons', { primary: lines(d.primary), secondary: lines(d.secondary) })}>
      <div class="stack">
        <p class="muted small">Una frase por renglón. {EMPH}</p>
        <TextField label="Cinta negra" multiline rows={6} value={d.primary} onValue={(v) => set({ primary: v })} />
        <TextField label="Cinta de vidrio" multiline rows={6} value={d.secondary} onValue={(v) => set({ secondary: v })} />
      </div>
    </EditorSheet>
  );
}

export function AnnouncementsEditor({ open, onClose, settings }) {
  const [d, set] = useDraft(open, { text: (settings?.public?.announcements || []).join('\n') });
  return (
    <EditorSheet open={open} onClose={onClose} title="Cinta de avisos" size="md" onSave={async () => { await api.settings.save({ public: { announcements: lines(d.text) } }); await loadSettings(); }}>
      <div class="stack">
        <p class="muted small">Un aviso por renglón. Se van alternando en la parte superior de todas las páginas.</p>
        <TextField label="Avisos" multiline rows={7} value={d.text} onValue={(v) => set({ text: v })} />
      </div>
    </EditorSheet>
  );
}

export function EditorialEditor({ open, onClose, content }) {
  const [d, set] = useDraft(open, content.editorial);
  return (
    <EditorSheet open={open} onClose={onClose} title="Banda editorial" onSave={() => api.content.save('editorial', d)}>
      <div class="stack">
        <MediaField label="Foto panorámica" value={d.image} onChange={(v) => set({ image: v })} aspect="21 / 9" folder="divani/sitio" hint="Horizontal, 2400 × 1000 px o más." />
        <TextField label="Texto pequeño" value={d.eyebrow} onValue={(v) => set({ eyebrow: v })} />
        <TextField label="Frase" value={d.title} onValue={(v) => set({ title: v })} hint={EMPH} />
      </div>
    </EditorSheet>
  );
}

export function KidsEditor({ open, onClose, content }) {
  const [d, set] = useDraft(open, content.kids);
  return (
    <EditorSheet open={open} onClose={onClose} title="Niñas y niños" onSave={() => api.content.save('kids', d)}>
      <div class="stack">
        <TextField label="Título" value={d.title} onValue={(v) => set({ title: v })} hint={EMPH} />
        <TextField label="Descripción" multiline rows={2} value={d.lead} onValue={(v) => set({ lead: v })} />
        <div class="grid" style={{ '--cols': 2, '--cols-m': 2 }}>
          <MediaField label="Foto de niñas" value={d.girlsImage} onChange={(v) => set({ girlsImage: v })} aspect="4 / 5" folder="divani/sitio" compact />
          <MediaField label="Foto de niños" value={d.boysImage} onChange={(v) => set({ boysImage: v })} aspect="4 / 5" folder="divani/sitio" compact />
        </div>
      </div>
    </EditorSheet>
  );
}

export function AboutEditor({ open, onClose, content }) {
  const [d, set] = useDraft(open, { ...content.about, text: (content.about?.paragraphs || []).join('\n\n') });
  return (
    <EditorSheet open={open} onClose={onClose} title="Acerca de nosotros" onSave={() => api.content.save('about', { title: d.title, image: d.image, paragraphs: String(d.text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) })}>
      <div class="stack">
        <TextField label="Título" value={d.title} onValue={(v) => set({ title: v })} hint={EMPH} />
        <MediaField label="Foto" value={d.image} onChange={(v) => set({ image: v })} aspect="16 / 9" folder="divani/sitio" />
        <TextField label="Historia" multiline rows={10} value={d.text} onValue={(v) => set({ text: v })} hint="Deja un renglón en blanco entre párrafos." />
        <p class="hint-inline"><Info aria-hidden="true" />Cuenta tu historia sin mencionar a terceros: así tu tienda se percibe como marca propia.</p>
      </div>
    </EditorSheet>
  );
}

export function MenEditor({ open, onClose, content }) {
  const [d, set] = useDraft(open, content.men);
  return (
    <EditorSheet open={open} onClose={onClose} title="Hombre" onSave={() => api.content.save('men', d)}>
      <div class="stack">
        <TextField label="Título de la sección" value={d.title} onValue={(v) => set({ title: v })} hint={EMPH} />
        <TextField label="Texto sobre la foto" value={d.bannerTitle} onValue={(v) => set({ bannerTitle: v })} />
        <MediaField label="Foto vertical" value={d.image} onChange={(v) => set({ image: v })} aspect="4 / 5" folder="divani/sitio" />
      </div>
    </EditorSheet>
  );
}

export function VipEditor({ open, onClose, content }) {
  const [d, set] = useDraft(open, content.vip);
  return (
    <EditorSheet open={open} onClose={onClose} title="Lista VIP" onSave={() => api.content.save('vip', d)}>
      <div class="stack">
        <TextField label="Título" value={d.title} onValue={(v) => set({ title: v })} hint={EMPH} />
        <TextField label="Texto" multiline rows={3} value={d.text} onValue={(v) => set({ text: v })} />
        <MediaField label="Foto de fondo" value={d.image} onChange={(v) => set({ image: v })} aspect="21 / 9" folder="divani/sitio" />
        <Field label="Botón">
          <p class="small muted">El botón «Unirme a la lista VIP» abre WhatsApp con un mensaje para que te pidan entrar a tu lista de difusión.</p>
        </Field>
      </div>
    </EditorSheet>
  );
}
