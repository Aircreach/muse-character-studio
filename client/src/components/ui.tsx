import * as Dialog from '@radix-ui/react-dialog'
import { Slot } from '@radix-ui/react-slot'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * shadcn / Radix-style primitives, hand-written on Tailwind tokens.
 * No Ant Design / MUI runtime. Buttons are text + 1px border only —
 * no pill-capsule label piles, no low-contrast grey text.
 */
export type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger'

const buttonVariant: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  accent: 'btn-accent',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

export function Button({
  variant = 'outline',
  asChild,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={`btn ${buttonVariant[variant]} ${className}`} {...props} />
}

export function StatusMark({
  tone,
  label,
}: {
  tone: 'good' | 'warn' | 'bad' | 'accent' | 'neutral'
  label: string
}) {
  const dot: Record<string, string> = {
    good: 'bg-[#1a7f4b]',
    warn: 'bg-[#9a6700]',
    bad: 'bg-[#b3261e]',
    accent: 'bg-[var(--color-accent)]',
    neutral: 'bg-[var(--color-ink-4)]',
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-ink-2)]">
      <span className={`status-dot ${dot[tone]}`} aria-hidden />
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
  const cls =
    tone === 'good' ? 'badge-good' : tone === 'warn' ? 'badge-warn' : tone === 'accent' ? 'badge-accent' : 'badge-soft'
  return <span className={cls}>{children}</span>
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-2)] px-6 py-12 text-center">
      <p className="text-[15px] font-medium text-[var(--color-ink)]">{title}</p>
      <p className="mt-1 max-w-md text-sm text-[var(--color-ink-3)]">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-[var(--radius-xl)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-lg)] focus:outline-none ${
            wide ? 'max-w-3xl' : 'max-w-lg'
          }`}
        >
          <Dialog.Title className="font-display text-xl text-[var(--color-ink)]">{title}</Dialog.Title>
          <div className="mt-3">{children}</div>
          <Dialog.Close asChild>
            <button type="button" aria-label="关闭" className="absolute right-4 top-4 rounded-md px-2 py-1 text-lg leading-none text-[var(--color-ink-3)] hover:bg-[var(--color-surface-3)]">
              ×
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
