/**
 * Hojas (modales), alertas de confirmación estilo iOS y avisos tipo Dynamic Island.
 * Las hojas usan <dialog> nativo: quedan por encima de todo, atrapan el foco y se
 * cierran con Esc; en celular salen desde abajo y se pueden arrastrar para cerrar.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { Check, CircleAlert, Info, X, type LucideIcon } from 'lucide-react';
import { cx, IconButton } from './controls';

let openCount = 0;
const lockScroll = (on: boolean) => {
  openCount = Math.max(0, openCount + (on ? 1 : -1));
  document.documentElement.style.overflow = openCount ? 'hidden' : '';
};

export interface SheetProps {
  open: boolean;
  onClose?: () => void;
  title: ReactNode;
  sub?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children?: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
  className?: string;
  headerEnd?: ReactNode;
}

export function Sheet({
  open,
  onClose,
  title,
  sub,
  size,
  children,
  footer,
  dismissible = true,
  className,
  headerEnd,
}: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(open);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const locked = useRef(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return undefined;
    if (open) {
      setMounted(true);
      if (!d.open) {
        d.classList.remove('is-closing');
        d.showModal();
        if (!locked.current) {
          lockScroll(true);
          locked.current = true;
        }
        requestAnimationFrame(() => {
          const first =
            d.querySelector<HTMLElement>('[data-autofocus]') ||
            d.querySelector<HTMLElement>(
              '.sheet__body input:not([type=checkbox]):not([type=radio]), .sheet__body textarea, .sheet__body select',
            );
          if (first && matchMedia('(hover: hover)').matches) first.focus({ preventScroll: true });
          else d.querySelector<HTMLElement>('.sheet__head button')?.blur();
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
        if (locked.current) {
          lockScroll(false);
          locked.current = false;
        }
        setMounted(false);
      }, 230);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  useEffect(
    () => () => {
      if (ref.current?.open) ref.current.close();
      if (locked.current) {
        lockScroll(false);
        locked.current = false;
      }
    },
    [],
  );

  // Arrastrar hacia abajo para cerrar (celular)
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!dismissible || !matchMedia('(max-width: 699px)').matches || (e.target as Element).closest('button')) return;
    drag.current = { y: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current || !ref.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    ref.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    const { dy } = drag.current;
    drag.current = null;
    if (dy > 110) onClose?.();
    else if (ref.current) ref.current.style.transform = '';
  };

  return (
    <dialog
      ref={ref}
      className={cx('sheet', size && `sheet--${size}`, className)}
      aria-label={typeof title === 'string' ? title : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose?.();
      }}
      onClick={(e) => {
        if (e.target === ref.current && dismissible) onClose?.();
      }}
    >
      <div
        className="sheet__grab"
        aria-hidden="true"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <header
        className="sheet__head"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <h2 className="sheet__title">
          {title}
          {sub && <small>{sub}</small>}
        </h2>
        {headerEnd}
        {dismissible && <IconButton icon={X} label="Cerrar" onClick={onClose} />}
      </header>
      {mounted && <div className="sheet__body">{children}</div>}
      {mounted && footer && <footer className="sheet__foot">{footer}</footer>}
    </dialog>
  );
}

/* ---------- Alertas ---------- */
interface AlertRequest {
  kind: 'confirm' | 'prompt' | 'alert';
  title: ReactNode;
  message?: ReactNode;
  confirm: string;
  cancel?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  danger?: boolean;
  resolve: (value: boolean | string | null) => void;
}

const alertStore = atom<AlertRequest | null>(null);

function ask<T extends boolean | string | null>(req: Omit<AlertRequest, 'resolve'>): Promise<T> {
  return new Promise((resolve) => alertStore.set({ ...req, resolve: resolve as AlertRequest['resolve'] }));
}

export const confirmDialog = ({
  title,
  message,
  confirm = 'Aceptar',
  cancel = 'Cancelar',
  danger = false,
}: {
  title: ReactNode;
  message?: ReactNode;
  confirm?: string;
  cancel?: string;
  danger?: boolean;
}): Promise<boolean> => ask<boolean>({ kind: 'confirm', title, message, confirm, cancel, danger });

export const promptDialog = ({
  title,
  message,
  confirm = 'Aceptar',
  cancel = 'Cancelar',
  placeholder = '',
  value = '',
  required = false,
  danger = false,
}: {
  title: ReactNode;
  message?: ReactNode;
  confirm?: string;
  cancel?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  danger?: boolean;
}): Promise<string | null> =>
  ask<string | null>({ kind: 'prompt', title, message, confirm, cancel, placeholder, value, required, danger });

export const alertDialog = ({
  title,
  message,
  confirm = 'Entendido',
}: {
  title: ReactNode;
  message?: ReactNode;
  confirm?: string;
}) => ask<boolean>({ kind: 'alert', title, message, confirm });

export function AlertHost() {
  const req = useStore(alertStore);
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (req && !d.open) {
      setText(req.value || '');
      d.showModal();
      requestAnimationFrame(() =>
        (d.querySelector<HTMLElement>('input') || d.querySelector<HTMLElement>('.is-primary, .is-danger'))?.focus(),
      );
    }
    if (!req && d.open) d.close();
  }, [req]);
  const done = (value: boolean | string | null) => {
    // Se cierra de inmediato: así la hoja de abajo vuelve a recibir el foco sin esperar al siguiente render
    if (ref.current?.open) ref.current.close();
    req?.resolve(value);
    alertStore.set(null);
  };
  const ok = () => {
    if (!req) return;
    if (req.kind === 'prompt') {
      if (req.required && !text.trim()) return;
      done(text.trim());
    } else done(true);
  };
  return (
    <dialog
      ref={ref}
      className="alert"
      onCancel={(e) => {
        e.preventDefault();
        done(req?.kind === 'prompt' ? null : false);
      }}
    >
      {req && (
        <>
          <div className="alert__body">
            <p className="alert__title">{req.title}</p>
            {req.message && <p className="alert__text">{req.message}</p>}
            {req.kind === 'prompt' && (
              <input
                className="input"
                value={text}
                placeholder={req.placeholder}
                onChange={(e) => setText(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && ok()}
              />
            )}
          </div>
          <div className={cx('alert__actions', req.kind === 'alert' && 'alert__actions--single')}>
            {req.kind !== 'alert' && (
              <button type="button" onClick={() => done(req.kind === 'prompt' ? null : false)}>
                {req.cancel}
              </button>
            )}
            <button
              type="button"
              className={req.danger ? 'is-danger' : 'is-primary'}
              onClick={ok}
              disabled={req.kind === 'prompt' && req.required && !text.trim()}
            >
              {req.confirm}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}

/* ---------- Avisos (Dynamic Island) ---------- */
export interface ToastOptions {
  title: ReactNode;
  sub?: ReactNode;
  tone?: 'ok' | 'error' | 'info';
  icon?: LucideIcon;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  leaving?: boolean;
}

const toastStore = atom<ToastItem | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

/** toast({ title, sub, tone: 'ok' | 'error' | 'info', action: { label, onClick }, duration }) */
export function toast(t: ToastOptions): void {
  clearTimeout(toastTimer);
  const item: ToastItem = { id: ++seq, tone: 'ok', duration: t.tone === 'error' ? 6000 : 3600, ...t };
  toastStore.set(item);
  toastTimer = setTimeout(() => dismissToast(item.id), item.duration);
}

export const toastError = (err: unknown, title = 'No se pudo completar'): void =>
  toast({
    tone: 'error',
    title,
    sub: (err as Error)?.message || String(err || 'Ocurrió un error.'),
  });

function dismissToast(id?: number): void {
  const cur = toastStore.get();
  if (!cur || (id && cur.id !== id)) return;
  toastStore.set({ ...cur, leaving: true });
  setTimeout(() => {
    if (toastStore.get()?.id === cur.id) toastStore.set(null);
  }, 280);
}

const popoverOk = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

export function ToastHost() {
  const t = useStore(toastStore);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !popoverOk) return;
    // Mostrarlo como popover lo pone encima de cualquier hoja abierta
    try {
      if (!el.matches(':popover-open')) el.showPopover();
    } catch {
      /* sin soporte */
    }
  }, [t?.id]);
  if (!t) return null;
  const Icon = t.icon || (t.tone === 'error' ? CircleAlert : t.tone === 'info' ? Info : Check);
  return (
    <div
      key={t.id}
      ref={ref}
      popover={popoverOk ? 'manual' : undefined}
      className={cx('island', t.leaving && 'is-leaving')}
      role="status"
      aria-live="polite"
      onClick={() => !t.action && dismissToast()}
    >
      <span
        className={cx(
          'island__icon',
          t.tone === 'ok' && 'island__icon--ok',
          t.tone === 'error' && 'island__icon--error',
        )}
      >
        <Icon aria-hidden="true" />
      </span>
      <span className="island__text">
        <span className="island__title">{t.title}</span>
        {t.sub && <span className="island__sub">{t.sub}</span>}
      </span>
      {t.action && (
        <button
          type="button"
          className="island__action"
          onClick={(e) => {
            e.stopPropagation();
            t.action?.onClick();
            dismissToast();
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}
