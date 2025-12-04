import Image from 'next/image'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { User, Sparkles, Heart, Calendar, DollarSign } from 'lucide-react'

interface TherapistProfileProps {
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
}

export default function TherapistProfile({ therapist }: TherapistProfileProps) {
  // Price rank display
  const getPriceDisplay = (rank?: number) => {
    if (!rank) return null
    return '¥'.repeat(rank)
  }

  // Badge color mapping
  const getBadgeVariant = (badge: string): 'brand' | 'success' | 'neutral' => {
    if (badge.includes('新人')) return 'success'
    if (badge.includes('人気')) return 'brand'
    return 'neutral'
  }

  return (
    <Card>
      <div className="p-6">
        {/* Header with photo and basic info */}
        <div className="flex flex-col sm:flex-row gap-6 mb-6">
          {/* Main Photo */}
          <div className="flex-shrink-0">
            {therapist.photos && therapist.photos.length > 0 ? (
              <img
                src={therapist.photos[0]}
                alt={therapist.name}
                className="w-32 h-32 sm:w-48 sm:h-48 rounded-lg object-cover"
              />
            ) : (
              <div className="w-32 h-32 sm:w-48 sm:h-48 rounded-lg bg-gray-200 flex items-center justify-center">
                <User className="w-16 h-16 text-gray-400" />
              </div>
            )}
          </div>

          {/* Basic Info */}
          <div className="flex-1">
            <div className="mb-3">
              <h1 className="text-2xl font-bold mb-2">{therapist.name}</h1>
              <div className="flex flex-wrap gap-2 mb-3">
                {therapist.badges?.map((badge, index) => (
                  <Badge key={index} variant={getBadgeVariant(badge)}>
                    {badge}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {therapist.age && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{therapist.age}歳</span>
                </div>
              )}
              {therapist.price_rank && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{getPriceDisplay(therapist.price_rank)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tags */}
        {therapist.tags && (
          <div className="mb-6 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">タグ</h3>
            <div className="space-y-2">
              {therapist.tags.mood && (
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-pink-400" />
                  <span className="text-sm">雰囲気: </span>
                  <Badge variant="outline">{therapist.tags.mood}</Badge>
                </div>
              )}
              {therapist.tags.style && (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-sm">スタイル: </span>
                  <Badge variant="outline">{therapist.tags.style}</Badge>
                </div>
              )}
              {therapist.tags.look && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-400" />
                  <span className="text-sm">見た目: </span>
                  <Badge variant="outline">{therapist.tags.look}</Badge>
                </div>
              )}
              {therapist.tags.contact && (
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-400" />
                  <span className="text-sm">接し方: </span>
                  <Badge variant="outline">{therapist.tags.contact}</Badge>
                </div>
              )}
            </div>

            {/* Hobby Tags */}
            {therapist.tags.hobby_tags && therapist.tags.hobby_tags.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-gray-600 mb-2">趣味・興味:</p>
                <div className="flex flex-wrap gap-2">
                  {therapist.tags.hobby_tags.map((hobby, index) => (
                    <Badge key={index} variant="neutral">
                      {hobby}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Profile Text */}
        {therapist.profile_text && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">プロフィール</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{therapist.profile_text}</p>
          </div>
        )}

        {/* Additional Photos */}
        {therapist.photos && therapist.photos.length > 1 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">その他の写真</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {therapist.photos.slice(1).map((photo, index) => (
                <img
                  key={index}
                  src={photo}
                  alt={`${therapist.name} ${index + 2}`}
                  className="w-full aspect-square rounded-lg object-cover"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
