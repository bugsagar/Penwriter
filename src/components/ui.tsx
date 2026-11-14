import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X, Check } from 'lucide-react'

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function IconButton({
  children,
  onClick,
  title,
  className,
  disabled,
  active,
}: {
  children: ReactNode
  onClick?: () => void
  title?: string
  className?: string
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors',
        'hover:bg-ink-100 hover:text-ink-800 disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-ink-500',
        'dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100 dark:disabled:hover:bg-transparent dark:disabled:hover:text-ink-400',
        active && 'bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-ink-50',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Button({
  children,
  onClick,
  variant = 'default',
  className,
  disabled,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  className?: string
  disabled?: boolean
  title?: string
}) {
  const styles: Record<string, string> = {
    default:
      'border border-ink-200 bg-white text-ink-800 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:hover:bg-ink-800',
    primary:
      'bg-ink-900 text-white hover:bg-ink-800 dark:bg-ink-50 dark:text-ink-900 dark:hover:bg-ink-200',
    ghost:
      'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100',
    danger:
      'border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40',
  }
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40',
        styles[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/40 p-3 pt-[6vh] sm:p-6 sm:pt-[12vh] backdrop-blur-[2px] dark:bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={cn(
          'animate-fade-slide-in w-full rounded-xl border border-ink-200 bg-white shadow-lift dark:border-ink-800 dark:bg-ink-900',
          width,
        )}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5 dark:border-ink-800">
          <h2 className="text-sm font-semibold tracking-tight text-ink-900 dark:text-ink-50">
            {title}
          </h2>
          <IconButton onClick={onClose} title="Close">
            <X size={16} />
          </IconButton>
        </div>
        <div className="px-4 py-4 sm:px-5">{children}</div>
      </div>
    </div>
  )
}

export function Dropdown({
  trigger,
  children,
  align = 'right',
}: {
  trigger: ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            'animate-fade-slide-in absolute z-40 mt-1.5 min-w-44 overflow-hidden rounded-lg border border-ink-200 bg-white py-1 shadow-lift dark:border-ink-700 dark:bg-ink-900',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  icon,
  label,
  onClick,
  danger,
  hint,
}: {
  icon?: ReactNode
  label: string
  onClick?: () => void
  danger?: boolean
  hint?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors',
        danger
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
          : 'text-ink-700 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-50',
      )}
    >
      {icon && <span className="text-ink-400 dark:text-ink-500">{icon}</span>}
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[11px] text-ink-400 dark:text-ink-500">{hint}</span>}
    </button>
  )
}

/** A destructive menu item that requires a second click to confirm. */
export function ConfirmItem({
  icon,
  label,
  onConfirm,
  hint,
}: {
  icon?: ReactNode
  label: string
  onConfirm: () => void
  hint?: string
}) {
  const [armed, setArmed] = useState(false)
  if (armed) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5">
        <span className="flex-1 pl-1 text-[12.5px] text-red-600 dark:text-red-400">
          Delete {label.toLowerCase()}?
        </span>
        <button
          type="button"
          onClick={() => {
            setArmed(false)
            onConfirm()
          }}
          className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="rounded p-1 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
        >
          <X size={14} />
        </button>
      </div>
    )
  }
  return (
    <MenuItem
      icon={icon}
      label={label}
      danger
      hint={hint}
      onClick={() => setArmed(true)}
    />
  )
}
