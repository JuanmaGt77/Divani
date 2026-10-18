/** Aviso tipo Dynamic Island: una píldora negra que se expande arriba al centro. */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { Icon } from '../../components/Icon';
import { cx } from '../../components/cx';
import { $notice } from '../../state/ui';

const DURATION = 3400;

export function Island() {
  const notice = useStore($notice);
  const [openId, setOpenId] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const schedule = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpenId(null), DURATION);
  };

  useEffect(() => {
    if (!notice) return undefined;
    // Se cierra un instante y vuelve a abrir para reiniciar la animación si ya estaba abierta
    setOpenId(null);
    const raf = requestAnimationFrame(() => {
      setOpenId(notice.id);
      schedule();
    });
    return () => cancelAnimationFrame(raf);
  }, [notice]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div
      className={cx('island', notice && openId === notice.id && 'is-open')}
      role="status"
      aria-live="polite"
      onPointerEnter={() => clearTimeout(timer.current)}
      onPointerLeave={() => openId && schedule()}
    >
      <div className="island__content">
        {notice && (
          <>
            {notice.image ? (
              <img className="island__thumb" src={notice.image} alt="" />
            ) : (
              <span className="island__icon">
                <Icon name={notice.icon || 'check'} />
              </span>
            )}
            <span className="island__text">
              <span className="island__title">{notice.title}</span>
              {notice.sub && <span className="island__sub">{notice.sub}</span>}
            </span>
            {notice.action && (
              <button
                className="island__btn"
                type="button"
                onClick={() => {
                  setOpenId(null);
                  notice.action?.onClick();
                }}
              >
                {notice.action.label}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
