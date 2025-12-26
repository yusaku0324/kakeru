import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHeroImages } from '../useHeroImages'

describe('useHeroImages', () => {
  describe('heroImages initialization', () => {
    it('returns single null image when no images provided', () => {
      const { result } = renderHook(() => useHeroImages({}))
      expect(result.current.heroImages).toEqual([null])
    })

    it('returns gallery images when provided', () => {
      const { result } = renderHook(() =>
        useHeroImages({ gallery: ['img1.jpg', 'img2.jpg'] }),
      )
      expect(result.current.heroImages).toEqual(['img1.jpg', 'img2.jpg'])
    })

    it('returns fallback gallery when gallery is empty', () => {
      const { result } = renderHook(() =>
        useHeroImages({ gallery: [], fallbackGallery: ['fallback1.jpg'] }),
      )
      expect(result.current.heroImages).toEqual(['fallback1.jpg'])
    })

    it('merges gallery and fallback gallery', () => {
      const { result } = renderHook(() =>
        useHeroImages({
          gallery: ['main.jpg'],
          fallbackGallery: ['fallback.jpg'],
        }),
      )
      expect(result.current.heroImages).toEqual(['main.jpg', 'fallback.jpg'])
    })

    it('includes avatar at the end', () => {
      const { result } = renderHook(() =>
        useHeroImages({
          gallery: ['main.jpg'],
          avatar: 'avatar.jpg',
        }),
      )
      expect(result.current.heroImages).toEqual(['main.jpg', 'avatar.jpg'])
    })

    it('deduplicates images', () => {
      const { result } = renderHook(() =>
        useHeroImages({
          gallery: ['same.jpg'],
          fallbackGallery: ['same.jpg'],
          avatar: 'same.jpg',
        }),
      )
      expect(result.current.heroImages).toEqual(['same.jpg'])
    })

    it('filters out null and empty values from gallery', () => {
      const { result } = renderHook(() =>
        useHeroImages({
          gallery: ['valid.jpg', '', null as unknown as string],
        }),
      )
      expect(result.current.heroImages).toEqual(['valid.jpg'])
    })

    it('returns avatar only when galleries are null', () => {
      const { result } = renderHook(() =>
        useHeroImages({
          gallery: null,
          fallbackGallery: null,
          avatar: 'avatar.jpg',
        }),
      )
      expect(result.current.heroImages).toEqual(['avatar.jpg'])
    })
  })

  describe('heroIndex', () => {
    it('starts at index 0', () => {
      const { result } = renderHook(() =>
        useHeroImages({ gallery: ['img1.jpg', 'img2.jpg'] }),
      )
      expect(result.current.heroIndex).toBe(0)
    })

    it('updates via setHeroIndex', () => {
      const { result } = renderHook(() =>
        useHeroImages({ gallery: ['img1.jpg', 'img2.jpg'] }),
      )

      act(() => {
        result.current.setHeroIndex(1)
      })

      expect(result.current.heroIndex).toBe(1)
    })
  })

  describe('navigation', () => {
    it('showNextHero increments index', () => {
      const { result } = renderHook(() =>
        useHeroImages({ gallery: ['img1.jpg', 'img2.jpg', 'img3.jpg'] }),
      )

      act(() => {
        result.current.showNextHero()
      })

      expect(result.current.heroIndex).toBe(1)
    })

    it('showNextHero wraps around to 0', () => {
      const { result } = renderHook(() =>
        useHeroImages({ gallery: ['img1.jpg', 'img2.jpg'] }),
      )

      act(() => {
        result.current.setHeroIndex(1)
      })
      act(() => {
        result.current.showNextHero()
      })

      expect(result.current.heroIndex).toBe(0)
    })

    it('showPrevHero decrements index', () => {
      const { result } = renderHook(() =>
        useHeroImages({ gallery: ['img1.jpg', 'img2.jpg', 'img3.jpg'] }),
      )

      act(() => {
        result.current.setHeroIndex(1)
      })
      act(() => {
        result.current.showPrevHero()
      })

      expect(result.current.heroIndex).toBe(0)
    })

    it('showPrevHero wraps around to last index', () => {
      const { result } = renderHook(() =>
        useHeroImages({ gallery: ['img1.jpg', 'img2.jpg', 'img3.jpg'] }),
      )

      act(() => {
        result.current.showPrevHero()
      })

      expect(result.current.heroIndex).toBe(2)
    })

    it('showNextHero does nothing with single image', () => {
      const { result } = renderHook(() =>
        useHeroImages({ gallery: ['only.jpg'] }),
      )

      act(() => {
        result.current.showNextHero()
      })

      expect(result.current.heroIndex).toBe(0)
    })

    it('showPrevHero does nothing with single image', () => {
      const { result } = renderHook(() =>
        useHeroImages({ gallery: ['only.jpg'] }),
      )

      act(() => {
        result.current.showPrevHero()
      })

      expect(result.current.heroIndex).toBe(0)
    })
  })

  describe('index bounds', () => {
    it('resets index when it exceeds images length', () => {
      const { result, rerender } = renderHook(
        ({ gallery }) => useHeroImages({ gallery }),
        { initialProps: { gallery: ['img1.jpg', 'img2.jpg', 'img3.jpg'] } },
      )

      act(() => {
        result.current.setHeroIndex(2)
      })

      // Rerender with fewer images
      rerender({ gallery: ['img1.jpg'] })

      expect(result.current.heroIndex).toBe(0)
    })
  })
})
