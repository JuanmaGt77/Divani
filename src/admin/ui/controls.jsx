/** Controles: botones, campos, interruptor iOS, segmentado, chips, cantidad y búsqueda. */
import { useEffect, useLayoutEffect, useRef, useState, useId } from 'preact/hooks';
import { Search, X, Minus, Plus, Eye, EyeOff } from 'lucide-preact';
import { currencySymbol } from '../lib/format.js';

export const cx = (...a) => a.filter(Boolean).join(' ');

export function Button({ variant = 'secondary', size, block, icon: Icon, iconEnd: IconEnd, loading, children, class: cls, className, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      class={cx('btn', `btn--${variant}`, size && `btn--${size}`, block && 'btn--block', !children && 'btn--icon', cls, className)}
      disabled={rest.disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      {...rest}
    >
      {loading ? <span class="spinner" aria-hidden="true" /> : Icon && <Icon aria-hidden="true" />}
      {children}
      {IconEnd && !loading && <IconEnd aria-hidden="true" />}
    </button>
  );
}

export function LinkButton({ variant = 'secondary', size, block, icon: Icon, children, class: cls, ...rest }) {
  return (
    <a class={cx('btn', `btn--${variant}`, size && `btn--${size}`, block && 'btn--block', !children && 'btn--icon', cls)} {...rest}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </a>
  );
}

export function IconButton({ icon: Icon, label, size, danger, class: cls, ...rest }) {
  return (
    <button type="button" class={cx('icon-btn', size && `icon-btn--${size}`, danger && 'icon-btn--danger', cls)} aria-label={label} title={label} {...rest}>
      <Icon aria-hidden="true" />
    </button>
  );
}

export function Field({ label, hint, error, optional, children, class: cls, htmlFor, action }) {
  return (
    <div class={cx('field', error && 'is-invalid', cls)}>
      {label && (
        <label class="field__label" for={htmlFor}>
          <span>{label}{optional && <small> (opcional)</small>}</span>
          {action}
        </label>
      )}
      {children}
      {error ? <p class="field__error">{error}</p> : hint ? <p class="field__hint">{hint}</p> : null}
    </div>
  );
}

/** Campo con etiqueta en una sola línea: <TextField label="Nombre" value onInput /> */
export function TextField({ label, hint, error, optional, multiline, rows = 3, value, onValue, class: cls, inputClass, action, ...rest }) {
  const id = useId();
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <Field label={label} hint={hint} error={error} optional={optional} htmlFor={id} class={cls} action={action}>
      <Tag
        id={id}
        class={cx('input', inputClass)}
        value={value ?? ''}
        rows={multiline ? rows : undefined}
        onInput={(e) => onValue?.(e.currentTarget.value)}
        {...rest}
      />
    </Field>
  );
}

export function SelectField({ label, hint, error, value, onValue, options = [], placeholder, class: cls, ...rest }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} class={cls}>
      <select id={id} class="input" value={value ?? ''} onChange={(e) => onValue?.(e.currentTarget.value)} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (typeof o === 'string'
          ? <option value={o}>{o}</option>
          : <option value={o.value} disabled={o.disabled}>{o.label}</option>))}
      </select>
    </Field>
  );
}

/** Importe con símbolo de moneda. Guarda números (o '' si está vacío). */
export function MoneyInput({ value, onValue, placeholder = '0', big, class: cls, ...rest }) {
  const [text, setText] = useState(value === '' || value == null ? '' : String(value));
  useEffect(() => {
    const n = text === '' ? '' : Number(text.replace(/,/g, ''));
    if (n !== value && !(Number.isNaN(n) && value === '')) setText(value === '' || value == null ? '' : String(value));
  }, [value]);
  return (
    <div class={cx('affix affix--pre', cls)}>
      <span class="affix__pre" aria-hidden="true">{currencySymbol()}</span>
      <input
        class={cx('input', big && 'input--big')}
        inputMode="decimal"
        placeholder={placeholder}
        value={text}
        onInput={(e) => {
          const t = e.currentTarget.value.replace(/[^\d.,]/g, '').replace(/,/g, '');
          setText(t);
          onValue?.(t === '' ? '' : Number(t) || 0);
        }}
        onFocus={(e) => e.currentTarget.select()}
        {...rest}
      />
    </div>
  );
}

export function MoneyField({ label, hint, error, optional, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      <MoneyInput {...rest} />
    </Field>
  );
}

export function Switch({ checked, onChange, label, disabled, id }) {
  return (
    <span class="switch">
      <input type="checkbox" role="switch" id={id} checked={!!checked} disabled={disabled} aria-label={label} onChange={(e) => onChange?.(e.currentTarget.checked)} />
      <span class="switch__track" aria-hidden="true" />
    </span>
  );
}

/** Fila con texto e interruptor (lista estilo Ajustes). */
export function SwitchRow({ title, sub, checked, onChange, icon: Icon, disabled }) {
  const id = useId();
  return (
    <label class="list__row" for={id} style={{ cursor: disabled ? 'default' : 'pointer' }}>
      {Icon && <span class="list__icon"><Icon /></span>}
      <span class="list__body">
        <span class="list__title" style={{ whiteSpace: 'normal' }}>{title}</span>
        {sub && <span class="list__sub" style={{ whiteSpace: 'normal' }}>{sub}</span>}
      </span>
      <Switch id={id} checked={checked} onChange={onChange} disabled={disabled} label={title} />
    </label>
  );
}

/** Control segmentado con indicador deslizante. options: [{ value, label, count, icon }] */
export function Segmented({ value, onChange, options, label, block, size, class: cls }) {
  const ref = useRef(null);
  const [thumb, setThumb] = useState(null);
  useLayoutEffect(() => {
    const root = ref.current;
    const btn = root?.querySelector('[aria-pressed="true"]');
    if (!btn) { setThumb(null); return; }
    setThumb({ x: btn.offsetLeft, w: btn.offsetWidth });
    if (root.scrollWidth > root.clientWidth) btn.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [value, options.length, options.map((o) => o.count).join()]);
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const btn = ref.current?.querySelector('[aria-pressed="true"]');
      if (btn) setThumb({ x: btn.offsetLeft, w: btn.offsetWidth });
    });
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div class={cx('seg', block && 'seg--block', size && `seg--${size}`, cls)} role="group" aria-label={label} ref={ref}>
      {thumb && <span class="seg__thumb" style={{ width: `${thumb.w}px`, transform: `translateX(${thumb.x}px)` }} aria-hidden="true" />}
      {options.map((o) => (
        <button type="button" class="seg__btn" aria-pressed={String(o.value === value)} onClick={() => onChange(o.value)}>
          {o.icon && <o.icon aria-hidden="true" />}
          {o.label}
          {o.count != null && <span class="seg__count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Chip({ pressed, onClick, children, icon: Icon, size, onRemove }) {
  return (
    <button type="button" class={cx('chip', size && `chip--${size}`)} aria-pressed={pressed === undefined ? undefined : String(!!pressed)} onClick={onClick}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
      {onRemove && (
        <span class="chip__x" role="button" aria-label="Quitar" onClick={(e) => { e.stopPropagation(); onRemove(); }}><X size={13} /></span>
      )}
    </button>
  );
}

export function Stepper({ value, onChange, min = 0, max = 9999, size, label = 'Cantidad' }) {
  const set = (v) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div class={cx('stepper', size && `stepper--${size}`)} role="group" aria-label={label}>
      <button type="button" aria-label="Menos" disabled={value <= min} onClick={() => set(value - 1)}><Minus /></button>
      <input
        inputMode="numeric"
        value={value}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        onInput={(e) => { const n = parseInt(e.currentTarget.value.replace(/\D/g, ''), 10); if (!Number.isNaN(n)) set(n); }}
      />
      <button type="button" aria-label="Más" disabled={value >= max} onClick={() => set(value + 1)}><Plus /></button>
    </div>
  );
}

export function SearchField({ value, onValue, placeholder = 'Buscar', autoFocus, onKeyDown, inputRef, class: cls }) {
  return (
    <div class={cx('search', cls)}>
      <Search aria-hidden="true" />
      <input
        ref={inputRef}
        class="input"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        onInput={(e) => onValue(e.currentTarget.value)}
        onKeyDown={onKeyDown}
        enterKeyHint="search"
      />
      {value && <IconButton class="search__clear" size="sm" icon={X} label="Borrar búsqueda" onClick={() => onValue('')} />}
    </div>
  );
}

export function TagInput({ value = [], onChange, placeholder = 'Escribe y presiona Enter' }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim().replace(/,$/, '');
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div class="tag-input">
      {value.map((t) => <Chip size="sm" onRemove={() => onChange(value.filter((x) => x !== t))}>{t}</Chip>)}
      <input
        value={draft}
        placeholder={value.length ? '' : placeholder}
        onInput={(e) => { const v = e.currentTarget.value; if (v.endsWith(',')) { setDraft(v.slice(0, -1)); setTimeout(add); } else setDraft(v); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(); }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
      />
    </div>
  );
}

export function PasswordInput({ value, onValue, ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <div class="affix">
      <input class="input" type={show ? 'text' : 'password'} value={value} onInput={(e) => onValue(e.currentTarget.value)} style={{ paddingRight: '46px' }} {...rest} />
      <IconButton class="pw-toggle" icon={show ? EyeOff : Eye} label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShow(!show)} />
    </div>
  );
}

export function Checkbox({ checked, onChange, children }) {
  return (
    <label class="check">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span>{children}</span>
    </label>
  );
}
