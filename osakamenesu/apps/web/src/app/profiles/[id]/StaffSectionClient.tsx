'use client'

import Link from 'next/link'
import SafeImage from '@/components/SafeImage'
import { Section } from '@/components/ui/Section'
import { openReservationOverlay } from '@/components/reservationOverlayBus'
import type { TherapistHit } from '@/components/staff/TherapistCard'
import { nextSlotPayloadToScheduleSlot, type NextAvailableSlotPayload } from '@/lib/nextAvailableSlot'
import { formatSlotJp } from '@/lib/schedule'

type StaffMember = {
  id: string
  name: string
  alias?: string | null
  headline?: string | null
  avatar_url?: string | null
  rating?: number | null
  review_count?: number | null
  specialties?: string[] | null
  today_available?: boolean | null
  next_available_slot?: NextAvailableSlotPayload | null
}

type Props = {
  staff: StaffMember[]
  shopId: string
  shopSlug: string | null
  shopName: string
  shopArea: string
  shopAreaName?: string | null
}

export default function StaffSectionClient({ staff, shopId, shopSlug, shopName, shopArea, shopAreaName }: Props) {
  if (!staff.length) return null

  const handleReserve = (member: StaffMember) => {
    const hit: TherapistHit = {
      id: member.id,
      therapistId: member.id,
      staffId: member.id,
      name: member.name,
      alias: member.alias ?? null,
      headline: member.headline ?? null,
      specialties: member.specialties ?? [],
      avatarUrl: member.avatar_url ?? null,
      rating: member.rating ?? null,
      reviewCount: member.review_count ?? null,
      shopId,
      shopSlug,
      shopName,
      shopArea,
      shopAreaName: shopAreaName ?? null,
      todayAvailable: member.today_available ?? null,
      nextAvailableSlot: member.next_available_slot ?? null,
    }
    openReservationOverlay({
      hit,
      defaultStart: member.next_available_slot?.start_at ?? null,
    })
  }

  return (
    <Section
      id="staff-section"
      title={`セラピスト (${staff.length}名)`}
      subtitle="人気のセラピストを一部ご紹介"
      className="shadow-none border border-neutral-borderLight bg-neutral-surface"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {staff.map((member) => {
          const nextSlotEntity = nextSlotPayloadToScheduleSlot(member.next_available_slot ?? null)
          const formattedSlot = formatSlotJp(nextSlotEntity)
          const availabilityLabel = member.today_available
            ? '本日空きあり'
            : formattedSlot
              ? `次回 ${formattedSlot}`
              : null
          return (
            <div
              key={member.id}
              id={`staff-${member.id}`}
              className="group rounded-xl bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow scroll-mt-20"
            >
              <Link
                href={`/profiles/${shopSlug || shopId}/staff/${member.id}`}
                className="block"
              >
                {/* Image - square aspect ratio */}
                <div className="relative aspect-square overflow-hidden bg-neutral-100">
                  <SafeImage
                    src={member.avatar_url || undefined}
                    alt={`${member.name}の写真`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    fallbackSrc="/images/placeholder-avatar.svg"
                  />
                </div>
              </Link>
              {/* Info & Button */}
              <div className="p-2.5 space-y-2">
                <div className="text-center">
                  <Link
                    href={`/profiles/${shopSlug || shopId}/staff/${member.id}`}
                    className="text-sm font-semibold text-neutral-text hover:text-brand-primary transition"
                  >
                    {member.name}
                  </Link>
                  {member.rating ? (
                    <div className="flex items-center justify-center gap-1 text-xs mt-0.5">
                      <span className="text-amber-500">★</span>
                      <span className="font-medium text-neutral-text">{member.rating.toFixed(1)}</span>
                      {member.review_count ? (
                        <span className="text-neutral-textMuted">({member.review_count}件)</span>
                      ) : null}
                    </div>
                  ) : null}
                  {availabilityLabel ? (
                    <p className={`mt-1 text-[11px] font-medium ${
                      member.today_available
                        ? 'text-green-600'
                        : 'text-amber-600'
                    }`}>
                      {availabilityLabel}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleReserve(member)
                  }}
                  className="w-full rounded-lg bg-brand-primary py-2 text-xs font-semibold text-white transition hover:bg-brand-primary/90 active:scale-[0.98]"
                >
                  予約する
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
