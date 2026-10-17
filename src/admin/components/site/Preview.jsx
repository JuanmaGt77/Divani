/**
 * Vista previa en vivo de la tienda dentro del panel, como computadora o como iPhone.
 * La tienda se abre con ?editar=1: al tocar una sección le avisa al panel cuál editar,
 * y al guardar se recarga en el mismo punto donde estabas.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Monitor, Smartphone, RotateCw, ExternalLink, Signal, Wifi, BatteryFull } from 'lucide-preact';
import { Segmented, IconButton, cx } from '../../ui/controls.jsx';

const DESKTOP_W = 1280;
const PHONE = { w: 390, h: 844, bar: 46 };
const DEVICE_KEY = 'divani.preview.device';

const readDevice = () => { try { return localStorage.getItem(DEVICE_KEY) || 'desktop'; } catch { return 'desktop'; } };

/** Le pide a la vista previa que muestre una sección (sin recargar). */
export function scrollPreviewTo(frame, section) {
  try { frame?.contentWindow?.postMessage({ type: 'divani:scroll-to', section }, location.origin); } catch { /* aún cargando */ }
}

export function SitePreview({ page = 'index.html', version = 0, onEdit, frameRef, device: forced, bare, class: cls }) {
  const stage = useRef(null);
  const frame = useRef(null);
  const onEditRef = useRef(onEdit);
  onEditRef.current = onEdit;
  const [device, setDevice] = useState(forced || readDevice);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(true);
  const [src, setSrc] = useState(`${page}?editar=1`);
  const [clock] = useState(() => new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: false }));

  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(stage.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { if (frameRef) frameRef.current = frame.current; });

  // Recargar al guardar, conservando la posición
  useEffect(() => {
    if (!version) return;
    let y = 0;
    try { y = Math.round(frame.current.contentWindow.scrollY || 0); } catch { /* sin acceso */ }
    setLoading(true);
    setSrc(`${page}?editar=1&y=${y}&v=${version}`);
  }, [version]);

  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'divani:edit') onEditRef.current?.(e.data.section);
      if (e.data?.type === 'divani:ready') setLoading(false);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const pick = (d) => {
    setDevice(d);
    try { localStorage.setItem(DEVICE_KEY, d); } catch { /* sin almacenamiento */ }
  };
  const reload = () => {
    setLoading(true);
    try { frame.current.contentWindow.location.reload(); } catch { setSrc(`${page}?editar=1&v=${Date.now()}`); }
  };

  const phone = device === 'mobile';
  let frameStyle;
  let deviceStyle;
  if (phone) {
    const s = Math.min(1, (box.w - 32) / (PHONE.w + 24), (box.h - 32) / (PHONE.h + 24)) || 0.5;
    deviceStyle = { width: `${PHONE.w + 24}px`, height: `${PHONE.h + 24}px`, transform: `translateX(-50%) scale(${s})` };
    frameStyle = { width: `${PHONE.w}px`, height: `${PHONE.h - PHONE.bar}px` };
  } else {
    const s = Math.min(1, box.w / DESKTOP_W) || 0.5;
    frameStyle = { width: `${DESKTOP_W}px`, height: `${Math.ceil(box.h / s)}px`, transform: `scale(${s})` };
  }

  return (
    <div class={cx('preview', bare && 'preview--bare', cls)}>
      {!bare && (
        <div class="preview__bar">
          <Segmented
            size="sm"
            value={device}
            onChange={pick}
            label="Tamaño de la vista previa"
            options={[{ value: 'desktop', label: 'Computadora', icon: Monitor }, { value: 'mobile', label: 'Celular', icon: Smartphone }]}
          />
          <span class="grow" />
          <IconButton icon={RotateCw} label="Recargar vista previa" onClick={reload} />
          <a class="icon-btn" href={page} target="_blank" rel="noopener" aria-label="Abrir la tienda en otra pestaña" title="Abrir la tienda en otra pestaña"><ExternalLink aria-hidden="true" /></a>
        </div>
      )}
      <div class={cx('preview__stage', phone && !bare && 'is-phone')} ref={stage}>
        {bare ? (
          <iframe ref={frame} class="preview__fill" src={src} title="Vista previa de la tienda" onLoad={() => setTimeout(() => setLoading(false), 350)} />
        ) : box.w > 0 && (phone ? (
          <div class="phone" style={deviceStyle}>
            <div class="phone__screen">
              <div class="phone__status" aria-hidden="true">
                <span class="phone__time">{clock}</span>
                <span class="phone__island" />
                <span class="phone__icons"><Signal /><Wifi /><BatteryFull /></span>
              </div>
              <iframe ref={frame} src={src} title="Vista previa de la tienda en celular" style={frameStyle} onLoad={() => setTimeout(() => setLoading(false), 350)} />
            </div>
          </div>
        ) : (
          <iframe ref={frame} class="preview__desktop" src={src} title="Vista previa de la tienda" style={frameStyle} onLoad={() => setTimeout(() => setLoading(false), 350)} />
        ))}
        {loading && <div class="preview__loading"><span class="spinner" /><span>Cargando tu tienda…</span></div>}
      </div>
    </div>
  );
}
