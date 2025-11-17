import clsx from 'clsx'
import type { ReactNode } from 'react'

type BadgeVariant = 'brand' | 'neutral' | 'outline' | 'success' | 'danger'

const VARIANT_MAP: Record<BadgeVariant, string> = {
  brand: 'bg-brand-primary text-white shadow-sm',
  neutral: 'bg-neutral-surfaceAlt text-neutral-text border border-neutral-borderLight',
  outline: 'bg-neutral-surface text-neutral-text border border-neutral-borderLight',
  success: 'bg-state-successBg text-state-successText',
  danger: 'bg-state-dangerBg text-state-dangerText',
}

export type BadgeProps = {
  children: ReactNode
  className?: string
  variant?: BadgeVariant
  leadingIcon?: ReactNode
}

export function Badge({ children, className, variant = 'neutral', leadingIcon }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase',
        'shadow-[0_1px_2px_rgba(15,23,42,0.12)]',
        VARIANT_MAP[variant],
        className,
      )}
    >
      {leadingIcon ? (
        <span className="grid place-items-center text-[10px]">{leadingIcon}</span>
      ) : null}
      <span>{children}</span>
    </span>
  )
}

export default Badge
