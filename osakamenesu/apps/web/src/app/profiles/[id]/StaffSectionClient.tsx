'use client'

import { Section } from '@/components/ui/Section'
import { TherapistCard, type TherapistHit } from '@/components/staff/TherapistCard'
import { TherapistFavoritesProvider } from '@/components/staff/TherapistFavoritesProvider'
import { type NextAvailableSlotPayload } from '@/lib/nextAvailableSlot'

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
  mood_tag?: string | null
  style_tag?: string | null
  look_type?: string | null
  contact_style?: string | null
  hobby_tags?: string[] | null
  talk_level?: string | null
}

type MenuOption = {
  id: string
  name: string
  price: number
  duration_minutes?: number | null
  description?: string | null
}

type Props = {
  staff: StaffMember[]
  shopId: string
  shopSlug: string | null
  shopName: string
  shopArea: string
  shopAreaName?: string | null
  menus?: MenuOption[] | null
}

function staffMemberToTherapistHit(
  member: StaffMember,
  shopId: string,
  shopSlug: string | null,
  shopName: string,
  shopArea: string,
  shopAreaName: string | null,
): TherapistHit {
  const nextAvailableSlot = member.next_available_slot ?? null
  // Build availabilitySlots from nextAvailableSlot so overlay calendar matches badge
  const availabilitySlots: Array<{ start_at: string; end_at: string; status?: string }> | null =
    nextAvailableSlot?.start_at
      ? [
          {
            start_at: nextAvailableSlot.start_at,
            end_at:
              nextAvailableSlot.end_at ??
              new Date(new Date(nextAvailableSlot.start_at).getTime() + 90 * 60 * 1000).toISOString(),
            status: nextAvailableSlot.status === 'ok' ? 'open' : 'tentative',
          },
        ]
      : null
  return {
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
    shopAreaName,
    todayAvailable: member.today_available ?? null,
    nextAvailableSlot,
    availabilitySlots,
    mood_tag: member.mood_tag ?? null,
    style_tag: member.style_tag ?? null,
    look_type: member.look_type ?? null,
    contact_style: member.contact_style ?? null,
    hobby_tags: member.hobby_tags ?? null,
    talk_level: member.talk_level ?? null,
  }
}

export default function StaffSectionClient({ staff, shopId, shopSlug, shopName, shopArea, shopAreaName, menus }: Props) {
  if (!staff.length) return null

  return (
    <TherapistFavoritesProvider>
      <Section
        id="staff"
        title={`セラピスト (${staff.length}名)`}
        subtitle="人気のセラピストを一部ご紹介"
        className="shadow-none border border-neutral-borderLight bg-neutral-surface"
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {staff.map((member) => {
            const hit = staffMemberToTherapistHit(
              member,
              shopId,
              shopSlug,
              shopName,
              shopArea,
              shopAreaName ?? null,
            )
            return (
              <div key={member.id} id={`staff-${member.id}`} className="scroll-mt-20">
                <TherapistCard hit={hit} useOverlay menus={menus} />
              </div>
            )
          })}
        </div>
      </Section>
    </TherapistFavoritesProvider>
  )
}
