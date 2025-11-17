import type { ReservationContactItem } from '../types'

type ReservationContactListProps = {
  items: ReservationContactItem[]
}

export function ReservationContactList({ items }: ReservationContactListProps) {
  return (
    <ul className="mt-4 space-y-3 text-sm">
      {items.map((item) => (
        <li
          key={item.key}
          className="flex flex-col gap-1 rounded-[24px] border border-white/70 bg-white/90 px-4 py-3 shadow-sm shadow-brand-primary/10"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-neutral-text">{item.label}</span>
            <span className="text-xs font-semibold text-brand-primary">{item.value}</span>
          </div>
          <span className="text-[11px] text-neutral-textMuted">{item.helper}</span>
        </li>
      ))}
    </ul>
  )
}
