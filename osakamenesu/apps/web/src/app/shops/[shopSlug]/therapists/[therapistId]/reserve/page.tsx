'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import ReservationForm from '@/components/reservation/ReservationForm'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Calendar, User, MapPin } from 'lucide-react'

interface TherapistInfo {
  id: string
  name: string
  photos?: string[]
}

interface ShopInfo {
  id: string
  slug?: string
  name: string
  area: string
}

export default function ShopReservePage({
  params
}: {
  params: { shopSlug: string; therapistId: string }
}) {
  const { shopSlug, therapistId } = params
  const [therapist, setTherapist] = useState<TherapistInfo | null>(null)
  const [shop, setShop] = useState<ShopInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  // Extract parameters from URL
  const selectedSlot = searchParams.get('selected_slot')
  const entrySource = searchParams.get('entry_source') || 'shop_page'

  // Parse selected slot if available
  const slotData = selectedSlot ? JSON.parse(selectedSlot) : null

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch therapist details to get name and shop info
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/therapists/${therapistId}?shop_slug=${shopSlug}&entry_source=${entrySource}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch therapist details')
        }

        const data = await response.json()
        setTherapist({
          id: data.therapist.id,
          name: data.therapist.name,
          photos: data.therapist.photos
        })
        setShop({
          id: data.shop.id,
          slug: data.shop.slug,
          name: data.shop.name,
          area: data.shop.area
        })
      } catch (error) {
        console.error('Error fetching data:', error)
        setError('セラピスト情報の取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [therapistId, shopSlug, entrySource])

  const handleReservationComplete = (reservationId: string) => {
    // Navigate to reservation confirmation page
    router.push(`/guest/reservations/${reservationId}`)
  }

  const handleBack = () => {
    router.push(`/shops/${shopSlug}/therapists/${therapistId}`)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error || !therapist || !shop) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Card>
            <div className="p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">エラー</h2>
              <p className="text-gray-600 mb-6">{error || 'データが見つかりませんでした'}</p>
              <Button onClick={handleBack} variant="outline">
                <ChevronLeft className="w-4 h-4 mr-2" />
                戻る
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              <span>戻る</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Therapist Info Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">予約情報</h2>

                {/* Therapist Info */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    {therapist.photos && therapist.photos.length > 0 ? (
                      <img
                        src={therapist.photos[0]}
                        alt={therapist.name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{therapist.name}</p>
                      <p className="text-sm text-gray-600">セラピスト</p>
                    </div>
                  </div>
                </div>

                {/* Shop Info */}
                <div className="mb-6">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="font-medium">{shop.name}</p>
                      <p className="text-sm text-gray-600">{shop.area}</p>
                    </div>
                  </div>
                </div>

                {/* Selected Time Slot */}
                {slotData && (
                  <div className="border-t pt-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="font-medium">選択された時間</p>
                        <p className="text-sm text-gray-600">
                          {new Date(slotData.starts_at).toLocaleDateString('ja-JP')}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(slotData.starts_at).toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })} - {new Date(slotData.ends_at).toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Reservation Form */}
          <div className="lg:col-span-2">
            <Card>
              <div className="p-6">
                <h1 className="text-2xl font-bold mb-6">予約フォーム</h1>
                <ReservationForm
                  shopId={shop.id}
                  therapistId={therapist.id}
                  preSelectedSlot={slotData}
                  onComplete={handleReservationComplete}
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}