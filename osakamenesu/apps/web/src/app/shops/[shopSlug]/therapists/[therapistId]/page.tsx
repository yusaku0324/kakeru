import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, MapPin, Star } from 'lucide-react'

import { resolveInternalApiBase } from '@/lib/server-config'
import TherapistProfile from '@/components/therapist/TherapistProfile'
import { Card } from '@/components/ui/Card'
import { TherapistDetailClient, TherapistReserveButton } from './TherapistDetailClient'

// ISR: Revalidate every 60 seconds
export const revalidate = 60

interface TherapistData {
  id: string
  name: string
  age?: number
  price_rank?: number
  tags?: {
    mood?: string
    style?: string
    look?: string
    contact?: string
    hobby_tags?: string[]
  }
  profile_text?: string
  photos?: string[]
  badges?: string[]
}

interface ShopData {
  id: string
  slug?: string
  name: string
  area: string
}

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

interface Breakdown {
  base_staff_similarity?: number
  tag_similarity?: number
  price_match?: number
  age_match?: number
  photo_similarity?: number
  availability_boost?: number
  score?: number
}

interface TherapistDetail {
  therapist: TherapistData
  shop: ShopData
  availability: Availability
  recommended_score?: number
  breakdown?: Breakdown
  entry_source: string
}

async function fetchTherapistDetail(
  therapistId: string,
  shopSlug: string
): Promise<TherapistDetail | null> {
  const internalBase = resolveInternalApiBase()
  const params = new URLSearchParams({
    shop_slug: shopSlug,
    entry_source: 'shop_page',
  })
  const url = `${internalBase}/api/v1/therapists/${encodeURIComponent(therapistId)}?${params}`

  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      console.error(`Failed to fetch therapist: ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to fetch therapist:', error)
    return null
  }
}

type PageProps = {
  params: Promise<{ shopSlug: string; therapistId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shopSlug, therapistId } = await params
  const data = await fetchTherapistDetail(therapistId, shopSlug)

  if (!data) {
    return {
      title: 'セラピストが見つかりません',
    }
  }

  const { therapist, shop } = data
  const description =
    therapist.profile_text?.slice(0, 120) || `${therapist.name} - ${shop.name}のセラピスト`

  return {
    title: `${therapist.name} | ${shop.name}`,
    description,
    openGraph: {
      title: `${therapist.name} | ${shop.name}`,
      description,
      images: therapist.photos?.[0] ? [therapist.photos[0]] : undefined,
    },
  }
}

export default async function TherapistDetailPage({ params }: PageProps) {
  const { shopSlug, therapistId } = await params
  const data = await fetchTherapistDetail(therapistId, shopSlug)

  if (!data) {
    notFound()
  }

  const { therapist, shop, availability, recommended_score, breakdown } = data

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href={`/shops/${shop.slug || shopSlug}`}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              <span>{shop.name}に戻る</span>
            </Link>
            <TherapistReserveButton
              therapistId={therapist.id}
              shopSlug={shop.slug || shopSlug}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Profile */}
          <div className="lg:col-span-2 space-y-6">
            <TherapistProfile therapist={therapist} />

            {/* Shop Info */}
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">店舗情報</h2>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                    <div>
                      <p className="font-medium">{shop.name}</p>
                      <p className="text-sm text-gray-600">{shop.area}</p>
                    </div>
                  </div>
                  {recommended_score && (
                    <div className="flex items-center">
                      <Star className="w-5 h-5 text-yellow-400 mr-3" />
                      <span className="text-sm">
                        おすすめ度: {Math.round(recommended_score * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Breakdown Info (if available) */}
            {breakdown && (
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">マッチング詳細</h3>
                  <div className="space-y-2">
                    {breakdown.base_staff_similarity !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">基本相性</span>
                        <span className="text-sm font-medium">
                          {Math.round(breakdown.base_staff_similarity * 100)}%
                        </span>
                      </div>
                    )}
                    {breakdown.tag_similarity !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">タグ相性</span>
                        <span className="text-sm font-medium">
                          {Math.round(breakdown.tag_similarity * 100)}%
                        </span>
                      </div>
                    )}
                    {breakdown.availability_boost !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">空き状況ボーナス</span>
                        <span className="text-sm font-medium">
                          +{Math.round(breakdown.availability_boost * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right Column & Similar Therapists - Client Component */}
          <TherapistDetailClient
            therapistId={therapist.id}
            shopSlug={shop.slug || shopSlug}
            availability={availability}
          />
        </div>
      </div>
    </div>
  )
}
