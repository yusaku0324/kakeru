import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBodyScrollLock } from '../useBodyScrollLock'

describe('useBodyScrollLock', () => {
  let originalOverflow: string

  beforeEach(() => {
    originalOverflow = document.body.style.overflow
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.body.style.overflow = originalOverflow
  })

  describe('locking behavior', () => {
    it('sets overflow hidden when active is true', () => {
      renderHook(() => useBodyScrollLock(true))
      expect(document.body.style.overflow).toBe('hidden')
    })

    it('does not lock when active is false', () => {
      renderHook(() => useBodyScrollLock(false))
      expect(document.body.style.overflow).toBe('')
    })

    it('unlocks when active changes from true to false', () => {
      const { rerender } = renderHook(({ active }) => useBodyScrollLock(active), {
        initialProps: { active: true },
      })

      expect(document.body.style.overflow).toBe('hidden')

      rerender({ active: false })
      expect(document.body.style.overflow).toBe('')
    })

    it('locks when active changes from false to true', () => {
      const { rerender } = renderHook(({ active }) => useBodyScrollLock(active), {
        initialProps: { active: false },
      })

      expect(document.body.style.overflow).toBe('')

      rerender({ active: true })
      expect(document.body.style.overflow).toBe('hidden')
    })
  })

  describe('preservation of original overflow', () => {
    it('preserves original overflow value', () => {
      document.body.style.overflow = 'scroll'

      const { rerender } = renderHook(({ active }) => useBodyScrollLock(active), {
        initialProps: { active: true },
      })

      expect(document.body.style.overflow).toBe('hidden')

      rerender({ active: false })
      expect(document.body.style.overflow).toBe('scroll')
    })

    it('preserves auto overflow', () => {
      document.body.style.overflow = 'auto'

      const { rerender } = renderHook(({ active }) => useBodyScrollLock(active), {
        initialProps: { active: true },
      })

      rerender({ active: false })
      expect(document.body.style.overflow).toBe('auto')
    })
  })

  describe('cleanup on unmount', () => {
    it('unlocks on unmount when active', () => {
      const { unmount } = renderHook(() => useBodyScrollLock(true))

      expect(document.body.style.overflow).toBe('hidden')

      unmount()
      expect(document.body.style.overflow).toBe('')
    })

    it('cleans up even if overflow was set to hidden externally', () => {
      document.body.style.overflow = 'hidden'

      const { unmount } = renderHook(() => useBodyScrollLock(false))

      // Since active is false, it shouldn't change overflow
      expect(document.body.style.overflow).toBe('hidden')

      unmount()
      // Safety cleanup clears hidden
      expect(document.body.style.overflow).toBe('')
    })
  })

  describe('multiple toggle cycles', () => {
    it('handles multiple lock/unlock cycles', () => {
      const { rerender } = renderHook(({ active }) => useBodyScrollLock(active), {
        initialProps: { active: false },
      })

      // First cycle
      rerender({ active: true })
      expect(document.body.style.overflow).toBe('hidden')
      rerender({ active: false })
      expect(document.body.style.overflow).toBe('')

      // Second cycle
      rerender({ active: true })
      expect(document.body.style.overflow).toBe('hidden')
      rerender({ active: false })
      expect(document.body.style.overflow).toBe('')
    })

    it('does not re-lock when already locked', () => {
      const { rerender } = renderHook(({ active }) => useBodyScrollLock(active), {
        initialProps: { active: true },
      })

      expect(document.body.style.overflow).toBe('hidden')

      // Rerender with same active state
      rerender({ active: true })
      expect(document.body.style.overflow).toBe('hidden')
    })
  })
})
