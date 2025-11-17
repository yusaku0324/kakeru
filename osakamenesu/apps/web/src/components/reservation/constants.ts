import { AVAILABILITY_STATUS_META, type AvailabilityStatus } from '@/components/calendar/types'

export const RESERVATION_LEGEND_ITEMS = [
  {
    key: 'open',
    label: AVAILABILITY_STATUS_META.open.label,
    icon: '●',
    iconClass: 'border-emerald-400 bg-emerald-500 text-white',
  },
  {
    key: 'tentative',
    label: AVAILABILITY_STATUS_META.tentative.label,
    icon: AVAILABILITY_STATUS_META.tentative.icon,
    iconClass: 'border-amber-300 bg-amber-100 text-amber-600',
  },
  {
    key: 'blocked',
    label: AVAILABILITY_STATUS_META.blocked.label,
    icon: AVAILABILITY_STATUS_META.blocked.icon,
    iconClass: 'border-white/70 bg-white text-neutral-textMuted',
  },
] as const

export const RESERVATION_STATUS_BADGE_CLASSES: Record<AvailabilityStatus, string> = {
  open: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600',
  tentative: 'border-amber-500/40 bg-amber-500/15 text-amber-600',
  blocked: 'border-neutral-borderLight/70 bg-neutral-borderLight/30 text-neutral-textMuted',
}
