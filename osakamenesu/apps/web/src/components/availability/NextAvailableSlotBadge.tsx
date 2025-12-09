'use client'

import clsx from 'clsx'
import { formatSlotJp, type ScheduleSlot } from '@/lib/schedule'

export type NextAvailableSlotPayload = {
  start_at: string
  end_at?: string | null
  status?: string | null
}

export type SlotInput = {
  start_at: string
  end_at?: string | null
  status?: string | null
}

function toScheduleSlot(slot: SlotInput | null): ScheduleSlot | null {
  if (!slot?.start_at) return null
  return {
    start_at: slot.start_at,
    end_at: slot.end_at || slot.start_at,
    status: slot.status === 'ok' || slot.status === 'open' ? 'open' : 'tentative',
  }
}

export function formatNextSlotLabel(
  slot: SlotInput | null,
  todayAvailable?: boolean | null,
): string | null {
  const scheduleSlot = toScheduleSlot(slot)
  if (scheduleSlot) {
    const label = formatSlotJp(scheduleSlot, { fallbackLabel: null })
    if (label) return label
  }
  if (todayAvailable) return '本日空きあり'
  return null
}

export type NextAvailableSlotBadgeVariant = 'overlay' | 'inline' | 'compact'

type Props = {
  slot?: SlotInput | null
  todayAvailable?: boolean | null
  variant?: NextAvailableSlotBadgeVariant
  className?: string
}

export function NextAvailableSlotBadge({
  slot,
  todayAvailable,
  variant = 'inline',
  className = '',
}: Props) {
  const label = formatNextSlotLabel(slot ?? null, todayAvailable)
  if (!label) return null

  const isToday = todayAvailable || label.startsWith('本日')

  if (variant === 'overlay') {
    return (
      <div
        className={clsx(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-lg backdrop-blur-sm',
          isToday ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white',
          className
        )}
      >
        <span
          className={clsx(
            'h-1.5 w-1.5 rounded-full',
            isToday ? 'bg-white animate-pulse' : 'bg-white/80'
          )}
        />
        {label}
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
          isToday
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-amber-100 text-amber-700',
          className
        )}
      >
        <span
          className={clsx(
            'h-1 w-1 rounded-full',
            isToday ? 'bg-emerald-500' : 'bg-amber-500'
          )}
        />
        {label}
      </span>
    )
  }

  // inline (default)
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold',
        isToday
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700',
        className
      )}
    >
      <span
        className={clsx(
          'h-1.5 w-1.5 rounded-full',
          isToday ? 'bg-emerald-500' : 'bg-amber-500'
        )}
      />
      {label}
    </span>
  )
}

export default NextAvailableSlotBadge
