"use client"

type HeroStatItem = {
  label: string
  value: string | number
  helper: string
}

export function HeroStats({ stats }: { stats: HeroStatItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((item) => (
        <div
          key={item.label}
          className="rounded-[28px] border border-white/50 bg-white/80/80 px-4 py-6 text-center shadow-glass backdrop-blur-sm"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-textMuted">{item.label}</div>
          <div className="mt-2 text-3xl font-bold text-neutral-text">{item.value}</div>
          <div className="mt-1 text-xs text-neutral-textMuted">{item.helper}</div>
        </div>
      ))}
    </div>
  )
}
