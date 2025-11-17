'use client'

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  pending: '承認待ち',
  confirmed: '承認済み',
  declined: '辞退済み',
  cancelled: 'キャンセル',
  expired: '期限切れ',
}

export const RESERVATION_STATUS_BADGES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border border-amber-200',
  confirmed: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  declined: 'bg-rose-100 text-rose-700 border border-rose-200',
  cancelled: 'bg-neutral-200 text-neutral-700 border border-neutral-300',
  expired: 'bg-neutral-200 text-neutral-600 border border-neutral-300',
}

export const RESERVATION_STATUS_ICONS: Record<string, string> = {
  pending: '🟡',
  confirmed: '🟢',
  declined: '🔴',
  cancelled: '⚪️',
  expired: '⚪️',
}

export function getReservationStatusLabel(status?: string | null): string | null {
  if (!status) return null
  return RESERVATION_STATUS_LABELS[status] ?? status
}

export function getReservationStatusDisplay(status?: string | null): string | null {
  const label = getReservationStatusLabel(status)
  if (!label) return null
  const icon = status ? RESERVATION_STATUS_ICONS[status] : undefined
  return icon ? `${icon} ${label}` : label
}
