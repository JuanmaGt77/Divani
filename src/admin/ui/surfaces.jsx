/** Superficies: tarjetas, insignias, estadísticas, encabezados, pestañas, menús y estados vacíos. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { ArrowUpRight, ArrowDownRight, Minus, ChevronLeft, Image as ImageIcon, Ellipsis } from 'lucide-preact';
import { statusInfo, paymentInfo, cdn } from '../../backend/model.js';
import { initials } from '../lib/format.js';
import { cx } from './controls.jsx';
import { href } from '../lib/router.js';

export function Card({ title, sub, icon: Icon, actions, children, pad, flat, class: cls, bodyClass, foot, ...rest }) {
  return (
    <section class={cx('card', pad && 'card--pad', flat && 'card--flat', cls)} {...rest}>
      {(title || actions) && (
        <header class="card__head">
          <div class="grow">
            {title && <h2 class="card__title">{Icon && <Icon aria-hidden="true" />}{title}</h2>}
            {sub && <p class="card__sub">{sub}</p>}
          </div>
          {actions && <div class="row" style={{ '--gap': '6px' }}>{actions}</div>}
        </header>
      )}
      {children !== undefined && (bodyClass === false ? children : <div class={cx('card__body', bodyClass)}>{children}</div>)}
      {foot && <footer class="card__foot">{foot}</footer>}
    </section>
  );
}

export function Badge({ tone, dot, pulse, children, icon: Icon, outline }) {
  return (
    <span class={cx('badge', tone && `badge--${tone}`, outline && 'badge--outline', pulse && 'badge--pulse')}>
      {dot && <span class="badge__dot" aria-hidden="true" />}
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </span>
  );
}

export const StatusBadge = ({ status }) => {
  const s = statusInfo(status);
  return <Badge tone={s.tone} dot pulse={status === 'nuevo'}>{s.label}</Badge>;
};
export const PaymentBadge = ({ status, short }) => {
  const p = paymentInfo(status);
  return <Badge tone={p.tone} outline={status === 'pendiente'}>{short ? p.short : p.label}</Badge>;
};

export function Delta({ d }) {
  if (!d) return null;
  const Icon = d.dir === 'up' ? ArrowUpRight : d.dir === 'down' ? ArrowDownRight : Minus;
  return <span class={`delta delta--${d.dir}`}><Icon aria-hidden="true" />{d.text}</span>;
}

export function Stat({ label, value, icon: Icon, delta, foot, small, children, class: cls }) {
  return (
    <div class={cx('stat', cls)}>
      <span class="stat__label">{Icon && <Icon aria-hidden="true" />}{label}</span>
      <span class={cx('stat__value', small && 'stat__value--sm')}>{value}</span>
      {(delta || foot) && <span class="stat__foot"><Delta d={delta} />{foot}</span>}
      {children}
    </div>
  );
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div class="empty">
      {Icon && <span class="empty__icon"><Icon aria-hidden="true" /></span>}
      {title && <p class="empty__title">{title}</p>}
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', r, style }) {
  return <div class="sk" style={{ height: typeof h === 'number' ? `${h}px` : h, width: typeof w === 'number' ? `${w}px` : w, borderRadius: r, ...style }} aria-hidden="true" />;
}

export function SkeletonRows({ rows = 6, thumb = true }) {
  return (
    <div class="stack" style={{ '--gap': '14px', padding: '18px 20px' }} aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }, (_, i) => (
        <div class="row" key={i} style={{ '--gap': '12px' }}>
          {thumb && <Skeleton h={48} w={40} r="9px" />}
          <div class="stack grow" style={{ '--gap': '7px' }}>
            <Skeleton h={13} w={`${55 + ((i * 17) % 35)}%`} />
            <Skeleton h={11} w={`${30 + ((i * 11) % 25)}%`} />
          </div>
          <Skeleton h={22} w={70} r="11px" />
        </div>
      ))}
    </div>
  );
}

export function Thumb({ src, size = 44, square, alt = '' }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <span class={cx('thumb thumb--empty', square && 'thumb--sq')} style={{ '--s': `${size}px` }}><ImageIcon aria-hidden="true" /></span>;
  }
  return (
    <img
      class={cx('thumb', square && 'thumb--sq')}
      style={{ '--s': `${size}px` }}
      src={cdn(src, { w: size * 3 })}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

export const Avatar = ({ name, size = 38 }) => <span class="avatar" style={{ '--s': `${size}px` }} aria-hidden="true">{initials(name)}</span>;

export function Banner({ tone, icon: Icon, children, action }) {
  return (
    <div class={cx('banner', tone && `banner--${tone}`)} role="status">
      {Icon && <Icon aria-hidden="true" />}
      <div class="grow">{children}</div>
      {action}
    </div>
  );
}

export function PageHeader({ title, sub, actions, back, eyebrow }) {
  return (
    <header class="page-head" data-page-head>
      <div class="page-head__text">
        {back && <a class="back-link" href={href(back.to)}><ChevronLeft aria-hidden="true" />{back.label}</a>}
        {eyebrow && <p class="eyebrow">{eyebrow}</p>}
        <h1 class="page-title" data-page-title>{title}</h1>
        {sub && <p class="page-sub">{sub}</p>}
      </div>
      {actions && <div class="page-actions">{actions}</div>}
    </header>
  );
}

export function Tabs({ value, onChange, items, label }) {
  return (
    <div class="tabs" role="tablist" aria-label={label}>
      {items.map((t) => (
        <button type="button" role="tab" class="tabs__btn" aria-selected={String(t.value === value)} onClick={() => onChange(t.value)}>
          {t.icon && <t.icon aria-hidden="true" />}
          {t.label}
          {t.count ? <span class="count-pill" style={{ background: 'var(--fill-2)', color: 'var(--text-2)' }}>{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Menú de acciones (⋯). items: [{ label, icon, onClick, danger } | '-' ] */
export function Menu({ items, label = 'Más acciones', icon: Icon = Ellipsis, trigger, align = 'right', up }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div class="menu-wrap" ref={ref}>
      {trigger ? trigger({ open, toggle: () => setOpen(!open) }) : (
        <button type="button" class="icon-btn" aria-label={label} aria-haspopup="menu" aria-expanded={String(open)} onClick={() => setOpen(!open)}>
          <Icon aria-hidden="true" />
        </button>
      )}
      {open && (
        <div class={cx('menu', align === 'left' && 'menu--left', up && 'menu--up')} role="menu">
          {items.filter(Boolean).map((it) => (it === '-' ? <div class="menu__sep" role="separator" /> : it.heading ? <p class="menu__label">{it.heading}</p> : (
            <button type="button" role="menuitem" class={cx('menu__item', it.danger && 'menu__item--danger')} disabled={it.disabled} onClick={() => { setOpen(false); it.onClick?.(); }}>
              {it.icon && <it.icon aria-hidden="true" />}
              <span class="grow">{it.label}</span>
              {it.hint && <span class="faint small">{it.hint}</span>}
            </button>
          )))}
        </div>
      )}
    </div>
  );
}

export function KV({ rows }) {
  return (
    <dl class="kv">
      {rows.filter(Boolean).map(([k, v, cls]) => (
        <>
          <dt class={cls}>{k}</dt>
          <dd class={cls}>{v}</dd>
        </>
      ))}
    </dl>
  );
}

export function ListRow({ icon: Icon, media, title, sub, end, chevron, onClick, href: link, children, class: cls }) {
  const Tag = link ? 'a' : onClick ? 'button' : 'div';
  return (
    <Tag class={cx('list__row', cls)} href={link} onClick={onClick} type={Tag === 'button' ? 'button' : undefined}>
      {Icon && <span class="list__icon"><Icon aria-hidden="true" /></span>}
      {media}
      <span class="list__body">
        {title && <span class="list__title">{title}</span>}
        {sub && <span class="list__sub">{sub}</span>}
        {children}
      </span>
      {end && <span class="list__end">{end}</span>}
      {chevron && <svg class="list__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>}
    </Tag>
  );
}
