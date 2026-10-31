import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  useCallback,
  useEffect,
  useId,
  useRef,
} from 'react';
import { X } from 'lucide-react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'subtle' | 'danger';
type ButtonSize = 'sm' | 'md' | 'icon' | 'icon-sm';

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 select-none';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:opacity-90 active:opacity-80 shadow-sm',
  outline: 'border border-line-strong text-ink hover:bg-elevated',
  ghost: 'text-muted hover:text-ink hover:bg-elevated',
  subtle: 'bg-elevated text-ink border border-line hover:border-line-strong',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  icon: 'h-10 w-10',
  'icon-sm': 'h-8 w-8',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = 'subtle', size = 'md', className, ...rest }: ButtonProps) {
  return <button className={cx(buttonBase, variantClasses[variant], sizeClasses[size], className)} {...rest} />;
}

export function IconButton({
  label,
  className,
  variant = 'ghost',
  size = 'icon-sm',
  ...rest
}: ButtonProps & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(buttonBase, variantClasses[variant], sizeClasses[size], className)}
      {...rest}
    />
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'work' | 'shoulder' | 'night' | 'weekend' | 'danger';
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'border-line bg-panel-soft text-muted',
    accent: 'border-accent/30 bg-accent-soft text-accent',
    work: 'border-work/30 text-work bg-work/10',
    shoulder: 'border-shoulder/30 text-shoulder bg-shoulder/10',
    night: 'border-night/30 text-night bg-night/10',
    weekend: 'border-weekend/30 text-weekend bg-weekend/10',
    danger: 'border-danger/30 text-danger bg-danger/10',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
  testId,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-testid={testId}
      className={cx('inline-flex min-h-8 items-center rounded-lg border border-line bg-panel-soft p-0.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded-[7px] px-2.5 py-[5px] text-[13px] font-medium transition-colors',
              active ? 'bg-elevated text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  id?: string;
}) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={inputId} className="block text-sm font-medium text-ink">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p> : null}
      </div>
      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition-colors',
          checked ? 'border-accent bg-accent' : 'border-line-strong bg-panel-soft',
        )}
      >
        <span
          className={cx(
            'absolute rounded-full bg-white shadow transition-all',
            checked ? 'left-[25px]' : 'left-[3px]',
          )}
          style={{ height: 20, width: 20, top: 3 }}
        />
      </button>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cx('min-w-0', className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-xs leading-5 text-muted">{hint}</p> : null}
    </div>
  );
}

const controlBase =
  'h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm text-ink transition-colors placeholder:text-muted/70 hover:border-line-strong focus:border-accent focus:outline-none';

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(controlBase, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(controlBase, 'cursor-pointer pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), select, textarea, button',
      );
      focusable?.focus();
    }, 30);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previous;
      window.clearTimeout(timer);
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line bg-panel shadow-[var(--tb-shadow-pop)]',
          'rounded-t-2xl sm:rounded-2xl',
          width === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description ? <p className="mt-1 text-xs leading-5 text-muted">{description}</p> : null}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-1 -mt-1">
            <X size={16} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-line px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[13px] font-semibold tracking-[0.08em] text-muted uppercase">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {subtitle ? (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-muted sm:text-sm">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
