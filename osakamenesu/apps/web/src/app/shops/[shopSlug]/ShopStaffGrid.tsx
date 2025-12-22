'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { openReservationOverlay } from '@/components/reservationOverlayBus'

type AvailabilitySlot = {
  start_at: string
  end_at: string
  status: 'open' | 'tentative' | 'blocked'
}

type AvailabilityDay = {
  date: string
  is_today?: boolean | null
  slots: AvailabilitySlot[]
}

export type StaffMember = {
  id: string
  name: string
  alias?: string | null
  avatar_url?: string | null
  headline?: string | null
  specialties?: string[]
  today_available?: boolean
  next_available_at?: string | null
}

type ShopStaffGridProps = {
  staff: StaffMember[]
  shopId: string
  shopSlug: string
  shopName: string
  shopArea?: string | null
  shopAreaName?: string | null
}

function formatNextAvailableLabel(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const nextDate = new Date(dateStr)
  if (Number.isNaN(nextDate.getTime())) return null
  const now = new Date()
  const isToday =
    nextDate.getFullYear() === now.getFullYear() &&
    nextDate.getMonth() === now.getMonth() &&
    nextDate.getDate() === now.getDate()
  const hours = nextDate.getHours()
  const minutes = nextDate.getMinutes()
  const timeStr = minutes === 0 ? `${hours}時` : `${hours}時${minutes}分`
  if (isToday) {
    return `次回 ${timeStr}から`
  }
  const month = nextDate.getMonth() + 1
  const day = nextDate.getDate()
  return `${month}月${day}日 ${timeStr}から`
}

async function fetchTherapistAvailability(therapistId: string): Promise<AvailabilityDay[]> {
  try {
    const resp = await fetch(`/api/guest/therapists/${therapistId}/availability_slots`)
    if (!resp.ok) return []
    const data = await resp.json()
    return Array.isArray(data?.days) ? data.days : []
  } catch {
    return []
  }
}

export function ShopStaffGrid({
  staff,
  shopId,
  shopSlug,
  shopName,
  shopArea,
  shopAreaName,
}: ShopStaffGridProps) {
  const [loadingTherapistId, setLoadingTherapistId] = useState<string | null>(null)

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-text">
        在籍セラピスト ({staff.length}人)
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {staff.map((member) => {
          const availabilityLabel = member.today_available
            ? '本日空きあり'
            : formatNextAvailableLabel(member.next_available_at)
          return (
            <div
              key={member.id}
              className="group rounded-xl bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <Link
                href={`/shops/${shopSlug}/therapists/${member.id}`}
                className="block"
              >
                <div className="relative aspect-square overflow-hidden bg-neutral-100">
                  {member.avatar_url ? (
                    <Image
                      src={member.avatar_url}
                      alt={member.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl font-semibold text-neutral-textMuted">
                      {member.name.slice(0, 1)}
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-2.5 space-y-2">
                <div className="text-center">
                  <Link
                    href={`/shops/${shopSlug}/therapists/${member.id}`}
                    className="text-sm font-semibold text-neutral-text hover:text-brand-primary transition"
                  >
                    {member.name}
                  </Link>
                  {availabilityLabel && (
                    <p className={`mt-1 text-[11px] font-medium ${
                      member.today_available
                        ? 'text-green-600'
                        : 'text-amber-600'
                    }`}>
                      {availabilityLabel}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={loadingTherapistId === member.id}
                  onClick={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setLoadingTherapistId(member.id)
                    try {
                      const availabilityDays = await fetchTherapistAvailability(member.id)
                      openReservationOverlay({
                        hit: {
                          id: member.id,
                          therapistId: member.id,
                          staffId: member.id,
                          name: member.name,
                          alias: member.alias ?? null,
                          headline: member.headline ?? null,
                          specialties: member.specialties ?? [],
                          avatarUrl: member.avatar_url ?? null,
                          rating: null,
                          reviewCount: null,
                          shopId: shopId,
                          shopSlug: shopSlug,
                          shopName: shopName,
                          shopArea: shopArea ?? '',
                          shopAreaName: shopAreaName ?? null,
                          todayAvailable: member.today_available ?? null,
                          nextAvailableSlot: member.next_available_at
                            ? { start_at: member.next_available_at, status: 'ok' }
                            : null,
                        },
                        defaultStart: member.next_available_at ?? null,
                        availabilityDays: availabilityDays.length > 0 ? availabilityDays : undefined,
                      })
                    } finally {
                      setLoadingTherapistId(null)
                    }
                  }}
                  className="w-full rounded-lg bg-brand-primary py-2 text-xs font-semibold text-white transition hover:bg-brand-primary/90 active:scale-[0.98] disabled:opacity-50"
                >
                  {loadingTherapistId === member.id ? '読み込み中...' : '予約する'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
