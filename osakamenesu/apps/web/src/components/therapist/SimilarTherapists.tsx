import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { User, Star, ChevronRight } from 'lucide-react'

interface SimilarTherapist {
  id: string
  name: string
  photos?: string[]
  tags?: {
    mood?: string
    style?: string
  }
  price_rank?: number
  similarity_score: number
  available_today: boolean
}

interface SimilarTherapistsProps {
  currentTherapistId: string
  shopSlug?: string
}

export default function SimilarTherapists({
  currentTherapistId,
  shopSlug
}: SimilarTherapistsProps) {
  const [therapists, setTherapists] = useState<SimilarTherapist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSimilarTherapists() {
      try {
        const response = await fetch(
          `/api/v1/therapists/${currentTherapistId}/similar?limit=6`
        )

        if (response.ok) {
          const data = await response.json()
          setTherapists(data.therapists || [])
        }
      } catch (error) {
        console.error('Error fetching similar therapists:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSimilarTherapists()
  }, [currentTherapistId])

  const getPriceDisplay = (rank?: number) => {
    if (!rank) return null
    return '¥'.repeat(rank)
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  if (therapists.length === 0) {
    return null
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">類似のセラピスト</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {therapists.map(therapist => (
          <Card key={therapist.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <Link
              href={`/shops/${shopSlug}/therapists/${therapist.id}`}
              className="block"
            >
              <div className="aspect-w-16 aspect-h-9 relative">
                {therapist.photos && therapist.photos.length > 0 ? (
                  <Image
                    src={therapist.photos[0]}
                    alt={therapist.name}
                    width={300}
                    height={192}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                    <User className="w-16 h-16 text-gray-400" />
                  </div>
                )}
                {therapist.available_today && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="success">本日空きあり</Badge>
                  </div>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-lg">{therapist.name}</h3>
                  {therapist.similarity_score > 0 && (
                    <div className="flex items-center text-sm text-amber-600">
                      <Star className="w-4 h-4 mr-1 fill-current" />
                      {Math.round(therapist.similarity_score * 100)}%
                    </div>
                  )}
                </div>

                <div className="space-y-2 mb-3">
                  {therapist.price_rank && (
                    <p className="text-sm font-medium">{getPriceDisplay(therapist.price_rank)}</p>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {therapist.tags?.mood && (
                      <Badge variant="outline" className="text-xs">
                        {therapist.tags.mood}
                      </Badge>
                    )}
                    {therapist.tags?.style && (
                      <Badge variant="outline" className="text-xs">
                        {therapist.tags.style}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center text-primary hover:text-primary/80">
                  <span className="text-sm">詳細を見る</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </Link>
          </Card>
        ))}
      </div>

      {therapists.length >= 6 && (
        <div className="mt-6 text-center">
          <Link href={`/shops/${shopSlug}`}>
            <Button variant="outline" size="lg">
              その他のセラピストを見る
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
