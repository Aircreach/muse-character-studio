import * as Dialog from '@radix-ui/react-dialog'
import { Slot } from '@radix-ui/react-slot'
import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Icon, type IconName } from './icons'

/**
 * Theme primitives. Callers pass variant / size / tone.
 * Visuals live in theme.css (Linear app chrome).
 */
export type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

const buttonVariant: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  accent: 'btn-primary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

export function Button({
  variant = 'outline',
  size = 'md',
  asChild,
  className = '',
  type,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}) {
  const Comp = asChild ? Slot : 'button'
  const classes = `btn btn-${size} ${buttonVariant[variant]} ${className}`.trim()
  if (asChild) return <Comp className={classes} {...props} />
  return <Comp className={classes} type={type ?? 'button'} {...props} />
}

/** Cover image that collapses to `fallback` instead of the browser's broken-image icon. */
export function MediaImage({
  src,
  alt,
  className = 'media-img',
  fallback = null,
}: {
  src: string
  alt: string
  className?: string
  fallback?: ReactNode
}) {
  const [failed, setFailed] = useState(false)
  if (failed) return <>{fallback}</>
  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
}

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`field-input ${className}`.trim()} {...props} />
}

export function SearchInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`search-field ${className}`.trim()}>
      <Icon name="search" />
      <input className="field-input" {...props} />
    </label>
  )
}

export function TextArea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`field-input field-area ${className}`.trim()} {...props} />
}

export function SelectInput({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`field-input ${className}`.trim()} {...props} />
}

export function Field({
  label,
  children,
  wide,
  className = '',
}: {
  label: string
  children: ReactNode
  wide?: boolean
  className?: string
}) {
  return (
    <label className={`field ${wide ? 'span-2' : ''} ${className}`.trim()}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

export function Panel({
  title,
  note,
  children,
  actions,
  className = '',
}: {
  title?: string
  note?: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      {title || actions ? (
        <header className="panel-head">
          <div>
            {title ? <h2 className="panel-title">{title}</h2> : null}
            {note ? <p className="panel-note">{note}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="panel-body">{children}</div>
    </section>
  )
}

const DOT = {
  good: 'dot-good',
  warn: 'dot-warn',
  bad: 'dot-bad',
  accent: 'dot-accent',
  neutral: 'dot-neutral',
} as const

export function StatusMark({ tone, label }: { tone: keyof typeof DOT; label: string }) {
  return (
    <span className="status-mark">
      <span className={`status-dot ${DOT[tone]}`} aria-hidden />
      {label}
    </span>
  )
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'good' | 'warn' | 'accent'
  children: ReactNode
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function EmptyState({
  title,
  body,
  action,
  icon = 'mark',
}: {
  title: string
  body: string
  action?: ReactNode
  icon?: IconName
}) {
  return (
    <div className="empty">
      <span className="empty-mark">
        <Icon name={icon} size={20} />
      </span>
      <p className="empty-title">{title}</p>
      <p className="empty-body">{body}</p>
      {action ? <div className="cluster">{action}</div> : null}
    </div>
  )
}

export function LoadingNote({ children }: { children: ReactNode }) {
  return (
    <div className="loading-note" role="status">
      <span className="spinner" aria-hidden />
      <p>{children}</p>
    </div>
  )
}

export function Notice({
  tone = 'neutral',
  floating,
  children,
}: {
  tone?: 'neutral' | 'good'
  floating?: boolean
  children: ReactNode
}) {
  const toneClass = tone === 'good' ? 'notice notice-good' : 'notice'
  return <div role="status" className={floating ? `${toneClass} notice-float` : toneClass}>{children}</div>
}

export function Segmented({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string; icon?: IconName }>
  ariaLabel: string
  className?: string
}) {
  return (
    <div className={`seg ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="seg-btn"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.icon ? <Icon name={o.icon} size={14} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function TabBar({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string; icon?: IconName }>
  ariaLabel: string
  className?: string
}) {
  return (
    <nav className={`tabs ${className}`.trim()} aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="tab"
          aria-current={value === o.value ? 'page' : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.icon ? <Icon name={o.icon} size={15} /> : null}
          {o.label}
        </button>
      ))}
    </nav>
  )
}

/** Radix Dialog wrapper — used by PreviewDialog and ConfirmDialog. */
export function Modal({
  open,
  onOpenChange,
  title,
  children,
  wide,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={`modal ${wide ? 'modal-wide' : 'modal-narrow'}`}>
          <Dialog.Title className="modal-title">{title}</Dialog.Title>
          <div className="modal-body">{children}</div>
          <Dialog.Close asChild>
            <button type="button" aria-label="关闭" className="modal-close">
              <Icon name="close" size={16} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
