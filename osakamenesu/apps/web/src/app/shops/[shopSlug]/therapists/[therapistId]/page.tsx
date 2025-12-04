'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import Image from 'next/image'
import TherapistProfile from '@/components/therapist/TherapistProfile'
import TherapistAvailability from '@/components/therapist/TherapistAvailability'
import SimilarTherapists from '@/components/therapist/SimilarTherapists'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Calendar, MapPin, Star } from 'lucide-react'

interface TherapistDetail {
  therapist: {
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
  shop: {
    id: string
    slug?: string
    name: string
    area: string
  }
  availability: {
    slots: Array<{
      starts_at: string
      ends_at: string
      is_available: boolean
      rejected_reasons?: string[]
    }>
    phase: 'explore' | 'narrow' | 'book'
    window: {
      days: number
      slot_granularity_minutes: number
    }
  }
  recommended_score?: number
  breakdown?: {
    base_staff_similarity?: number
    tag_similarity?: number
    price_match?: number
    age_match?: number
    photo_similarity?: number
    availability_boost?: number
    score?: number
  }
  entry_source: string
}

export default function TherapistDetailPage() {
  const params = useParams()
  const shopSlug = params.shopSlug as string
  const therapistId = params.therapistId as string
  const [therapist, setTherapist] = useState<TherapistDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function fetchTherapistDetail() {
      try {
        // Build query parameters
        const queryParams = new URLSearchParams()
        queryParams.append('shop_slug', shopSlug)

        // Add entry_source if not present
        const entrySource = searchParams.get('entry_source') || 'shop_page'
        queryParams.append('entry_source', entrySource)

        // Add optional parameters
        const days = searchParams.get('days')
        if (days) queryParams.append('days', days)

        const slotGranularity = searchParams.get('slot_granularity_minutes')
        if (slotGranularity) queryParams.append('slot_granularity_minutes', slotGranularity)

        const response = await fetch(
          `/api/v1/therapists/${therapistId}?${queryParams}`
        )

        if (!response.ok) {
          const errorData = await response.json()

          // Handle specific error codes
          if (errorData.reason_code === 'shop_slug_mismatch') {
            setError('このセラピストは指定された店舗に所属していません')
          } else if (errorData.reason_code === 'therapist_not_found') {
            setError('セラピストが見つかりませんでした')
          } else if (errorData.reason_code === 'shop_slug_required_for_multi_affiliation') {
            setError('このセラピストは複数店舗に所属しているため、店舗の指定が必要です')
          } else {
            setError(errorData.message || 'エラーが発生しました')
          }
          return
        }

        const data = await response.json()
        setTherapist(data)
      } catch (error) {
        console.error('Error fetching therapist detail:', error)
        setError('データの取得中にエラーが発生しました')
      } finally {
        setLoading(false)
      }
    }

    fetchTherapistDetail()
  }, [shopSlug, therapistId, searchParams])

  const handleReserve = () => {
    if (!therapist) return

    // Navigate to reservation page with therapist and shop info
    const params = new URLSearchParams({
      therapist_id: therapist.therapist.id,
      shop_id: therapist.shop.id,
      shop_slug: therapist.shop.slug || '',
      entry_source: therapist.entry_source
    })

    router.push(`/guest/therapists/${therapist.therapist.id}/reserve?${params}`)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Card>
            <div className="p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">エラー</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <Link href={`/shops/${therapist?.shop.slug || ''}`}>
                <Button variant="outline">
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  店舗ページに戻る
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (!therapist) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href={`/shops/${therapist.shop.slug}`}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              <span>{therapist.shop.name}に戻る</span>
            </Link>
            <Button onClick={handleReserve} size="lg">
              <Calendar className="w-5 h-5 mr-2" />
              予約する
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Profile */}
          <div className="lg:col-span-2 space-y-6">
            <TherapistProfile therapist={therapist.therapist} />

            {/* Shop Info */}
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">店舗情報</h2>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                    <div>
                      <p className="font-medium">{therapist.shop.name}</p>
                      <p className="text-sm text-gray-600">{therapist.shop.area}</p>
                    </div>
                  </div>
                  {therapist.recommended_score && (
                    <div className="flex items-center">
                      <Star className="w-5 h-5 text-yellow-400 mr-3" />
                      <span className="text-sm">
                        おすすめ度: {Math.round(therapist.recommended_score * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Breakdown Info (if available) */}
            {therapist.breakdown && (
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">マッチング詳細</h3>
                  <div className="space-y-2">
                    {therapist.breakdown.base_staff_similarity !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">基本相性</span>
                        <span className="text-sm font-medium">
                          {Math.round(therapist.breakdown.base_staff_similarity * 100)}%
                        </span>
                      </div>
                    )}
                    {therapist.breakdown.tag_similarity !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">タグ相性</span>
                        <span className="text-sm font-medium">
                          {Math.round(therapist.breakdown.tag_similarity * 100)}%
                        </span>
                      </div>
                    )}
                    {therapist.breakdown.availability_boost !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">空き状況ボーナス</span>
                        <span className="text-sm font-medium">
                          +{Math.round(therapist.breakdown.availability_boost * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right Column - Availability */}
          <div className="space-y-6">
            <TherapistAvailability
              availability={therapist.availability}
              therapistId={therapist.therapist.id}
              shopSlug={therapist.shop.slug}
              onSelectSlot={(slot) => {
                // Navigate to reservation with selected slot
                const params = new URLSearchParams({
                  therapist_id: therapist.therapist.id,
                  shop_id: therapist.shop.id,
                  shop_slug: therapist.shop.slug || '',
                  entry_source: therapist.entry_source,
                  selected_slot: JSON.stringify(slot)
                })
                router.push(`/guest/therapists/${therapist.therapist.id}/reserve?${params}`)
              }}
            />

            {/* Phase Info */}
            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">検索フェーズ</span>
                  <Badge variant="outline">
                    {therapist.availability.phase === 'explore' && '探索中'}
                    {therapist.availability.phase === 'narrow' && '絞り込み中'}
                    {therapist.availability.phase === 'book' && '予約確定'}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {therapist.availability.window.days}日間 /
                  {therapist.availability.window.slot_granularity_minutes}分単位
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <div className="space-y-3">
              <Button onClick={handleReserve} className="w-full" size="lg">
                <Calendar className="w-5 h-5 mr-2" />
                このセラピストを予約
              </Button>
              <Link href={`/shops/${therapist.shop.slug}`} className="block">
                <Button variant="outline" className="w-full">
                  他のセラピストを見る
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Similar Therapists */}
        <div className="mt-12">
          <SimilarTherapists
            currentTherapistId={therapist.therapist.id}
            shopSlug={therapist.shop.slug}
          />
        </div>
      </div>
    </div>
  )
}
