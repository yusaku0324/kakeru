import clsx from 'clsx'

const ICON_GRADIENT = 'bg-gradient-to-br from-[#FF6800] to-[#F2549D] text-white'
const ICON_SHADOW = 'shadow-[0_10px_20px_rgba(242,84,157,0.35)]'

const PILL_GRADIENT = 'bg-gradient-to-r from-[#FF6800]/12 via-[#F2549D]/12 to-[#FF6800]/12'
const PILL_BORDER = 'border border-white/60'

const QUICK_ICON_GRADIENT = 'bg-gradient-to-br from-[#3B82F6] via-[#2563EB] to-[#38BDF8] text-white'
const QUICK_ICON_SHADOW = 'shadow-[0_12px_30px_rgba(59,130,246,0.35)]'

export function FeaturedSectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-2">
      <span
        className={clsx(
          'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-primary shadow-sm shadow-brand-primary/10',
          PILL_BORDER,
          PILL_GRADIENT,
        )}
      >
        <span
          aria-hidden
          className={clsx(
            'inline-flex h-6 w-6 items-center justify-center rounded-full text-[13px]',
            ICON_GRADIENT,
            ICON_SHADOW,
          )}
        >
          ✦
        </span>
        人気のセラピスト
      </span>
      <div className="flex flex-wrap items-end gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-text">{title}</h2>
        {subtitle ? <p className="text-sm text-neutral-textMuted">{subtitle}</p> : null}
      </div>
    </div>
  )
}

export function QuickFiltersHeading() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className={clsx(
          'inline-flex h-10 w-10 items-center justify-center rounded-full text-lg',
          QUICK_ICON_GRADIENT,
          QUICK_ICON_SHADOW,
        )}
      >
        ⚙️
      </span>
      <div>
        <h2 className="text-lg font-semibold text-neutral-text">クイックフィルター</h2>
        <p className="text-xs text-neutral-textMuted">
          ワンタップでおすすめの条件をセットできます。
        </p>
      </div>
    </div>
  )
}
