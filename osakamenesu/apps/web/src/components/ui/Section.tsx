import clsx from 'clsx'
import type { ReactNode } from 'react'

type SectionProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  id?: string
  ariaLive?: 'off' | 'polite' | 'assertive'
}

export function Section({
  title,
  subtitle,
  actions,
  className,
  children,
  id,
  ariaLive = 'off',
}: SectionProps) {
  return (
    <section
      id={id}
      aria-live={ariaLive}
      className={clsx('rounded-section bg-neutral-surface p-6 shadow-card', className)}
    >
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-text">{title}</h2>
          {subtitle ? <p className="text-sm text-neutral-textMuted">{subtitle}</p> : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2 text-sm text-neutral-textMuted">{actions}</div>
        ) : null}
      </div>
      <div>{children}</div>
    </section>
  )
}

export default Section
