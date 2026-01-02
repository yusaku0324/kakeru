'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type UseHeroImagesArgs = {
  gallery?: string[] | null
  fallbackGallery?: string[] | null
  avatar?: string | null
}

type UseHeroImagesResult = {
  heroImages: (string | null)[]
  heroIndex: number
  showPrevHero: () => void
  showNextHero: () => void
  setHeroIndex: (index: number) => void
}

export function useHeroImages({
  gallery,
  fallbackGallery,
  avatar,
}: UseHeroImagesArgs): UseHeroImagesResult {
  const heroImages = useMemo(() => {
    const sources: (string | null)[] = []
    const seen = new Set<string>()
    const push = (src?: string | null) => {
      if (!src || seen.has(src)) return
      seen.add(src)
      sources.push(src)
    }
    // Priority: gallery (API) > avatar (actual photo) > fallbackGallery (demo data)
    // This ensures real therapist photos take precedence over hardcoded fallback data
    if (Array.isArray(gallery)) gallery.forEach((src) => push(src))
    push(avatar ?? null)
    if (Array.isArray(fallbackGallery)) fallbackGallery.forEach((src) => push(src))
    return sources.length ? sources : [null]
  }, [avatar, fallbackGallery, gallery])

  const [heroIndex, setHeroIndex] = useState(0)

  useEffect(() => {
    if (heroIndex >= heroImages.length) {
      setHeroIndex(0)
    }
  }, [heroImages.length, heroIndex])

  const showPrevHero = useCallback(() => {
    if (heroImages.length <= 1) return
    setHeroIndex((prev) => (prev - 1 + heroImages.length) % heroImages.length)
  }, [heroImages.length])

  const showNextHero = useCallback(() => {
    if (heroImages.length <= 1) return
    setHeroIndex((prev) => (prev + 1) % heroImages.length)
  }, [heroImages.length])

  return {
    heroImages,
    heroIndex,
    showPrevHero,
    showNextHero,
    setHeroIndex,
  }
}
