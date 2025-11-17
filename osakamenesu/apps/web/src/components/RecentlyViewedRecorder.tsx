'use client'

import { useEffect } from 'react'

type RecentlyViewedEntry = {
  shopId: string
  slug: string | null
  name: string
  area: string | null
  imageUrl: string | null
  viewedAt: string
}

const STORAGE_KEY = 'osakamenesu.recentlyViewed.v1'
const UPDATE_EVENT = 'osakamenesu:recently-viewed-update'

function readEntries(): RecentlyViewedEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => typeof item?.shopId === 'string')
  } catch (error) {
    console.warn('[recentlyViewed] failed to parse storage', error)
    return []
  }
}

function writeEntries(entries: RecentlyViewedEntry[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT))
  } catch (error) {
    console.warn('[recentlyViewed] failed to write storage', error)
  }
}

export type RecentlyViewedRecorderProps = {
  shopId: string
  slug?: string | null
  name: string
  area?: string | null
  imageUrl?: string | null
}

export default function RecentlyViewedRecorder({
  shopId,
  slug,
  name,
  area,
  imageUrl,
}: RecentlyViewedRecorderProps) {
  useEffect(() => {
    if (!shopId || typeof window === 'undefined') return

    const previous = readEntries()
    const normalizedSlug = slug ? slug.trim() : null
    const normalizedArea = area ? area.trim() : null
    const normalizedName = name.trim()

    const nextEntry: RecentlyViewedEntry = {
      shopId,
      slug: normalizedSlug,
      name: normalizedName,
      area: normalizedArea,
      imageUrl: imageUrl ?? null,
      viewedAt: new Date().toISOString(),
    }

    const filtered = previous.filter(
      (item) => item.shopId !== shopId && (!normalizedSlug || item.slug !== normalizedSlug),
    )
    const next = [nextEntry, ...filtered].slice(0, 12)
    writeEntries(next)
  }, [shopId, slug, name, area, imageUrl])

  return null
}

export { STORAGE_KEY as RECENTLY_VIEWED_STORAGE_KEY, UPDATE_EVENT as RECENTLY_VIEWED_UPDATE_EVENT }
