/**
 * Fotos y videos: un campo de una imagen (con vista previa, cambiar y quitar) y una
 * galería de varias fotos (la primera es la principal; se reordenan arrastrando o con
 * las flechas). Suben a Cloudinary (o se guardan en el navegador en modo demostración).
 */
import { useRef, useState } from 'preact/hooks';
import { ImagePlus, Upload, Trash2, Link as LinkIcon, ChevronLeft, ChevronRight, Video, RefreshCw, Star } from 'lucide-preact';
import { api } from '../api/index.js';
import { cdn } from '../../backend/model.js';
import { cx, IconButton } from './controls.jsx';
import { toast, toastError, promptDialog } from './overlays.jsx';

const isVideoUrl = (u) => /\.(mp4|webm|mov)(\?|$)/i.test(u || '') || /\/video\/upload\//.test(u || '') || /^data:video\//.test(u || '');

async function uploadOne(file, { kind, folder, onProgress }) {
  return api.media.upload(file, { kind, folder, onProgress });
}

function useUploader({ kind = 'image', folder = 'divani' } = {}) {
  const [progress, setProgress] = useState(null);
  const run = async (file) => {
    setProgress(0.02);
    try {
      return await uploadOne(file, { kind, folder, onProgress: (p) => setProgress(p) });
    } finally {
      setProgress(null);
    }
  };
  return [run, progress];
}

function Progress({ value }) {
  if (value == null) return null;
  return (
    <div class="media__progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(value * 100)}>
      <span class="spinner" />
      <span>{Math.round(value * 100)} %</span>
      <div class="progress progress--accent"><span style={{ '--p': value }} /></div>
    </div>
  );
}

/** Una sola imagen (o video con kind="video"). */
export function MediaField({ value, onChange, kind = 'image', folder = 'divani/sitio', aspect = '16 / 9', label, hint, allowUrl = true, compact }) {
  const input = useRef(null);
  const [drag, setDrag] = useState(false);
  const [upload, progress] = useUploader({ kind, folder });

  const pick = async (file) => {
    if (!file) return;
    try {
      const url = await upload(file);
      onChange(url);
      toast({ title: kind === 'video' ? 'Video listo' : 'Foto lista', sub: 'Recuerda guardar los cambios.' });
    } catch (err) {
      toastError(err, 'No se pudo subir');
    }
  };
  const fromUrl = async () => {
    const url = await promptDialog({ title: 'Usar un enlace', message: 'Pega la dirección (https://…) de la foto o video.', placeholder: 'https://res.cloudinary.com/…', confirm: 'Usar' });
    if (url) {
      if (!/^https:\/\//.test(url)) { toastError(new Error('El enlace debe empezar con https://')); return; }
      onChange(url);
    }
  };

  const isVid = kind === 'video' || isVideoUrl(value);
  return (
    <div class="field">
      {label && <span class="field__label">{label}</span>}
      <div
        class={cx('media', !value && 'media--empty', drag && 'is-drag', compact && 'media--compact')}
        style={{ aspectRatio: aspect }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
      >
        {value ? (
          isVid
            ? <video src={value} muted playsInline loop autoPlay preload="metadata" />
            : <img src={cdn(value, { w: 900 })} alt="" loading="lazy" />
        ) : (
          <button type="button" class="media__drop" onClick={() => input.current.click()}>
            {kind === 'video' ? <Video aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}
            <span>{kind === 'video' ? 'Subir video' : 'Subir foto'}</span>
            <small>Toca para elegir o arrastra aquí</small>
          </button>
        )}
        {value && progress == null && (
          <div class="media__actions">
            <button type="button" class="media__btn" onClick={() => input.current.click()}><RefreshCw aria-hidden="true" />Cambiar</button>
            {allowUrl && <IconButton class="media__icon" icon={LinkIcon} label="Usar un enlace" onClick={fromUrl} />}
          </div>
        )}
        <Progress value={progress} />
      </div>
      <div class="row row--between" style={{ '--gap': '8px' }}>
        {hint ? <p class="field__hint">{hint}</p> : <span />}
        {!value && allowUrl && <button type="button" class="link-btn small" onClick={fromUrl}><LinkIcon aria-hidden="true" />Pegar enlace</button>}
      </div>
      <input ref={input} type="file" hidden accept={kind === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/*'} onChange={(e) => { pick(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
    </div>
  );
}

/** Varias fotos: la primera es la principal (la que se ve en la tarjeta); la segunda aparece al pasar el cursor. */
export function Gallery({ images = [], onChange, folder = 'divani/productos', max = 10, label }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);

  const addFiles = async (files) => {
    const list = Array.from(files || []).slice(0, Math.max(0, max - images.length));
    if (!list.length) return;
    let current = [...images];
    for (let i = 0; i < list.length; i++) {
      setBusy({ i: i + 1, n: list.length, p: 0 });
      try {
        const url = await uploadOne(list[i], { kind: 'image', folder, onProgress: (p) => setBusy({ i: i + 1, n: list.length, p }) });
        current = [...current, url];
        onChange(current);
      } catch (err) {
        toastError(err, `No se pudo subir ${list[i].name}`);
      }
    }
    setBusy(null);
  };
  const move = (from, to) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  };

  return (
    <div class="field">
      {label && <span class="field__label">{label}<small>{images.length}/{max}</small></span>}
      <div
        class="gallery"
        onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); }}
        onDrop={(e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } }}
      >
        {images.map((src, i) => (
          <figure
            class={cx('gallery__item', dragFrom === i && 'is-dragging')}
            draggable
            onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
            onDragEnd={() => setDragFrom(null)}
            onDragOver={(e) => { if (dragFrom !== null) e.preventDefault(); }}
            onDrop={(e) => { if (dragFrom !== null) { e.preventDefault(); e.stopPropagation(); move(dragFrom, i); setDragFrom(null); } }}
          >
            <img src={cdn(src, { w: 360 })} alt={`Foto ${i + 1}`} loading="lazy" />
            {i === 0 && <span class="gallery__main"><Star aria-hidden="true" />Principal</span>}
            <div class="gallery__tools">
              <IconButton size="sm" icon={ChevronLeft} label="Mover a la izquierda" disabled={i === 0} onClick={() => move(i, i - 1)} />
              <IconButton size="sm" icon={ChevronRight} label="Mover a la derecha" disabled={i === images.length - 1} onClick={() => move(i, i + 1)} />
              <IconButton size="sm" danger icon={Trash2} label="Quitar foto" onClick={() => onChange(images.filter((_, k) => k !== i))} />
            </div>
          </figure>
        ))}
        {images.length < max && (
          <button type="button" class="gallery__add" onClick={() => input.current.click()} disabled={!!busy}>
            {busy ? (
              <>
                <span class="spinner" />
                <span>{busy.n > 1 ? `Subiendo ${busy.i} de ${busy.n}` : 'Subiendo'} · {Math.round(busy.p * 100)} %</span>
              </>
            ) : (
              <>
                <Upload aria-hidden="true" />
                <span>{images.length ? 'Agregar fotos' : 'Subir fotos'}</span>
                <small>Puedes elegir varias</small>
              </>
            )}
          </button>
        )}
      </div>
      <input ref={input} type="file" hidden multiple accept="image/*" onChange={(e) => { addFiles(e.currentTarget.files); e.currentTarget.value = ''; }} />
    </div>
  );
}
