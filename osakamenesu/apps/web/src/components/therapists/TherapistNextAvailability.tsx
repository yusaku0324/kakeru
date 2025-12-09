import { formatSlotJp, type ScheduleSlot } from '@/lib/schedule'
import { type NextAvailableSlotPayload } from '@/lib/nextAvailableSlot'

type NextAvailableSlotInput = {
  start_at: string
  status: 'ok' | 'maybe'
}

type Props = {
  slot?: NextAvailableSlotInput | NextAvailableSlotPayload | null
  todayAvailable?: boolean | null
  className?: string
  variant?: 'badge' | 'text'
}

function toScheduleSlot(slot: NextAvailableSlotInput | NextAvailableSlotPayload | null | undefined): ScheduleSlot | null {
  if (!slot?.start_at) return null
  return {
    start_at: slot.start_at,
    end_at: slot.start_at,
    status: slot.status === 'ok' ? 'open' : 'tentative',
  }
}

export function TherapistNextAvailability({
  slot,
  todayAvailable,
  className = '',
  variant = 'badge',
}: Props) {
  const scheduleSlot = toScheduleSlot(slot)
  const label = scheduleSlot
    ? formatSlotJp(scheduleSlot, { fallbackLabel: null })
    : todayAvailable
      ? '本日空きあり'
      : null

  if (!label) return null

  if (variant === 'text') {
    return <span className={className}>{label}</span>
  }

  const isToday = label.startsWith('本日')
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-lg backdrop-blur-sm ${
        isToday ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'
      } ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isToday ? 'bg-white animate-pulse' : 'bg-white/80'}`}
      />
      {label}
    </div>
  )
}

export default TherapistNextAvailability
