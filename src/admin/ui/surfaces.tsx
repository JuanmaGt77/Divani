/** Superficies: tarjetas, insignias, estadísticas, encabezados, pestañas, menús y estados vacíos. */
import { Fragment, useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  Ellipsis,
  Image as ImageIcon,
  Minus,
  type LucideIcon,
} from 'lucide-react';
import { initials, type Delta as DeltaValue } from '@/lib/format';
import { cdn, paymentInfo, statusInfo } from '@/lib/model';
import type { Tone } from '@/lib/types';
import { useFitText, useScrollEdges } from '../lib/hooks';
import { cx } from './controls';

type CardProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title?: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  pad?: boolean;
  flat?: boolean;
  /** false = el contenido va directo, sin el contenedor con relleno. */
  bodyClass?: string | false;
  foot?: ReactNode;
};

export function Card({
  title,
  sub,
  icon: Icon,
  actions,
  children,
  pad,
  flat,
  className,
  bodyClass,
  foot,
  ...rest
}: CardProps) {
  return (
    <section className={cx('card', pad && 'card--pad', flat && 'card--flat', className)} {...rest}>
      {(title || actions) && (
        <header className="card__head">
          <div className="grow">
            {title && (
              <h2 className="card__title">
                {Icon && <Icon aria-hidden="true" />}
                {title}
              </h2>
            )}
            {sub && <p className="card__sub">{sub}</p>}
          </div>
          {actions && (
            <div className="row" style={{ '--gap': '6px' }}>
              {actions}
            </div>
          )}
        </header>
      )}
      {children !== undefined &&
        (bodyClass === false ? children : <div className={cx('card__body', bodyClass)}>{children}</div>)}
      {foot && <footer className="card__foot">{foot}</footer>}
    </section>
  );
}

export function Badge({
  tone,
  dot,
  pulse,
  children,
  icon: Icon,
  outline,
}: {
  tone?: Tone | undefined;
  dot?: boolean;
  pulse?: boolean;
  children?: ReactNode;
  icon?: LucideIcon | undefined;
  outline?: boolean;
}) {
  return (
    <span className={cx('badge', tone && `badge--${tone}`, outline && 'badge--outline', pulse && 'badge--pulse')}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = statusInfo(status);
  return (
    <Badge tone={s.tone} dot pulse={status === 'nuevo'}>
      {s.label}
    </Badge>
  );
}

export function PaymentBadge({ status, short }: { status: string; short?: boolean }) {
  const p = paymentInfo(status);
  return (
    <Badge tone={p.tone} outline={status === 'pendiente'}>
      {short ? p.short : p.label}
    </Badge>
  );
}

export function Delta({ d }: { d: DeltaValue | null | undefined }) {
  if (!d) return null;
  const Icon = d.dir === 'up' ? ArrowUpRight : d.dir === 'down' ? ArrowDownRight : Minus;
  return (
    <span className={`delta delta--${d.dir}`}>
      <Icon aria-hidden="true" />
      {d.text}
    </span>
  );
}

export function Stat({
  label,
  value,
  icon: Icon,
  delta,
  foot,
  small,
  children,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  delta?: DeltaValue | null;
  foot?: ReactNode;
  small?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const valueRef = useRef<HTMLSpanElement>(null);
  useFitText(valueRef);
  return (
    <div className={cx('stat', className)}>
      <span className="stat__label">
        {Icon && <Icon aria-hidden="true" />}
        {label}
      </span>
      <span ref={valueRef} className={cx('stat__value', small && 'stat__value--sm')}>
        {value}
      </span>
      {(delta || foot) && (
        <span className="stat__foot">
          <Delta d={delta} />
          {foot}
        </span>
      )}
      {children}
    </div>
  );
}

export function Empty({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {Icon && (
        <span className="empty__icon">
          <Icon aria-hidden="true" />
        </span>
      )}
      {title && <p className="empty__title">{title}</p>}
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({
  h = 16,
  w = '100%',
  r,
  style,
}: {
  h?: number | string;
  w?: number | string;
  r?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className="sk"
      style={{
        height: typeof h === 'number' ? `${h}px` : h,
        width: typeof w === 'number' ? `${w}px` : w,
        borderRadius: r,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export function SkeletonRows({ rows = 6, thumb = true }: { rows?: number; thumb?: boolean }) {
  return (
    <div className="stack" style={{ '--gap': '14px', padding: '18px 20px' }} aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }, (_, i) => (
        <div className="row" key={i} style={{ '--gap': '12px' }}>
          {thumb && <Skeleton h={48} w={40} r="9px" />}
          <div className="stack grow" style={{ '--gap': '7px' }}>
            <Skeleton h={13} w={`${55 + ((i * 17) % 35)}%`} />
            <Skeleton h={11} w={`${30 + ((i * 11) % 25)}%`} />
          </div>
          <Skeleton h={22} w={70} r="11px" />
        </div>
      ))}
    </div>
  );
}

export function Thumb({
  src,
  size = 44,
  square,
  alt = '',
}: {
  src?: string | null;
  size?: number;
  square?: boolean;
  alt?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className={cx('thumb thumb--empty', square && 'thumb--sq')} style={{ '--s': `${size}px` }}>
        <ImageIcon aria-hidden="true" />
      </span>
    );
  }
  return (
    <img
      className={cx('thumb', square && 'thumb--sq')}
      style={{ '--s': `${size}px` }}
      src={cdn(src, { w: size * 3 })}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

export function Avatar({ name, size = 38 }: { name: string | null | undefined; size?: number }) {
  return (
    <span className="avatar" style={{ '--s': `${size}px` }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Banner({
  tone,
  icon: Icon,
  children,
  action,
}: {
  tone?: 'info' | 'danger' | 'warn';
  icon?: LucideIcon;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={cx('banner', tone && `banner--${tone}`)} role="status">
      {Icon && <Icon aria-hidden="true" />}
      <div className="grow">{children}</div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  actions,
  back,
  eyebrow,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
  eyebrow?: ReactNode;
}) {
  return (
    <header className="page-head" data-page-head>
      <div className="page-head__text">
        {back && (
          <Link className="back-link" to={back.to}>
            <ChevronLeft aria-hidden="true" />
            {back.label}
          </Link>
        )}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title" data-page-title>
          {title}
        </h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export interface TabItem<V extends string> {
  value: V;
  label: ReactNode;
  icon?: LucideIcon;
  count?: number;
}

export function Tabs<V extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: V;
  onChange: (v: V) => void;
  items: TabItem<V>[];
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollEdges(ref, [items.length]);
  return (
    <div ref={ref} className="tabs" role="tablist" aria-label={label}>
      {items.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          className="tabs__btn"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
        >
          {t.icon && <t.icon aria-hidden="true" />}
          {t.label}
          {t.count ? (
            <span className="count-pill" style={{ background: 'var(--fill-2)', color: 'var(--text-2)' }}>
              {t.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export type MenuItem =
  | '-'
  | false
  | null
  | undefined
  | { heading: ReactNode }
  | {
      label: ReactNode;
      icon?: LucideIcon;
      onClick?: () => void;
      danger?: boolean;
      disabled?: boolean;
      hint?: ReactNode;
    };

/** Menú de acciones (⋯). */
export function Menu({
  items,
  label = 'Más acciones',
  icon: Icon = Ellipsis,
  trigger,
  align = 'right',
  up,
}: {
  items: MenuItem[];
  label?: string;
  icon?: LucideIcon;
  trigger?: (api: { open: boolean; toggle: () => void }) => ReactNode;
  align?: 'left' | 'right';
  up?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      {trigger ? (
        trigger({ open, toggle: () => setOpen(!open) })
      ) : (
        <button
          type="button"
          className="icon-btn"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Icon aria-hidden="true" />
        </button>
      )}
      {open && (
        <div className={cx('menu', align === 'left' && 'menu--left', up && 'menu--up')} role="menu">
          {items.map((it, i) => {
            if (!it) return null;
            if (it === '-') return <div key={i} className="menu__sep" role="separator" />;
            if ('heading' in it) {
              return (
                <p key={i} className="menu__label">
                  {it.heading}
                </p>
              );
            }
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                className={cx('menu__item', it.danger && 'menu__item--danger')}
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onClick?.();
                }}
              >
                {it.icon && <it.icon aria-hidden="true" />}
                <span className="grow">{it.label}</span>
                {it.hint && <span className="faint small">{it.hint}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type KvRow = [ReactNode, ReactNode, string?] | null | false | undefined;

export function KV({ rows }: { rows: KvRow[] }) {
  return (
    <dl className="kv">
      {rows.map((r, i) => {
        if (!r) return null;
        const [k, v, cls] = r;
        return (
          <Fragment key={i}>
            <dt className={cls}>{k}</dt>
            <dd className={cls}>{v}</dd>
          </Fragment>
        );
      })}
    </dl>
  );
}

export function ListRow({
  icon: Icon,
  media,
  title,
  sub,
  end,
  chevron,
  onClick,
  to,
  children,
  className,
}: {
  icon?: LucideIcon;
  media?: ReactNode;
  title?: ReactNode;
  sub?: ReactNode;
  end?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  to?: string;
  children?: ReactNode;
  className?: string;
}) {
  const content = (
    <>
      {Icon && (
        <span className="list__icon">
          <Icon aria-hidden="true" />
        </span>
      )}
      {media}
      <span className="list__body">
        {title && <span className="list__title">{title}</span>}
        {sub && <span className="list__sub">{sub}</span>}
        {children}
      </span>
      {end && <span className="list__end">{end}</span>}
      {chevron && (
        <svg
          className="list__chev"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      )}
    </>
  );
  if (to) {
    return (
      <Link className={cx('list__row', className)} to={to} onClick={onClick}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={cx('list__row', className)} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className={cx('list__row', className)}>{content}</div>;
}
