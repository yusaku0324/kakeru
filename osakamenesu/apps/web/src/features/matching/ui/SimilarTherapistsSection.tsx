"use client"

import { useEffect, useState } from 'react'

import SafeImage from '@/components/SafeImage'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Section } from '@/components/ui/Section'
import { fetchSimilarTherapists, type SimilarTherapist } from '../api'

type Props = {
  baseStaffId: string
  limit?: number
  minScore?: number
}

const skeletonItems = Array.from({ length: 4 })

function PriceLabel({ priceRank }: { priceRank: number | null }) {
  if (priceRank === null || priceRank === undefined) return null
  return <Badge variant="outline">価格帯: {priceRank}</Badge>
}

function TagsRow({ item }: { item: SimilarTherapist }) {
  const tags = [item.moodTag, item.styleTag, item.lookType].filter(Boolean).slice(0, 2)
  if (!tags.length) return null
  return (
    <div className="flex flex-wrap gap-2 text-[11px] text-neutral-textMuted">
      {tags.map((tag, idx) => (
        <span key={`${tag}-${idx}`} className="rounded-badge bg-neutral-surfaceAlt px-2 py-1">
          {tag}
        </span>
      ))}
    </div>
  )
}

function AvailabilityBadge({ available }: { available: boolean }) {
  if (available) {
    return <Badge variant="success">◎ 予約可</Badge>
  }
  return <Badge variant="outline">× 満席</Badge>
}

export function SimilarTherapistsSection({ baseStaffId, limit = 8, minScore }: Props) {
  const [items, setItems] = useState<SimilarTherapist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function run() {
      if (!baseStaffId) {
        setItems([])
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const res = await fetchSimilarTherapists({ staffId: baseStaffId, limit, minScore })
        if (!mounted) return
        setItems(res.items ?? [])
      } catch (err) {
        console.error('[similar-therapists] fetch failed', err)
        if (!mounted) return
        setError('failed')
        setItems([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => {
      mounted = false
    }
  }, [baseStaffId, limit, minScore])

  if (!loading && (error || items.length === 0)) {
    return null
  }

  return (
    <Section
      title="この子に近いタイプ"
      subtitle="タグ・価格・年齢の近さから似ているセラをピックアップ"
      className="border border-neutral-borderLight/70 bg-white/90 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/80"
    >
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {skeletonItems.map((_, idx) => (
            <Card key={idx} className="flex gap-3 p-3">
              <div className="h-20 w-20 animate-pulse rounded-card bg-neutral-surfaceAlt" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-surfaceAlt" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-surfaceAlt" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-surfaceAlt" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <Card
              key={item.id}
              className="flex gap-3 p-3 transition hover:border-brand-primary hover:shadow-sm"
              data-testid="similar-card"
            >
              <div className="relative h-20 w-20 overflow-hidden rounded-card bg-neutral-surface">
                <SafeImage
                  src={item.photoUrl || undefined}
                  alt={`${item.name}の写真`}
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                  fallbackSrc="/images/placeholder-avatar.svg"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1 text-sm text-neutral-text">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-neutral-text">{item.name}</span>
                  {typeof item.age === 'number' ? (
                    <span className="text-xs text-neutral-textMuted">{item.age}歳</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-neutral-textMuted">
                  <PriceLabel priceRank={item.priceRank} />
                  <AvailabilityBadge available={item.isAvailableNow} />
                </div>
                <TagsRow item={item} />
                <div className="text-[11px] text-neutral-textMuted">
                  スコア {item.score.toFixed(2)} / タグ {item.tagSimilarity.toFixed(2)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Section>
  )
}
