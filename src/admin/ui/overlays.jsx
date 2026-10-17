/**
 * Hojas (modales), alertas de confirmación estilo iOS y avisos tipo Dynamic Island.
 * Las hojas usan <dialog> nativo: quedan por encima de todo, atrapan el foco y se
 * cierran con Esc; en celular salen desde abajo y se pueden arrastrar para cerrar.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { X, Check, CircleAlert, Info } from 'lucide-preact';
import { createStore, useStore } from '../lib/store.js';
import { cx, IconButton } from './controls.jsx';

let openCount = 0;
const lockScroll = (on) => {
  openCount = Math.max(0, openCount + (on ? 1 : -1));
  document.documentElement.style.overflow = openCount ? 'hidden' : '';
};

export function Sheet({ open, onClose, title, sub, size, children, footer, dismissible = true, class: cls, headerEnd }) {
  const ref = useRef(null);
  const [mounted, setMounted] = useState(open);
  const drag = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return undefined;
    if (open) {
      setMounted(true);
      if (!d.open) {
        d.classList.remove('is-closing');
        d.showModal();
        lockScroll(true);
        requestAnimationFrame(() => {
          const first = d.querySelector('[data-autofocus]') || d.querySelector('.sheet__body input:not([type=checkbox]):not([type=radio]), .sheet__body textarea, .sheet__body select');
          if (first && matchMedia('(hover: hover)').matches) first.focus({ preventScroll: true });
          else d.querySelector('.sheet__head button')?.blur();
        });
      }
      return undefined;
    }
    if (d.open) {
      d.classList.add('is-closing');
      const t = setTimeout(() => {
        d.classList.remove('is-closing');
        d.style.transform = '';
        if (d.open) d.close();
        lockScroll(false);
        setMounted(false);
      }, 230);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  useEffect(() => () => { if (ref.current?.open) { ref.current.close(); lockScroll(false); } }, []);

  // Arrastrar hacia abajo para cerrar (celular)
  const onPointerDown = (e) => {
    if (!dismissible || !matchMedia('(max-width: 699px)').matches || e.target.closest('button')) return;
    drag.current = { y: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    ref.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    const { dy } = drag.current;
    drag.current = null;
    if (dy > 110) onClose?.();
    else ref.current.style.transform = '';
  };

  return (
    <dialog
      ref={ref}
      class={cx('sheet', size && `sheet--${size}`, cls)}
      aria-label={typeof title === 'string' ? title : undefined}
      onCancel={(e) => { e.preventDefault(); if (dismissible) onClose?.(); }}
      onClick={(e) => { if (e.target === ref.current && dismissible) onClose?.(); }}
    >
      <div class="sheet__grab" aria-hidden="true" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
      <header class="sheet__head" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <h2 class="sheet__title">{title}{sub && <small>{sub}</small>}</h2>
        {headerEnd}
        {dismissible && <IconButton icon={X} label="Cerrar" onClick={onClose} />}
      </header>
      {mounted && <div class="sheet__body">{children}</div>}
      {mounted && footer && <footer class="sheet__foot">{footer}</footer>}
    </dialog>
  );
}

/* ---------- Alertas ---------- */
const alertStore = createStore(null);

function ask(req) {
  return new Promise((resolve) => alertStore.set({ ...req, resolve }));
}
export const confirmDialog = ({ title, message, confirm = 'Aceptar', cancel = 'Cancelar', danger = false }) =>
  ask({ kind: 'confirm', title, message, confirm, cancel, danger });
export const promptDialog = ({ title, message, confirm = 'Aceptar', cancel = 'Cancelar', placeholder = '', value = '', required = false, danger = false }) =>
  ask({ kind: 'prompt', title, message, confirm, cancel, placeholder, value, required, danger });
export const alertDialog = ({ title, message, confirm = 'Entendido' }) => ask({ kind: 'alert', title, message, confirm });

export function AlertHost() {
  const req = useStore(alertStore);
  const ref = useRef(null);
  const [text, setText] = useState('');
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (req && !d.open) {
      setText(req.value || '');
      d.showModal();
      requestAnimationFrame(() => (d.querySelector('input') || d.querySelector('.is-primary, .is-danger'))?.focus());
    }
    if (!req && d.open) d.close();
  }, [req]);
  const done = (value) => {
    // Se cierra de inmediato: así la hoja de abajo vuelve a recibir el foco sin esperar al siguiente render
    if (ref.current?.open) ref.current.close();
    req?.resolve(value);
    alertStore.set(null);
  };
  const ok = () => {
    if (req.kind === 'prompt') {
      if (req.required && !text.trim()) return;
      done(text.trim());
    } else done(true);
  };
  return (
    <dialog ref={ref} class="alert" onCancel={(e) => { e.preventDefault(); done(req?.kind === 'prompt' ? null : false); }}>
      {req && (
        <>
          <div class="alert__body">
            <p class="alert__title">{req.title}</p>
            {req.message && <p class="alert__text">{req.message}</p>}
            {req.kind === 'prompt' && (
              <input class="input" value={text} placeholder={req.placeholder} onInput={(e) => setText(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && ok()} />
            )}
          </div>
          <div class={cx('alert__actions', req.kind === 'alert' && 'alert__actions--single')}>
            {req.kind !== 'alert' && <button type="button" onClick={() => done(req.kind === 'prompt' ? null : false)}>{req.cancel}</button>}
            <button type="button" class={req.danger ? 'is-danger' : 'is-primary'} onClick={ok} disabled={req.kind === 'prompt' && req.required && !text.trim()}>{req.confirm}</button>
          </div>
        </>
      )}
    </dialog>
  );
}

/* ---------- Avisos (Dynamic Island) ---------- */
const toastStore = createStore(null);
let toastTimer;
let seq = 0;

/** toast({ title, sub, tone: 'ok' | 'error' | 'info', action: { label, onClick }, duration }) */
export function toast(t) {
  clearTimeout(toastTimer);
  const item = { id: ++seq, tone: 'ok', duration: t.tone === 'error' ? 6000 : 3600, ...t };
  toastStore.set(item);
  toastTimer = setTimeout(() => dismissToast(item.id), item.duration);
}
export const toastError = (err, title = 'No se pudo completar') =>
  toast({ tone: 'error', title, sub: err?.message || String(err || 'Ocurrió un error.') });

function dismissToast(id) {
  const cur = toastStore.get();
  if (!cur || (id && cur.id !== id)) return;
  toastStore.set({ ...cur, leaving: true });
  setTimeout(() => { if (toastStore.get()?.id === cur.id) toastStore.set(null); }, 280);
}

const popoverOk = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

export function ToastHost() {
  const t = useStore(toastStore);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !popoverOk) return;
    // Mostrarlo como popover lo pone encima de cualquier hoja abierta
    try {
      if (!el.matches(':popover-open')) el.showPopover();
    } catch { /* sin soporte */ }
  }, [t?.id]);
  if (!t) return null;
  const Icon = t.icon || (t.tone === 'error' ? CircleAlert : t.tone === 'info' ? Info : Check);
  return (
    <div
      key={t.id}
      ref={ref}
      popover={popoverOk ? 'manual' : undefined}
      class={cx('island', t.leaving && 'is-leaving')}
      role="status"
      aria-live="polite"
      onClick={() => !t.action && dismissToast()}
    >
      <span class={cx('island__icon', t.tone === 'ok' && 'island__icon--ok', t.tone === 'error' && 'island__icon--error')}><Icon aria-hidden="true" /></span>
      <span class="island__text">
        <span class="island__title">{t.title}</span>
        {t.sub && <span class="island__sub">{t.sub}</span>}
      </span>
      {t.action && <button type="button" class="island__action" onClick={(e) => { e.stopPropagation(); t.action.onClick(); dismissToast(); }}>{t.action.label}</button>}
    </div>
  );
}
