/**
 * Editores de cada sección de la página de inicio (fotos y textos). Cada uno guarda su llave
 * en el contenido del sitio (site_content) y la tienda lo aplica al cargar.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import type { SiteContent, Settings } from '@/lib/types';
import { api } from '../../api';
import { invalidate } from '../../lib/query';
import { loadSettings } from '../../lib/session';
import { Button, Field, TextField } from '../../ui/controls';
import { MediaField } from '../../ui/media';
import { Sheet, toast, toastError } from '../../ui/overlays';
import { EMPH } from './shared';

export interface HomeSection {
  id: string;
  title: string;
  sub: string;
  /** La sección se edita en otra pestaña de Sitio web. */
  tab?: 'categorias' | 'banners' | 'look' | 'preguntas';
  thumb?: (c: SiteContent) => string | undefined;
}

export const HOME_SECTIONS: HomeSection[] = [
  { id: 'announcements', title: 'Cinta de avisos', sub: 'Los mensajes que corren arriba del menú' },
  {
    id: 'banners',
    title: 'Portada',
    sub: 'Lo primero que se ve: campañas con color, foto y prendas con su precio',
    tab: 'banners',
  },
  { id: 'ribbons', title: 'Cintas cruzadas', sub: 'Frases que se deslizan debajo de la portada' },
  { id: 'categories', title: 'Compra por categoría', sub: 'Fotos y nombres de las categorías', tab: 'categorias' },
  { id: 'look', title: 'Arma tu look', sub: 'Foto con puntos que llevan a cada prenda', tab: 'look' },
  {
    id: 'editorial',
    title: 'Banda editorial',
    sub: 'Foto panorámica con frase de marca',
    thumb: (c) => c.editorial?.image,
  },
  {
    id: 'kids',
    title: 'Niñas y niños',
    sub: 'Textos y las dos fotos de la sección infantil',
    thumb: (c) => c.kids?.girlsImage,
  },
  { id: 'about', title: 'Acerca de nosotros', sub: 'Historia de la marca y su foto', thumb: (c) => c.about?.image },
  { id: 'men', title: 'Hombre', sub: 'Banner y título de la sección de hombre', thumb: (c) => c.men?.image },
  { id: 'faq', title: 'Preguntas frecuentes', sub: 'Dudas sobre compras, envíos y pagos', tab: 'preguntas' },
  { id: 'vip', title: 'Lista VIP', sub: 'Invitación a la lista de difusión de WhatsApp', thumb: (c) => c.vip?.image },
];

function useDraft<T extends object>(open: boolean, initial: T | undefined): [T, (patch: Partial<T>) => void] {
  const [d, setD] = useState<T>(() => structuredClone(initial || ({} as T)));
  useEffect(() => {
    if (open) setD(structuredClone(initial || ({} as T)));
    // Solo al abrir: así lo que escribes no se pierde si llegan datos nuevos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return [d, (patch) => setD((x) => ({ ...x, ...patch }))];
}

export type EditorProps = { open: boolean; onClose: (saved: boolean) => void };

function EditorSheet({
  open,
  onClose,
  title,
  sub,
  onSave,
  children,
  size = 'lg',
}: EditorProps & {
  title: string;
  sub?: string;
  onSave: () => Promise<unknown>;
  children: ReactNode;
  size?: 'md' | 'lg';
}) {
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
    <Sheet
      open={open}
      onClose={() => onClose(false)}
      title={title}
      sub={sub}
      size={size}
      footer={
        <>
          <Button variant="ghost" onClick={() => onClose(false)}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Guardar y publicar
          </Button>
        </>
      }
    >
      {children}
    </Sheet>
  );
}

const lines = (t: unknown): string[] =>
  String(t || '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

export function RibbonsEditor({ open, onClose, content }: EditorProps & { content: SiteContent }) {
  const [d, set] = useDraft(open, {
    primary: (content.ribbons?.primary || []).join('\n'),
    secondary: (content.ribbons?.secondary || []).join('\n'),
  });
  return (
    <EditorSheet
      open={open}
      onClose={onClose}
      title="Cintas cruzadas"
      size="md"
      onSave={() => api.content.save('ribbons', { primary: lines(d.primary), secondary: lines(d.secondary) })}
    >
      <div className="stack">
        <p className="muted small">Una frase por renglón. {EMPH}</p>
        <TextField label="Cinta negra" multiline rows={6} value={d.primary} onValue={(v) => set({ primary: v })} />
        <TextField
          label="Cinta de vidrio"
          multiline
          rows={6}
          value={d.secondary}
          onValue={(v) => set({ secondary: v })}
        />
      </div>
    </EditorSheet>
  );
}

export function AnnouncementsEditor({ open, onClose, settings }: EditorProps & { settings: Settings | null }) {
  const [d, set] = useDraft(open, { text: (settings?.public?.announcements || []).join('\n') });
  return (
    <EditorSheet
      open={open}
      onClose={onClose}
      title="Cinta de avisos"
      size="md"
      onSave={async () => {
        await api.settings.save({ public: { announcements: lines(d.text) } });
        await loadSettings();
      }}
    >
      <div className="stack">
        <p className="muted small">
          Un aviso por renglón. Se van alternando en la parte superior de todas las páginas.
        </p>
        <TextField label="Avisos" multiline rows={7} value={d.text} onValue={(v) => set({ text: v })} />
      </div>
    </EditorSheet>
  );
}

export function EditorialEditor({ open, onClose, content }: EditorProps & { content: SiteContent }) {
  const [d, set] = useDraft(open, content.editorial);
  return (
    <EditorSheet open={open} onClose={onClose} title="Banda editorial" onSave={() => api.content.save('editorial', d)}>
      <div className="stack">
        <MediaField
          label="Foto panorámica"
          value={d.image}
          onChange={(v) => set({ image: v })}
          aspect="21 / 9"
          folder="divani/sitio"
          hint="Horizontal, 2400 × 1000 px o más."
        />
        <TextField label="Texto pequeño" value={d.eyebrow} onValue={(v) => set({ eyebrow: v })} />
        <TextField label="Frase" value={d.title} onValue={(v) => set({ title: v })} hint={EMPH} />
      </div>
    </EditorSheet>
  );
}

export function KidsEditor({ open, onClose, content }: EditorProps & { content: SiteContent }) {
  const [d, set] = useDraft(open, content.kids);
  return (
    <EditorSheet open={open} onClose={onClose} title="Niñas y niños" onSave={() => api.content.save('kids', d)}>
      <div className="stack">
        <TextField label="Título" value={d.title} onValue={(v) => set({ title: v })} hint={EMPH} />
        <TextField label="Descripción" multiline rows={2} value={d.lead} onValue={(v) => set({ lead: v })} />
        <div className="grid" style={{ '--cols': 2, '--cols-m': 2 }}>
          <MediaField
            label="Foto de niñas"
            value={d.girlsImage}
            onChange={(v) => set({ girlsImage: v })}
            aspect="4 / 5"
            folder="divani/sitio"
            compact
          />
          <MediaField
            label="Foto de niños"
            value={d.boysImage}
            onChange={(v) => set({ boysImage: v })}
            aspect="4 / 5"
            folder="divani/sitio"
            compact
          />
        </div>
      </div>
    </EditorSheet>
  );
}

export function AboutEditor({ open, onClose, content }: EditorProps & { content: SiteContent }) {
  const [d, set] = useDraft(open, {
    title: content.about?.title || '',
    image: content.about?.image || '',
    text: (content.about?.paragraphs || []).join('\n\n'),
  });
  return (
    <EditorSheet
      open={open}
      onClose={onClose}
      title="Acerca de nosotros"
      onSave={() =>
        api.content.save('about', {
          title: d.title,
          image: d.image,
          paragraphs: String(d.text || '')
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean),
        })
      }
    >
      <div className="stack">
        <TextField label="Título" value={d.title} onValue={(v) => set({ title: v })} hint={EMPH} />
        <MediaField
          label="Foto"
          value={d.image}
          onChange={(v) => set({ image: v })}
          aspect="16 / 9"
          folder="divani/sitio"
        />
        <TextField
          label="Historia"
          multiline
          rows={10}
          value={d.text}
          onValue={(v) => set({ text: v })}
          hint="Deja un renglón en blanco entre párrafos."
        />
        <p className="hint-inline">
          <Info aria-hidden="true" />
          Cuenta tu historia sin mencionar a terceros: así tu tienda se percibe como marca propia.
        </p>
      </div>
    </EditorSheet>
  );
}

export function MenEditor({ open, onClose, content }: EditorProps & { content: SiteContent }) {
  const [d, set] = useDraft(open, content.men);
  return (
    <EditorSheet open={open} onClose={onClose} title="Hombre" onSave={() => api.content.save('men', d)}>
      <div className="stack">
        <TextField label="Título de la sección" value={d.title} onValue={(v) => set({ title: v })} hint={EMPH} />
        <TextField label="Texto sobre la foto" value={d.bannerTitle} onValue={(v) => set({ bannerTitle: v })} />
        <MediaField
          label="Foto vertical"
          value={d.image}
          onChange={(v) => set({ image: v })}
          aspect="4 / 5"
          folder="divani/sitio"
        />
      </div>
    </EditorSheet>
  );
}

export function VipEditor({ open, onClose, content }: EditorProps & { content: SiteContent }) {
  const [d, set] = useDraft(open, content.vip);
  return (
    <EditorSheet open={open} onClose={onClose} title="Lista VIP" onSave={() => api.content.save('vip', d)}>
      <div className="stack">
        <TextField label="Título" value={d.title} onValue={(v) => set({ title: v })} hint={EMPH} />
        <TextField label="Texto" multiline rows={3} value={d.text} onValue={(v) => set({ text: v })} />
        <MediaField
          label="Foto de fondo"
          value={d.image}
          onChange={(v) => set({ image: v })}
          aspect="21 / 9"
          folder="divani/sitio"
        />
        <Field label="Botón">
          <p className="small muted">
            El botón «Unirme a la lista VIP» abre WhatsApp con un mensaje para que te pidan entrar a tu lista de
            difusión.
          </p>
        </Field>
      </div>
    </EditorSheet>
  );
}
