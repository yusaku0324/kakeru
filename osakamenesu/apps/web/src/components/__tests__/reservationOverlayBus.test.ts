import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'

import {
  openReservationOverlay,
  closeReservationOverlay,
  useReservationOverlayBus,
} from '../reservationOverlayBus'
import type { TherapistHit } from '@/components/staff/TherapistCard'

const sampleHit: TherapistHit = {
  id: 'hit-1',
  therapistId: 'therapist-1',
  staffId: 'staff-1',
  name: 'テストセラピスト',
  alias: null,
  headline: 'テストヘッドライン',
  specialties: ['アロマ', 'オイル'],
  avatarUrl: null,
  rating: 4.5,
  reviewCount: 10,
  shopId: 'shop-1',
  shopSlug: 'test-shop',
  shopName: 'テストショップ',
  shopArea: '難波',
  shopAreaName: '難波エリア',
  todayAvailable: true,
  nextAvailableSlot: null,
}

const samplePayload = {
  hit: sampleHit,
}

describe('reservationOverlayBus', () => {
  describe('useReservationOverlayBus', () => {
    it('returns null initially', () => {
      const { result } = renderHook(() => useReservationOverlayBus())
      expect(result.current).toBeNull()
    })

    it('receives payload when openReservationOverlay is called', () => {
      const { result } = renderHook(() => useReservationOverlayBus())

      act(() => {
        openReservationOverlay(samplePayload)
      })

      expect(result.current).toEqual(samplePayload)
    })

    it('receives null when closeReservationOverlay is called', () => {
      const { result } = renderHook(() => useReservationOverlayBus())

      act(() => {
        openReservationOverlay(samplePayload)
      })
      expect(result.current).toEqual(samplePayload)

      act(() => {
        closeReservationOverlay()
      })
      expect(result.current).toBeNull()
    })

    it('multiple hooks receive the same payload', () => {
      const { result: result1 } = renderHook(() => useReservationOverlayBus())
      const { result: result2 } = renderHook(() => useReservationOverlayBus())

      act(() => {
        openReservationOverlay(samplePayload)
      })

      expect(result1.current).toEqual(samplePayload)
      expect(result2.current).toEqual(samplePayload)
    })

    it('unsubscribes on unmount', () => {
      const { result, unmount } = renderHook(() => useReservationOverlayBus())

      act(() => {
        openReservationOverlay(samplePayload)
      })
      expect(result.current).toEqual(samplePayload)

      unmount()

      // After unmount, the result is still the last value
      // but the hook is no longer listening
      expect(result.current).toEqual(samplePayload)
    })

    it('new hook starts with null even if overlay was opened before', () => {
      const { result: result1 } = renderHook(() => useReservationOverlayBus())

      act(() => {
        openReservationOverlay(samplePayload)
      })
      expect(result1.current).toEqual(samplePayload)

      // New hook should start with null (no shared state)
      const { result: result2 } = renderHook(() => useReservationOverlayBus())
      expect(result2.current).toBeNull()
    })
  })

  describe('openReservationOverlay', () => {
    it('notifies all listeners', () => {
      const { result: result1 } = renderHook(() => useReservationOverlayBus())
      const { result: result2 } = renderHook(() => useReservationOverlayBus())

      act(() => {
        openReservationOverlay(samplePayload)
      })

      expect(result1.current).toEqual(samplePayload)
      expect(result2.current).toEqual(samplePayload)
    })
  })

  describe('closeReservationOverlay', () => {
    it('notifies all listeners with null', () => {
      const { result: result1 } = renderHook(() => useReservationOverlayBus())
      const { result: result2 } = renderHook(() => useReservationOverlayBus())

      act(() => {
        openReservationOverlay(samplePayload)
      })

      act(() => {
        closeReservationOverlay()
      })

      expect(result1.current).toBeNull()
      expect(result2.current).toBeNull()
    })
  })
})
