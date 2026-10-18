/**
 * Hoja de la tienda (<dialog class="sheet">): lateral, centrada, superior o menú completo.
 *  - Abre y cierra con animación, bloquea el scroll del fondo y devuelve el foco.
 *  - Se cierra con Esc, tocando fuera del panel o con cualquier elemento [data-close].
 *  - En celular se puede arrastrar hacia abajo para cerrar (tirador o encabezado).
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { cx } from './cx';

const CLOSE_MS = 420;
let locks = 0;
const lockPage = (on: boolean) => {
  locks = Math.max(0, locks + (on ? 1 : -1));
  document.documentElement.classList.toggle('is-locked', locks > 0);
};

export interface SheetProps {
  /** El diálogo queda con id="sheet-{id}". */
  id: string;
  open: boolean;
  onClose: () => void;
  variant: 'side' | 'center' | 'top' | 'menu';
  className?: string;
  label?: string;
  labelledBy?: string;
  /** Tirador para arrastrar (celular). */
  grabber?: boolean;
  /** Selector del elemento que recibe el foco al abrir (si no, el panel). */
  initialFocus?: string;
  children: ReactNode;
}

export function Sheet({
  id,
  open,
  onClose,
  variant,
  className,
  label,
  labelledBy,
  grabber,
  initialFocus,
  children,
}: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const locked = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [shown, setShown] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const dlg = dialog.current;
    if (!dlg) return undefined;
    if (open) {
      if (!dlg.open) {
        lastFocus.current = document.activeElement as HTMLElement | null;
        try {
          dlg.showModal();
        } catch {
          dlg.setAttribute('open', '');
        }
      }
      if (!locked.current) {
        lockPage(true);
        locked.current = true;
      }
      const target = initialFocus ? dlg.querySelector<HTMLElement>(initialFocus) : null;
      // Se enfoca el panel (no el primer botón) para que el lector de pantalla empiece arriba
      if (!target) panel.current?.focus({ preventScroll: true });
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setShown(true);
          target?.focus({ preventScroll: true });
        });
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    if (!dlg.open) return undefined;
    setShown(false);
    panel.current?.style.removeProperty('--drag');
    const t = setTimeout(() => {
      if (dlg.open) dlg.close();
      if (locked.current) {
        lockPage(false);
        locked.current = false;
      }
      lastFocus.current?.focus?.({ preventScroll: true });
    }, CLOSE_MS);
    return () => clearTimeout(t);
  }, [open, initialFocus]);

  useEffect(
    () => () => {
      if (dialog.current?.open) dialog.current.close();
      if (locked.current) lockPage(false);
    },
    [],
  );

  // Arrastrar hacia abajo para cerrar (solo hojas inferiores en celular)
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = e.target as Element;
    if (e.button !== 0 || !matchMedia('(max-width: 767px)').matches) return;
    if (!t.closest('[data-grabber], .sheet__head') || t.closest('button, a, input')) return;
    const startY = e.clientY;
    const t0 = performance.now();
    let dy = 0;
    setDragging(true);
    const move = (ev: PointerEvent) => {
      dy = Math.max(0, ev.clientY - startY);
      panel.current?.style.setProperty('--drag', `${dy}px`);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const v = dy / Math.max(1, performance.now() - t0);
      if (dy > 120 || v > 0.6) onCloseRef.current();
      else panel.current?.style.setProperty('--drag', '0px');
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <dialog
      ref={dialog}
      id={`sheet-${id}`}
      className={cx('sheet', `sheet--${variant}`, className, shown && 'is-open', dragging && 'is-dragging')}
      aria-label={label}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onCloseRef.current();
      }}
      onClick={(e) => {
        const t = e.target as Element;
        if (t === dialog.current || t.closest('[data-close]')) onCloseRef.current();
      }}
    >
      <div ref={panel} className="sheet__panel glass glass--strong" tabIndex={-1} onPointerDown={onPointerDown}>
        {grabber && <div className="sheet__grabber" data-grabber aria-hidden="true" />}
        {children}
      </div>
    </dialog>
  );
}
