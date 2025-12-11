import { NextRequest, NextResponse } from 'next/server'

import { resolveInternalApiBase } from '@/lib/server-config'

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

function formatDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  let minHour = 24
  let maxHour = 0
  for (const avail of availableSlots) {
    const start = new Date(avail.start_at)
    const end = new Date(avail.end_at)
    minHour = Math.min(minHour, start.getHours())
    maxHour = Math.max(maxHour, end.getHours() + (end.getMinutes() > 0 ? 1 : 0))
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
  const today = new Date()
  const todayStr = formatDate(today)
  const days: DaySlots[] = []

  // Fetch 7 days in parallel with error handling
  const datePromises: Promise<{ dateStr: string; slots: AvailabilitySlot[] }>[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const dateStr = formatDate(d)
    datePromises.push(
      fetchDaySlots(therapistId, dateStr)
        .then((slots) => ({ dateStr, slots }))
        .catch(() => ({ dateStr, slots: [] })),
    )
  }

  const results = await Promise.all(datePromises)

  for (const { dateStr, slots: availableSlots } of results) {
    const isToday = dateStr === todayStr
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
