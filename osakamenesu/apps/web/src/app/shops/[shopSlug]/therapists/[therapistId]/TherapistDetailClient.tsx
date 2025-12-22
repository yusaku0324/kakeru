'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar } from 'lucide-react'

import TherapistAvailability from '@/components/therapist/TherapistAvailability'
import SimilarTherapists from '@/components/therapist/SimilarTherapists'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

interface AvailabilitySlot {
  starts_at: string
  ends_at: string
  is_available: boolean
  rejected_reasons?: string[]
}

interface Availability {
  slots: AvailabilitySlot[]
  phase: 'explore' | 'narrow' | 'book'
  window: {
    days: number
    slot_granularity_minutes: number
  }
}

interface TherapistDetailClientProps {
  therapistId: string
  shopSlug: string
  availability: Availability
}

export function TherapistDetailClient({
  therapistId,
  shopSlug,
  availability,
}: TherapistDetailClientProps) {
  const router = useRouter()

  const handleReserve = () => {
    router.push(`/shops/${shopSlug}/therapists/${therapistId}/reserve`)
  }

  const handleSelectSlot = (slot: AvailabilitySlot) => {
    const params = new URLSearchParams({
      selected_slot: JSON.stringify(slot),
    })
    router.push(`/shops/${shopSlug}/therapists/${therapistId}/reserve?${params}`)
  }

  return (
    <>
      {/* Right Column - Availability */}
      <div className="space-y-6">
        <TherapistAvailability
          availability={availability}
          therapistId={therapistId}
          shopSlug={shopSlug}
          onSelectSlot={handleSelectSlot}
        />

        {/* Phase Info */}
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">検索フェーズ</span>
              <Badge variant="outline">
                {availability.phase === 'explore' && '探索中'}
                {availability.phase === 'narrow' && '絞り込み中'}
                {availability.phase === 'book' && '予約確定'}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {availability.window.days}日間 /{' '}
              {availability.window.slot_granularity_minutes}分単位
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="space-y-3">
          <Button onClick={handleReserve} className="w-full" size="lg">
            <Calendar className="w-5 h-5 mr-2" />
            このセラピストを予約
          </Button>
          <Link href={`/shops/${shopSlug}`} className="block">
            <Button variant="outline" className="w-full">
              他のセラピストを見る
            </Button>
          </Link>
        </div>
      </div>

      {/* Similar Therapists */}
      <div className="mt-12 lg:col-span-3">
        <SimilarTherapists currentTherapistId={therapistId} shopSlug={shopSlug} />
      </div>
    </>
  )
}

export function TherapistReserveButton({
  therapistId,
  shopSlug,
}: {
  therapistId: string
  shopSlug: string
}) {
  const router = useRouter()

  return (
    <Button
      onClick={() => router.push(`/shops/${shopSlug}/therapists/${therapistId}/reserve`)}
      size="lg"
    >
      <Calendar className="w-5 h-5 mr-2" />
      予約する
    </Button>
  )
}
