'use client'

import TherapistCard, { type TherapistHit } from '@/components/staff/TherapistCard'
import { TherapistFavoritesProvider } from '@/components/staff/TherapistFavoritesProvider'

const sampleTherapist: TherapistHit = {
  id: 'sample-card',
  therapistId: '11111111-1111-1111-8888-111111111111',
  staffId: 'sample-card-staff',
  name: '葵',
  alias: 'Aoi',
  headline: 'テスト用サンプルセラピスト',
  specialties: ['ホットストーン', 'ディープリンパ'],
  avatarUrl: null,
  rating: 4.8,
  reviewCount: 120,
  shopId: 'sample-namba-resort',
  shopSlug: 'sample-namba-resort',
  shopName: 'アロマリゾート 難波本店',
  shopArea: '京橋',
  shopAreaName: '京橋',
  todayAvailable: true,
  nextAvailableAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
}

export default function TestFavoritesClient() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">テスト用 お気に入り</h1>
      <p className="text-sm text-neutral-600">
        Playwright テスト専用のページです。TherapistFavoritesProvider がレンダリングされます。
      </p>
      <TherapistFavoritesProvider>
        <div data-testid="test-therapist-card-wrapper" className="max-w-md">
          <TherapistCard hit={sampleTherapist} />
        </div>
      </TherapistFavoritesProvider>
    </main>
  )
}
