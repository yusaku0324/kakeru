import Link from 'next/link'
import clsx from 'clsx'

export type BreadcrumbItem = {
  label: string
  href?: string
}

type BreadcrumbProps = {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav
      aria-label="パンくずリスト"
      className={clsx('text-sm text-neutral-textMuted', className)}
    >
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={item.label} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="transition hover:text-brand-primary hover:underline underline-offset-2"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={clsx(isLast && 'text-neutral-text font-medium')}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <span aria-hidden className="text-neutral-textMuted/60">
                  /
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
