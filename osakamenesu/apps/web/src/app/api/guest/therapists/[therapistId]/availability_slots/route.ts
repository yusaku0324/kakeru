import { NextRequest, NextResponse } from 'next/server'

import { resolveInternalApiBase } from '@/lib/server-config'
import {
  generateWeekDateRangeWithToday,
} from '@/lib/availability-date-range'

const API_BASE = resolveInternalApiBase().replace(/\/+$/, '')

type AvailabilitySlot = {
  start_at: string
  end_at: string
}

type DaySlots = {
  date: string
  is_today: boolean
  slots: Array<{ start_at: string; end_at: string; status: 'open' | 'tentative' | 'blocked' }>
}

function generateTimeSlots(
  dateStr: string,
  availableSlots: AvailabilitySlot[],
  isToday: boolean,
): DaySlots['slots'] {
  // If no available slots, return empty array (no blocked slots needed)
  if (availableSlots.length === 0) {
    return []
  }

  const slots: DaySlots['slots'] = []
  const slotDuration = 30 // 30 minutes per slot

  // Determine time range from available slots (with 1-hour buffer)
  //
  // IMPORTANT: This route runs on server runtimes where TZ can be UTC (e.g. Vercel).
  // We must compute the time window in JST explicitly; otherwise dayEnd < dayStart
  // and the calendar renders as "空き状況未登録" even when slots exist.
  const dayBaseJst = new Date(`${dateStr}T00:00:00+09:00`)
  let minHour = 24
  let maxHour = 0
  for (const avail of availableSlots) {
    const start = new Date(avail.start_at)
    const end = new Date(avail.end_at)
    const startMinutes = Math.floor((start.getTime() - dayBaseJst.getTime()) / (60 * 1000))
    const endMinutes = Math.ceil((end.getTime() - dayBaseJst.getTime()) / (60 * 1000))
    minHour = Math.min(minHour, Math.floor(startMinutes / 60))
    maxHour = Math.max(maxHour, Math.ceil(endMinutes / 60))
  }

  // Add 1-hour buffer before and after, capped at reasonable hours
  const dayStart = Math.max(9, minHour - 1)
  const dayEnd = Math.min(24, maxHour + 1)

  for (let hour = dayStart; hour < dayEnd; hour++) {
    for (let minute = 0; minute < 60; minute += slotDuration) {
      const slotStart = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`)
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000)

      // Check if this slot overlaps with any available slot
      let status: 'open' | 'tentative' | 'blocked' = 'blocked'
      for (const avail of availableSlots) {
        const availStart = new Date(avail.start_at)
        const availEnd = new Date(avail.end_at)
        // Check if slot is within an available range
        if (slotStart >= availStart && slotEnd <= availEnd) {
          status = 'open'
          break
        }
      }

      slots.push({
        start_at: slotStart.toISOString(),
        end_at: slotEnd.toISOString(),
        status,
      })
    }
  }

  return slots
}

async function fetchDaySlots(therapistId: string, dateStr: string): Promise<AvailabilitySlot[]> {
  try {
    const resp = await fetch(
      `${API_BASE}/api/guest/therapists/${therapistId}/availability_slots?date=${dateStr}`,
      { method: 'GET', cache: 'no-store' },
    )
    if (!resp.ok) return []
    const data = await resp.json()
    return Array.isArray(data?.slots) ? data.slots : []
  } catch {
    return []
  }
}

async function fetchWeekAvailability(therapistId: string): Promise<{ days: DaySlots[] }> {
  // Use tested pure function for date range generation
  const weekDates = generateWeekDateRangeWithToday()
  const days: DaySlots[] = []

  // Fetch all dates in parallel with error handling
  const datePromises = weekDates.map(({ date, is_today }) =>
    fetchDaySlots(therapistId, date)
      .then((slots) => ({ dateStr: date, slots, isToday: is_today }))
      .catch(() => ({ dateStr: date, slots: [] as AvailabilitySlot[], isToday: is_today }))
  )

  const results = await Promise.all(datePromises)

  for (const { dateStr, slots: availableSlots, isToday } of results) {
    const timeSlots = generateTimeSlots(dateStr, availableSlots, isToday)
    days.push({
      date: dateStr,
      is_today: isToday,
      slots: timeSlots,
    })
  }

  return { days }
}

async function proxyAvailabilitySlots(request: NextRequest, therapistId: string) {
  const url = new URL(request.url)
  const dateParam = url.searchParams.get('date')

  // If no date param, fetch week availability (for calendar view)
  if (!dateParam) {
    try {
      const weekData = await fetchWeekAvailability(therapistId)
      return NextResponse.json(weekData)
    } catch {
      return NextResponse.json({ detail: 'availability slots unavailable' }, { status: 503 })
    }
  }

  // Single day fetch (original behavior)
  try {
    const resp = await fetch(
      `${API_BASE}/api/guest/therapists/${therapistId}/availability_slots?date=${dateParam}`,
      { method: 'GET', cache: 'no-store' },
    )
    const text = await resp.text()
    let json: unknown = null
    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = { detail: text }
      }
    }
    return NextResponse.json(json, { status: resp.status })
  } catch {
    return NextResponse.json({ detail: 'availability slots unavailable' }, { status: 503 })
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ therapistId: string }> }) {
  const { therapistId } = await context.params
  return proxyAvailabilitySlots(request, therapistId)
}
