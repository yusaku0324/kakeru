'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
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

// Sample data for demo/development
const SAMPLE_THERAPISTS: Record<string, { name: string; photos: string[] }> = {
  '11111111-1111-1111-8888-111111111111': { name: '葵', photos: ['https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=640&q=80'] },
  '22222222-2222-2222-8888-222222222222': { name: '凛', photos: ['https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=400&q=80'] },
  '22222222-2222-2222-8888-222222222223': { name: '真央', photos: ['https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=640&q=80'] },
  '22222222-2222-2222-8888-222222222224': { name: '美月', photos: ['https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=640&q=80'] },
  '22222222-2222-2222-8888-222222222225': { name: '結衣', photos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=640&q=80'] },
  '22222222-2222-2222-8888-222222222226': { name: '楓', photos: ['https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=640&q=80'] },
}

const SAMPLE_SHOPS: Record<string, { id: string; name: string; area: string }> = {
  'sample-namba-resort': { id: '00000001-0000-0000-0000-000000000001', name: 'アロマリゾート 難波本店', area: '難波/日本橋' },
  'sample-umeda-suite': { id: '00000003-0000-0000-0000-000000000003', name: 'リラクゼーションSUITE 梅田', area: '梅田' },
  'sample-shinsaibashi-lounge': { id: '00000002-0000-0000-0000-000000000002', name: 'メンズアロマ Lounge 心斎橋', area: '心斎橋' },
}

export default function ShopReservePage() {
  const params = useParams()
  const shopSlug = params.shopSlug as string
  const therapistId = params.therapistId as string
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
          `/api/v1/therapists/${therapistId}?shop_slug=${shopSlug}&entry_source=${entrySource}`
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
        // Fall back to sample data for demo/development
        const sampleTherapist = SAMPLE_THERAPISTS[therapistId]
        const sampleShop = SAMPLE_SHOPS[shopSlug]
        if (sampleTherapist && sampleShop) {
          setTherapist({
            id: therapistId,
            name: sampleTherapist.name,
            photos: sampleTherapist.photos
          })
          setShop({
            id: sampleShop.id,
            slug: shopSlug,
            name: sampleShop.name,
            area: sampleShop.area
          })
        } else {
          setError('セラピスト情報の取得に失敗しました')
        }
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
                      <Image
                        src={therapist.photos[0]}
                        alt={therapist.name}
                        width={64}
                        height={64}
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
