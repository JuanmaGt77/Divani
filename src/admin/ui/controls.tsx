/** Controles: botones, campos, interruptor iOS, segmentado, chips, cantidad y búsqueda. */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEventHandler,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link, type LinkProps } from 'react-router';
import { Eye, EyeOff, Minus, Plus, Search, X, type LucideIcon } from 'lucide-react';
import { currencySymbol } from '@/lib/format';

export const cx = (...a: unknown[]): string => a.filter(Boolean).join(' ');

export type Variant = 'primary' | 'secondary' | 'ghost' | 'tinted' | 'wa' | 'danger';
export type Size = 'sm' | 'lg' | 'xl';

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: LucideIcon;
  iconEnd?: LucideIcon;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
};

export function Button({
  variant = 'secondary',
  size,
  block,
  icon: Icon,
  iconEnd: IconEnd,
  loading,
  children,
  className,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'btn',
        `btn--${variant}`,
        size && `btn--${size}`,
        block && 'btn--block',
        !children && 'btn--icon',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : Icon && <Icon aria-hidden="true" />}
      {children}
      {IconEnd && !loading && <IconEnd aria-hidden="true" />}
    </button>
  );
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: LucideIcon;
};

/** Enlace con aspecto de botón (para páginas fuera del panel o archivos). */
export function LinkButton({
  variant = 'secondary',
  size,
  block,
  icon: Icon,
  children,
  className,
  ...rest
}: LinkButtonProps) {
  return (
    <a
      className={cx(
        'btn',
        `btn--${variant}`,
        size && `btn--${size}`,
        block && 'btn--block',
        !children && 'btn--icon',
        className,
      )}
      {...rest}
    >
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </a>
  );
}

/** Enlace a otra sección del panel con aspecto de botón. */
export function RouteButton({
  variant = 'secondary',
  size,
  block,
  icon: Icon,
  children,
  className,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size; block?: boolean; icon?: LucideIcon }) {
  return (
    <Link
      className={cx(
        'btn',
        `btn--${variant}`,
        size && `btn--${size}`,
        block && 'btn--block',
        !children && 'btn--icon',
        className,
      )}
      {...rest}
    >
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </Link>
  );
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  icon: LucideIcon;
  label: string;
  size?: 'sm';
  danger?: boolean;
};

export function IconButton({ icon: Icon, label, size, danger, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      className={cx('icon-btn', size && `icon-btn--${size}`, danger && 'icon-btn--danger', className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon aria-hidden="true" />
    </button>
  );
}

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  children?: ReactNode;
  className?: string;
  htmlFor?: string;
  action?: ReactNode;
}

export function Field({ label, hint, error, optional, children, className, htmlFor, action }: FieldProps) {
  return (
    <div className={cx('field', error && 'is-invalid', className)}>
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          <span>
            {label}
            {optional && <small> (opcional)</small>}
          </span>
          {action}
        </label>
      )}
      {children}
      {error ? <p className="field__error">{error}</p> : hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}

type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange'
> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  multiline?: boolean;
  rows?: number;
  value: string | number | null | undefined;
  onValue?: (v: string) => void;
  inputClass?: string;
  action?: ReactNode;
  'data-autofocus'?: boolean;
};

/** Campo con etiqueta: <TextField label="Nombre" value={x} onValue={setX} /> */
export function TextField({
  label,
  hint,
  error,
  optional,
  multiline,
  rows = 3,
  value,
  onValue,
  className,
  inputClass,
  action,
  ...rest
}: TextFieldProps) {
  const id = useId();
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      htmlFor={id}
      className={className}
      action={action}
    >
      {multiline ? (
        <textarea
          id={id}
          className={cx('input', inputClass)}
          value={value ?? ''}
          rows={rows}
          onChange={(e) => onValue?.(e.currentTarget.value)}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          id={id}
          className={cx('input', inputClass)}
          value={value ?? ''}
          onChange={(e) => onValue?.(e.currentTarget.value)}
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
    </Field>
  );
}

export type Option = string | { value: string; label: string; disabled?: boolean };

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  value: string | null | undefined;
  onValue?: (v: string) => void;
  options?: Option[];
  placeholder?: string;
};

export function SelectField({
  label,
  hint,
  error,
  value,
  onValue,
  options = [],
  placeholder,
  className,
  ...rest
}: SelectFieldProps) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} className={className}>
      <select
        id={id}
        className="input"
        value={value ?? ''}
        onChange={(e) => onValue?.(e.currentTarget.value)}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) =>
          typeof o === 'string' ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ),
        )}
      </select>
    </Field>
  );
}

/** Importe que se guarda como número (o '' si el campo está vacío). */
export type MoneyValue = number | '';

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: MoneyValue | string | null | undefined;
  onValue?: (v: MoneyValue) => void;
  big?: boolean;
  'data-autofocus'?: boolean;
};

/** Importe con símbolo de moneda. */
export function MoneyInput({ value, onValue, placeholder = '0', big, className, ...rest }: MoneyInputProps) {
  const [text, setText] = useState(value === '' || value == null ? '' : String(value));
  useEffect(() => {
    const n = text === '' ? '' : Number(text.replace(/,/g, ''));
    if (n !== value && !(Number.isNaN(n) && value === '')) setText(value === '' || value == null ? '' : String(value));
    // Solo cuando cambia el valor desde fuera
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cx('affix affix--pre', className)}>
      <span className="affix__pre" aria-hidden="true">
        {currencySymbol()}
      </span>
      <input
        className={cx('input', big && 'input--big')}
        inputMode="decimal"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
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

export function MoneyField({
  label,
  hint,
  error,
  optional,
  ...rest
}: MoneyInputProps & { label?: ReactNode; hint?: ReactNode; error?: ReactNode; optional?: boolean }) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      <MoneyInput {...rest} />
    </Field>
  );
}

interface SwitchProps {
  checked: boolean | undefined;
  onChange?: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function Switch({ checked, onChange, label, disabled, id }: SwitchProps) {
  return (
    <span className="switch">
      <input
        type="checkbox"
        role="switch"
        id={id}
        checked={!!checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange?.(e.currentTarget.checked)}
      />
      <span className="switch__track" aria-hidden="true" />
    </span>
  );
}

/** Fila con texto e interruptor (lista estilo Ajustes). */
export function SwitchRow({
  title,
  sub,
  checked,
  onChange,
  icon: Icon,
  disabled,
}: {
  title: string;
  sub?: ReactNode;
  checked: boolean | undefined;
  onChange: (v: boolean) => void;
  icon?: LucideIcon;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label className="list__row" htmlFor={id} style={{ cursor: disabled ? 'default' : 'pointer' }}>
      {Icon && (
        <span className="list__icon">
          <Icon />
        </span>
      )}
      <span className="list__body">
        <span className="list__title" style={{ whiteSpace: 'normal' }}>
          {title}
        </span>
        {sub && (
          <span className="list__sub" style={{ whiteSpace: 'normal' }}>
            {sub}
          </span>
        )}
      </span>
      <Switch id={id} checked={checked} onChange={onChange} disabled={disabled} label={title} />
    </label>
  );
}

export interface SegmentOption<V extends string | number> {
  value: V;
  label: ReactNode;
  count?: number;
  icon?: LucideIcon;
}

/** Control segmentado con indicador deslizante. */
export function Segmented<V extends string | number>({
  value,
  onChange,
  options,
  label,
  block,
  size,
  className,
}: {
  value: V;
  onChange: (v: V) => void;
  options: SegmentOption<V>[];
  label?: string;
  block?: boolean;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const counts = options.map((o) => o.count).join();
  useLayoutEffect(() => {
    const root = ref.current;
    const btn = root?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!root || !btn) {
      setThumb(null);
      return;
    }
    setThumb({ x: btn.offsetLeft, w: btn.offsetWidth });
    if (root.scrollWidth > root.clientWidth)
      btn.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [value, options.length, counts]);
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const btn = ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (btn) setThumb({ x: btn.offsetLeft, w: btn.offsetWidth });
    });
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      className={cx('seg', block && 'seg--block', size && `seg--${size}`, className)}
      role="group"
      aria-label={label}
      ref={ref}
    >
      {thumb && (
        <span
          className="seg__thumb"
          style={{ width: `${thumb.w}px`, transform: `translateX(${thumb.x}px)` }}
          aria-hidden="true"
        />
      )}
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className="seg__btn"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <o.icon aria-hidden="true" />}
          {o.label}
          {o.count != null && <span className="seg__count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  pressed,
  onClick,
  children,
  icon: Icon,
  size,
  onRemove,
}: {
  pressed?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  icon?: LucideIcon;
  size?: 'sm';
  onRemove?: () => void;
}) {
  return (
    <button
      type="button"
      className={cx('chip', size && `chip--${size}`)}
      aria-pressed={pressed === undefined ? undefined : pressed}
      onClick={onClick}
    >
      {Icon && <Icon aria-hidden="true" />}
      {children}
      {onRemove && (
        <span
          className="chip__x"
          role="button"
          aria-label="Quitar"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X size={13} />
        </span>
      )}
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  size,
  label = 'Cantidad',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: 'sm';
  label?: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className={cx('stepper', size && `stepper--${size}`)} role="group" aria-label={label}>
      <button type="button" aria-label="Menos" disabled={value <= min} onClick={() => set(value - 1)}>
        <Minus />
      </button>
      <input
        inputMode="numeric"
        value={value}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const n = parseInt(e.currentTarget.value.replace(/\D/g, ''), 10);
          if (!Number.isNaN(n)) set(n);
        }}
      />
      <button type="button" aria-label="Más" disabled={value >= max} onClick={() => set(value + 1)}>
        <Plus />
      </button>
    </div>
  );
}

export function SearchField({
  value,
  onValue,
  placeholder = 'Buscar',
  autoFocus,
  onKeyDown,
  inputRef,
  className,
}: {
  value: string;
  onValue: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}) {
  return (
    <div className={cx('search', className)}>
      <Search aria-hidden="true" />
      <input
        ref={inputRef}
        className="input"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onValue(e.currentTarget.value)}
        onKeyDown={onKeyDown}
        enterKeyHint="search"
      />
      {value && (
        <IconButton className="search__clear" size="sm" icon={X} label="Borrar búsqueda" onClick={() => onValue('')} />
      )}
    </div>
  );
}

export function TagInput({
  value = [],
  onChange,
  placeholder = 'Escribe y presiona Enter',
}: {
  value?: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const add = (text = draft) => {
    const t = text.trim().replace(/,$/, '');
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div className="tag-input">
      {value.map((t) => (
        <Chip key={t} size="sm" onRemove={() => onChange(value.filter((x) => x !== t))}>
          {t}
        </Chip>
      ))}
      <input
        value={draft}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => {
          const v = e.currentTarget.value;
          if (v.endsWith(',')) add(v.slice(0, -1));
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => add()}
      />
    </div>
  );
}

export function PasswordInput({
  value,
  onValue,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onValue: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="affix">
      <input
        className="input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onValue(e.currentTarget.value)}
        style={{ paddingRight: '46px' }}
        {...rest}
      />
      <IconButton
        className="pw-toggle"
        icon={show ? EyeOff : Eye}
        label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        onClick={() => setShow(!show)}
      />
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span>{children}</span>
    </label>
  );
}
