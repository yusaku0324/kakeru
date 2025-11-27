type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | string

type Props = {
  status: ReservationStatus
  className?: string
  size?: 'sm' | 'md'
}

const styles: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800 border border-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-700 border border-slate-200',
}

export function ReservationStatusBadge({ status, className = '', size = 'sm' }: Props) {
  const normalized = (status || '').toLowerCase()
  const base =
    'inline-flex items-center rounded-full font-semibold leading-tight ' +
    (size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]')
  const color = styles[normalized] || 'bg-slate-100 text-slate-700 border border-slate-200'

  return <span className={`${base} ${color} ${className}`.trim()}>{status || '-'}</span>
}

export type { ReservationStatus }
