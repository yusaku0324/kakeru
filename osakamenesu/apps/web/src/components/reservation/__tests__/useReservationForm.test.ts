/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useReservationForm } from '../useReservationForm'
import type { ReservationCourseOption, ReservationSelectedSlot } from '../useReservationForm'

// Mock dependencies
vi.mock('@/lib/verify-slot', () => ({
  verifySlot: vi.fn(),
}))

vi.mock('@/lib/error-messages', () => ({
  createSlotConflictMessage: vi.fn((reason?: string) => {
    if (reason === 'already_reserved') return '他のお客様により予約されました'
    return 'この時間は予約できません'
  }),
  RESERVATION_ERRORS: {
    SUBMIT_FAILED: '予約の送信に失敗しました。',
  },
}))

vi.mock('@/lib/jst', () => ({
  formatTimeHM: vi.fn((date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }),
}))

vi.mock('@/lib/timezone', () => ({
  toZonedDayjs: vi.fn(() => ({
    add: vi.fn().mockReturnThis(),
    second: vi.fn().mockReturnThis(),
    millisecond: vi.fn().mockReturnThis(),
  })),
  formatDatetimeLocal: vi.fn(() => '2025-01-15T10:00'),
}))

vi.mock('../../useToast', () => ({
  useToast: vi.fn(() => ({
    toasts: [],
    push: vi.fn(),
    remove: vi.fn(),
  })),
}))

const PROFILE_STORAGE_KEY = 'reservation.profile.v1'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

describe('useReservationForm', () => {
  const mockShopId = '12345678-1234-1234-1234-123456789012'

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  describe('initialization', () => {
    it('initializes with default values', () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      expect(result.current.form.name).toBe('')
      expect(result.current.form.phone).toBe('')
      expect(result.current.form.email).toBe('')
      expect(result.current.form.notes).toBe('')
      expect(result.current.form.marketingOptIn).toBe(false)
      expect(result.current.form.durationMinutes).toBe(60)
      expect(result.current.errors).toEqual({})
      expect(result.current.canSubmit).toBe(true)
    })

    it('uses defaultDurationMinutes when provided', () => {
      const { result } = renderHook(() =>
        useReservationForm({
          shopId: mockShopId,
          defaultDurationMinutes: 90,
        }),
      )

      expect(result.current.form.durationMinutes).toBe(90)
    })

    it('uses first course duration when courseOptions provided', () => {
      const courseOptions: ReservationCourseOption[] = [
        { id: 'course-1', label: 'コースA', durationMinutes: 120 },
        { id: 'course-2', label: 'コースB', durationMinutes: 90 },
      ]

      const { result } = renderHook(() =>
        useReservationForm({
          shopId: mockShopId,
          courseOptions,
        }),
      )

      expect(result.current.form.courseId).toBe('course-1')
      expect(result.current.form.durationMinutes).toBe(120)
    })

    it('sets canSubmit to false for non-UUID shopId', () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: 'demo-shop' }),
      )

      expect(result.current.canSubmit).toBe(false)
    })

    it('sets canSubmit to true with allowDemoSubmission', () => {
      const { result } = renderHook(() =>
        useReservationForm({
          shopId: 'demo-shop',
          allowDemoSubmission: true,
        }),
      )

      expect(result.current.canSubmit).toBe(true)
    })

    it('sets hasContactChannels correctly', () => {
      const { result: withTel } = renderHook(() =>
        useReservationForm({ shopId: mockShopId, tel: '090-1234-5678' }),
      )
      expect(withTel.current.hasContactChannels).toBe(true)

      const { result: withLine } = renderHook(() =>
        useReservationForm({ shopId: mockShopId, lineId: '@shop' }),
      )
      expect(withLine.current.hasContactChannels).toBe(true)

      const { result: withoutContact } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )
      expect(withoutContact.current.hasContactChannels).toBe(false)
    })
  })

  describe('localStorage profile', () => {
    it('saves profile when rememberProfile is toggled on', () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      act(() => {
        result.current.actions.handleChange('name', '山田太郎')
        result.current.actions.handleChange('phone', '09012345678')
      })

      act(() => {
        result.current.actions.toggleRemember(true)
      })

      const stored = localStorageMock.getItem(PROFILE_STORAGE_KEY)
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored)
      expect(parsed.name).toBe('山田太郎')
      expect(parsed.phone).toBe('090-1234-5678')
    })

    it('clears profile when rememberProfile is toggled off', () => {
      localStorageMock.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify({ name: '山田太郎', phone: '090-1234-5678' }),
      )

      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      act(() => {
        result.current.actions.toggleRemember(false)
      })

      expect(localStorageMock.getItem(PROFILE_STORAGE_KEY)).toBeNull()
    })

    it('handles malformed localStorage data gracefully', () => {
      localStorageMock.setItem(PROFILE_STORAGE_KEY, 'invalid json')

      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      expect(result.current.form.name).toBe('')
      expect(result.current.form.phone).toBe('')
    })

    it('handles missing required fields in stored profile', () => {
      localStorageMock.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ name: '太郎' }))

      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      expect(result.current.form.name).toBe('')
      expect(result.current.rememberProfile).toBe(false)
    })
  })

  describe('handleChange', () => {
    it('updates form fields', () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      act(() => {
        result.current.actions.handleChange('name', '山田花子')
      })

      expect(result.current.form.name).toBe('山田花子')
    })

    it('formats phone number automatically', () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      act(() => {
        result.current.actions.handleChange('phone', '09012345678')
      })

      expect(result.current.form.phone).toBe('090-1234-5678')
    })

    it('formats partial phone number correctly', () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      act(() => {
        result.current.actions.handleChange('phone', '090')
      })
      expect(result.current.form.phone).toBe('090')

      act(() => {
        result.current.actions.handleChange('phone', '0901234')
      })
      expect(result.current.form.phone).toBe('090-1234')
    })

    it('clears corresponding error when field is updated', async () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      // Trigger validation error by submitting empty form
      await act(async () => {
        await result.current.actions.submit()
      })

      expect(result.current.errors.name).toBeDefined()

      act(() => {
        result.current.actions.handleChange('name', '山田太郎')
      })

      expect(result.current.errors.name).toBeUndefined()
    })

    it('updates marketingOptIn', () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      act(() => {
        result.current.actions.handleChange('marketingOptIn', true)
      })

      expect(result.current.form.marketingOptIn).toBe(true)
    })
  })

  describe('handleCourseSelect', () => {
    const courseOptions: ReservationCourseOption[] = [
      { id: 'course-1', label: 'コースA', durationMinutes: 60 },
      { id: 'course-2', label: 'コースB', durationMinutes: 90 },
      { id: 'course-3', label: 'コースC', durationMinutes: null },
    ]

    it('updates courseId and durationMinutes', () => {
      const { result } = renderHook(() =>
        useReservationForm({
          shopId: mockShopId,
          courseOptions,
        }),
      )

      act(() => {
        result.current.actions.handleCourseSelect('course-2')
      })

      expect(result.current.form.courseId).toBe('course-2')
      expect(result.current.form.durationMinutes).toBe(90)
    })

    it('keeps current duration when course has no durationMinutes', () => {
      const { result } = renderHook(() =>
        useReservationForm({
          shopId: mockShopId,
          courseOptions,
        }),
      )

      expect(result.current.form.durationMinutes).toBe(60)

      act(() => {
        result.current.actions.handleCourseSelect('course-3')
      })

      expect(result.current.form.courseId).toBe('course-3')
      expect(result.current.form.durationMinutes).toBe(60)
    })

    it('does nothing when selecting same course', () => {
      const { result } = renderHook(() =>
        useReservationForm({
          shopId: mockShopId,
          courseOptions,
        }),
      )

      const initialForm = result.current.form

      act(() => {
        result.current.actions.handleCourseSelect('course-1')
      })

      expect(result.current.form).toBe(initialForm)
    })
  })

  describe('selectedSlots effect', () => {
    it('updates desiredStart from selectedSlots', () => {
      const selectedSlots: ReservationSelectedSlot[] = [
        {
          startAt: '2025-01-20T14:00:00.000Z',
          endAt: '2025-01-20T15:00:00.000Z',
          date: '2025-01-20',
          status: 'open',
        },
      ]

      const { result } = renderHook(() =>
        useReservationForm({
          shopId: mockShopId,
          selectedSlots,
        }),
      )

      expect(result.current.form.desiredStart).toBe('2025-01-20T14:00:00.000Z')
    })
  })

  describe('validation', () => {
    it('validates empty name', async () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      act(() => {
        result.current.actions.handleChange('phone', '09012345678')
      })

      await act(async () => {
        await result.current.actions.submit()
      })

      expect(result.current.errors.name).toBe('お名前を入力してください。')
    })

    it('validates name length over 80 characters', async () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      act(() => {
        result.current.actions.handleChange('name', 'あ'.repeat(81))
        result.current.actions.handleChange('phone', '09012345678')
      })

      await act(async () => {
        await result.current.actions.submit()
      })

      expect(result.current.errors.name).toBe('お名前は80文字以内で入力してください。')
    })

    it('validates empty phone', async () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      act(() => {
        result.current.actions.handleChange('name', '山田太郎')
      })

      await act(async () => {
        await result.current.actions.submit()
      })

      expect(result.current.errors.phone).toBe('お電話番号を入力してください。')
    })

    it('validates phone number length (too short)', async () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      act(() => {
        result.current.actions.handleChange('name', '山田太郎')
        result.current.actions.handleChange('phone', '090123456') // 9 digits
      })

      await act(async () => {
        await result.current.actions.submit()
      })

      expect(result.current.errors.phone).toBe('お電話番号は10〜13桁の数字で入力してください。')
    })

    it('validates invalid email format', async () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      act(() => {
        result.current.actions.handleChange('name', '山田太郎')
        result.current.actions.handleChange('phone', '09012345678')
        result.current.actions.handleChange('email', 'invalid-email')
      })

      await act(async () => {
        await result.current.actions.submit()
      })

      expect(result.current.errors.email).toBe('メールアドレスの形式が正しくありません。')
    })

    it('accepts valid email format', async () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      act(() => {
        result.current.actions.handleChange('name', '山田太郎')
        result.current.actions.handleChange('phone', '09012345678')
        result.current.actions.handleChange('email', 'test@example.com')
      })

      await act(async () => {
        await result.current.actions.submit()
      })

      expect(result.current.errors.email).toBeUndefined()
    })

    it('allows empty email', async () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      act(() => {
        result.current.actions.handleChange('name', '山田太郎')
        result.current.actions.handleChange('phone', '09012345678')
      })

      await act(async () => {
        await result.current.actions.submit()
      })

      expect(result.current.errors.email).toBeUndefined()
    })
  })

  describe('minutesOptions', () => {
    it('returns default options', () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      expect(result.current.minutesOptions).toEqual([60, 90, 120, 150, 180])
    })

    it('includes custom duration in options', () => {
      const courseOptions: ReservationCourseOption[] = [
        { id: 'course-1', label: 'コースA', durationMinutes: 75 },
      ]

      const { result } = renderHook(() =>
        useReservationForm({
          shopId: mockShopId,
          courseOptions,
        }),
      )

      expect(result.current.minutesOptions).toContain(75)
      expect(result.current.minutesOptions).toEqual([60, 75, 90, 120, 150, 180])
    })
  })

  describe('selectedCourse', () => {
    const courseOptions: ReservationCourseOption[] = [
      { id: 'course-1', label: 'コースA', durationMinutes: 60, priceLabel: '¥5,000' },
      { id: 'course-2', label: 'コースB', durationMinutes: 90, priceLabel: '¥7,000' },
    ]

    it('returns selected course object', () => {
      const { result } = renderHook(() =>
        useReservationForm({
          shopId: mockShopId,
          courseOptions,
        }),
      )

      expect(result.current.selectedCourse).toEqual(courseOptions[0])

      act(() => {
        result.current.actions.handleCourseSelect('course-2')
      })

      expect(result.current.selectedCourse).toEqual(courseOptions[1])
    })

    it('returns null when no course selected', () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      expect(result.current.selectedCourse).toBeNull()
    })
  })

  describe('disabled state', () => {
    it('is true when canSubmit is false', () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: 'demo-shop' }),
      )

      expect(result.current.disabled).toBe(true)
    })

    it('is false when canSubmit is true and not pending', () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      expect(result.current.disabled).toBe(false)
    })
  })

  describe('submit with demo environment', () => {
    it('shows error toast when submitting in demo environment', async () => {
      const mockPush = vi.fn()
      const { useToast } = await import('../../useToast')
      vi.mocked(useToast).mockReturnValue({
        toasts: [],
        push: mockPush,
        remove: vi.fn(),
      })

      const { result } = renderHook(() =>
        useReservationForm({ shopId: 'demo-shop' }),
      )

      await act(async () => {
        await result.current.actions.submit()
      })

      expect(mockPush).toHaveBeenCalledWith(
        'error',
        'デモデータのため、この環境では予約送信できません。',
      )
    })
  })

  describe('conflictError', () => {
    it('can be dismissed', () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      expect(result.current.conflictError).toBeNull()

      act(() => {
        result.current.dismissConflictError()
      })

      expect(result.current.conflictError).toBeNull()
    })
  })

  describe('summaryText', () => {
    it('returns null when no submission has been made', () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      expect(result.current.summaryText).toBeNull()
    })
  })

  describe('copySummary', () => {
    it('returns false when summaryText is null', async () => {
      const { result } = renderHook(() =>
        useReservationForm({ shopId: mockShopId }),
      )

      let success: boolean = false
      await act(async () => {
        success = await result.current.actions.copySummary()
      })

      expect(success).toBe(false)
    })
  })
})
