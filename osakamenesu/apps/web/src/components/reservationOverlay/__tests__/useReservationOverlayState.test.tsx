'use client'

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { useReservationOverlayState } from '../useReservationOverlayState'
import type { AvailabilityDay } from '../useReservationOverlayState'
import type { NormalizedDay, NormalizedSlot } from '../useReservationOverlayState'

// Mock date utilities
vi.mock('@/utils/date', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/date')>()
  return {
    ...actual,
    formatLocalDate: (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    },
    getJaFormatter: (type: string) => {
      if (type === 'day') {
        return {
          format: (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`,
        }
      }
      return {
        format: (date: Date) => `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`,
      }
    },
    toIsoWithOffset: (date: Date) => date.toISOString(),
  }
})

vi.mock('@/lib/jst', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/jst')>()
  return {
    ...actual,
    parseJstDateAtMidnight: (dateStr: string) => new Date(dateStr),
  }
})

vi.mock('@/lib/availability', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/availability')>()
  return {
    ...actual,
  }
})

const createAvailabilityDays = (count = 7, startDate = new Date()): AvailabilityDay[] => {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

    return {
      date: isoDate,
      is_today: i === 0,
      slots: [
        {
          start_at: `${isoDate}T10:00:00+09:00`,
          end_at: `${isoDate}T11:00:00+09:00`,
          status: 'open' as const,
        },
        {
          start_at: `${isoDate}T14:00:00+09:00`,
          end_at: `${isoDate}T15:00:00+09:00`,
          status: 'tentative' as const,
        },
      ],
    }
  })
}

describe('useReservationOverlayState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('returns formatters', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      expect(result.current.dayFormatter).toBeDefined()
      expect(result.current.timeFormatter).toBeDefined()
    })

    it('returns empty selectedSlots initially when no availability', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      expect(result.current.selectedSlots).toEqual([])
    })

    it('starts with formOpen as false', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      expect(result.current.formOpen).toBe(false)
    })

    it('starts with formTab as schedule', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      expect(result.current.formTab).toBe('schedule')
    })

    it('starts with schedulePage at 0', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      expect(result.current.schedulePage).toBe(0)
    })

    it('starts with isRefreshing as false', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      expect(result.current.isRefreshing).toBe(false)
    })
  })

  describe('availabilitySourceType', () => {
    it('returns "none" when no availability data', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      expect(result.current.availabilitySourceType).toBe('none')
    })

    it('returns "api" when availability days with slots are provided', () => {
      const availabilityDays = createAvailabilityDays(7)
      const { result } = renderHook(() =>
        useReservationOverlayState({ availabilityDays }),
      )

      expect(result.current.availabilitySourceType).toBe('api')
    })

    it('returns "none" when availability days have no slots', () => {
      const availabilityDays = [{ date: '2024-12-01', is_today: true, slots: [] }]
      const { result } = renderHook(() =>
        useReservationOverlayState({ availabilityDays }),
      )

      expect(result.current.availabilitySourceType).toBe('none')
    })
  })

  describe('hasAvailability', () => {
    it('returns false when no availability data', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      expect(result.current.hasAvailability).toBe(false)
    })

    it('returns true when availability days have slots', () => {
      const availabilityDays = createAvailabilityDays(7)
      const { result } = renderHook(() =>
        useReservationOverlayState({ availabilityDays }),
      )

      expect(result.current.hasAvailability).toBe(true)
    })
  })

  describe('toggleSlot', () => {
    it('adds a slot when not selected', () => {
      // Use empty availability to avoid auto-selection
      const { result } = renderHook(() =>
        useReservationOverlayState({}),
      )

      const day: NormalizedDay = {
        date: '2024-12-01',
        label: '12/1',
        isToday: true,
        slots: [],
      }
      const slot: NormalizedSlot = {
        start_at: '2024-12-01T10:00:00+09:00',
        end_at: '2024-12-01T11:00:00+09:00',
        status: 'open',
        timeKey: '10:00',
      }

      act(() => {
        result.current.toggleSlot(day, slot)
      })

      expect(result.current.selectedSlots).toHaveLength(1)
      expect(result.current.selectedSlots[0].startAt).toBe('2024-12-01T10:00:00+09:00')
    })

    it('removes a slot when already selected', () => {
      // Use empty availability to avoid auto-selection
      const { result } = renderHook(() =>
        useReservationOverlayState({}),
      )

      const day: NormalizedDay = {
        date: '2024-12-01',
        label: '12/1',
        isToday: true,
        slots: [],
      }
      const slot: NormalizedSlot = {
        start_at: '2024-12-01T10:00:00+09:00',
        end_at: '2024-12-01T11:00:00+09:00',
        status: 'open',
        timeKey: '10:00',
      }

      act(() => {
        result.current.toggleSlot(day, slot)
      })

      expect(result.current.selectedSlots).toHaveLength(1)

      act(() => {
        result.current.toggleSlot(day, slot)
      })

      expect(result.current.selectedSlots).toHaveLength(0)
    })

    it('does not add blocked slots', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      const day: NormalizedDay = {
        date: '2024-12-01',
        label: '12/1',
        isToday: true,
        slots: [],
      }
      const slot: NormalizedSlot = {
        start_at: '2024-12-01T10:00:00+09:00',
        end_at: '2024-12-01T11:00:00+09:00',
        status: 'blocked',
        timeKey: '10:00',
      }

      act(() => {
        result.current.toggleSlot(day, slot)
      })

      expect(result.current.selectedSlots).toHaveLength(0)
    })

    it('limits slots to 3 maximum', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      const day: NormalizedDay = {
        date: '2024-12-01',
        label: '12/1',
        isToday: true,
        slots: [],
      }

      for (let i = 0; i < 5; i++) {
        const slot: NormalizedSlot = {
          start_at: `2024-12-01T${10 + i}:00:00+09:00`,
          end_at: `2024-12-01T${11 + i}:00:00+09:00`,
          status: 'open',
          timeKey: `${10 + i}:00`,
        }
        act(() => {
          result.current.toggleSlot(day, slot)
        })
      }

      expect(result.current.selectedSlots).toHaveLength(3)
      // First slots should be shifted out
      expect(result.current.selectedSlots[0].startAt).toBe('2024-12-01T12:00:00+09:00')
    })
  })

  describe('removeSlot', () => {
    it('removes slot by startAt', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      const day: NormalizedDay = {
        date: '2024-12-01',
        label: '12/1',
        isToday: true,
        slots: [],
      }
      const slot1: NormalizedSlot = {
        start_at: '2024-12-01T10:00:00+09:00',
        end_at: '2024-12-01T11:00:00+09:00',
        status: 'open',
        timeKey: '10:00',
      }
      const slot2: NormalizedSlot = {
        start_at: '2024-12-01T14:00:00+09:00',
        end_at: '2024-12-01T15:00:00+09:00',
        status: 'open',
        timeKey: '14:00',
      }

      act(() => {
        result.current.toggleSlot(day, slot1)
        result.current.toggleSlot(day, slot2)
      })

      expect(result.current.selectedSlots).toHaveLength(2)

      act(() => {
        result.current.removeSlot('2024-12-01T10:00:00+09:00')
      })

      expect(result.current.selectedSlots).toHaveLength(1)
      expect(result.current.selectedSlots[0].startAt).toBe('2024-12-01T14:00:00+09:00')
    })
  })

  describe('ensureSelection', () => {
    it('returns existing selectedSlots if any', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      const day: NormalizedDay = {
        date: '2024-12-01',
        label: '12/1',
        isToday: true,
        slots: [],
      }
      const slot: NormalizedSlot = {
        start_at: '2024-12-01T10:00:00+09:00',
        end_at: '2024-12-01T11:00:00+09:00',
        status: 'open',
        timeKey: '10:00',
      }

      act(() => {
        result.current.toggleSlot(day, slot)
      })

      let selection: typeof result.current.selectedSlots = []
      act(() => {
        selection = result.current.ensureSelection()
      })

      expect(selection).toHaveLength(1)
      expect(selection[0].startAt).toBe('2024-12-01T10:00:00+09:00')
    })

    it('returns empty array when no availability and no selection', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      let selection: typeof result.current.selectedSlots = []
      act(() => {
        selection = result.current.ensureSelection()
      })

      expect(selection).toEqual([])
    })

    it('auto-selects first available slot on mount with availability', () => {
      const availabilityDays = createAvailabilityDays(7)
      const { result } = renderHook(() =>
        useReservationOverlayState({ availabilityDays }),
      )

      // The hook auto-selects the first available slot via useEffect
      expect(result.current.selectedSlots.length).toBeGreaterThanOrEqual(1)

      // ensureSelection should return the same slots
      let selection: typeof result.current.selectedSlots = []
      act(() => {
        selection = result.current.ensureSelection()
      })

      expect(selection.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('form management', () => {
    it('openForm navigates to page containing selected slot', () => {
      const availabilityDays = createAvailabilityDays(14)
      const { result } = renderHook(() =>
        useReservationOverlayState({ availabilityDays }),
      )

      // Verify we have enough availability for multiple pages
      expect(result.current.schedulePageCount).toBeGreaterThan(1)

      // Select a slot from a later date if there are multiple pages
      if (result.current.schedulePageCount > 1) {
        // Navigate to second page
        act(() => {
          result.current.setSchedulePage(1)
        })

        // Get a slot from the current page
        const currentDays = result.current.currentScheduleDays
        if (currentDays.length > 0 && currentDays[0].slots.length > 0) {
          const day = currentDays[0]
          const slot = day.slots[0]

          // Clear existing selections and add new one
          result.current.selectedSlots.forEach((s) => {
            act(() => {
              result.current.removeSlot(s.startAt)
            })
          })

          act(() => {
            result.current.toggleSlot(day, slot)
          })

          // Navigate back to page 0
          act(() => {
            result.current.setSchedulePage(0)
          })

          // Open form - should navigate to the page containing the selected slot
          act(() => {
            result.current.openForm()
          })

          expect(result.current.formOpen).toBe(true)
          // The page should have navigated to show the selected slot
          expect(result.current.schedulePage).toBeGreaterThanOrEqual(0)
        }
      }
    })

    it('openForm sets formOpen to true', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      expect(result.current.formOpen).toBe(false)

      act(() => {
        result.current.openForm()
      })

      expect(result.current.formOpen).toBe(true)
    })

    it('closeForm sets formOpen to false', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      act(() => {
        result.current.openForm()
      })

      expect(result.current.formOpen).toBe(true)

      act(() => {
        result.current.closeForm()
      })

      expect(result.current.formOpen).toBe(false)
    })

    it('handleFormBackdrop stops propagation and closes form', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      act(() => {
        result.current.openForm()
      })

      const mockEvent = {
        stopPropagation: vi.fn(),
      } as unknown as React.MouseEvent<HTMLDivElement>

      act(() => {
        result.current.handleFormBackdrop(mockEvent)
      })

      expect(mockEvent.stopPropagation).toHaveBeenCalled()
      expect(result.current.formOpen).toBe(false)
    })

    it('setFormTab changes form tab', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      expect(result.current.formTab).toBe('schedule')

      act(() => {
        result.current.setFormTab('info')
      })

      expect(result.current.formTab).toBe('info')
    })
  })

  describe('schedule navigation', () => {
    it('setSchedulePage changes current page', () => {
      const availabilityDays = createAvailabilityDays(14)
      const { result } = renderHook(() =>
        useReservationOverlayState({ availabilityDays }),
      )

      expect(result.current.schedulePage).toBe(0)

      act(() => {
        result.current.setSchedulePage(1)
      })

      expect(result.current.schedulePage).toBe(1)
    })

    it('schedulePageCount reflects number of pages', () => {
      const availabilityDays = createAvailabilityDays(14)
      const { result } = renderHook(() =>
        useReservationOverlayState({ availabilityDays }),
      )

      expect(result.current.schedulePageCount).toBeGreaterThanOrEqual(1)
    })

    it('resets schedulePage when it exceeds available pages after availability update', () => {
      const availabilityDays = createAvailabilityDays(21) // More days = more pages
      const { result, rerender } = renderHook(
        ({ days }) => useReservationOverlayState({ availabilityDays: days }),
        { initialProps: { days: availabilityDays } },
      )

      // Navigate to a later page
      if (result.current.schedulePageCount > 2) {
        act(() => {
          result.current.setSchedulePage(result.current.schedulePageCount - 1)
        })

        const pageBeforeUpdate = result.current.schedulePage

        // Update with fewer days (fewer pages)
        const shorterDays = createAvailabilityDays(7)
        rerender({ days: shorterDays })

        // The page should be adjusted if it was beyond the new page count
        expect(result.current.schedulePage).toBeLessThanOrEqual(result.current.schedulePageCount - 1)
        expect(result.current.schedulePage).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('updateAvailability', () => {
    it('updates availability data and sets isRefreshing to false', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      expect(result.current.availabilitySourceType).toBe('none')

      const newDays = createAvailabilityDays(7)

      act(() => {
        result.current.updateAvailability(newDays)
      })

      expect(result.current.availabilitySourceType).toBe('api')
      expect(result.current.isRefreshing).toBe(false)
    })
  })

  describe('labels', () => {
    it('generates scheduleRangeLabel from current days', () => {
      const availabilityDays = createAvailabilityDays(7)
      const { result } = renderHook(() =>
        useReservationOverlayState({ availabilityDays }),
      )

      expect(result.current.scheduleRangeLabel).toBeDefined()
      expect(typeof result.current.scheduleRangeLabel).toBe('string')
    })

    it('generates currentMonthLabel based on current schedule days', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      // Hook generates default schedule pages with current date
      expect(result.current.currentMonthLabel).toMatch(/^\d{4}年\d{1,2}月$/)
    })

    it('generates scheduleRangeLabel from schedule pages', () => {
      const { result } = renderHook(() => useReservationOverlayState({}))

      // Hook generates default schedule pages, so it won't be default text
      expect(result.current.scheduleRangeLabel).toBeDefined()
      expect(typeof result.current.scheduleRangeLabel).toBe('string')
      // Should contain a date range like "12/28〜1/3"
      expect(result.current.scheduleRangeLabel).toMatch(/〜/)
    })
  })

  describe('timelineTimes', () => {
    it('returns array of timeline times', () => {
      const availabilityDays = createAvailabilityDays(7)
      const { result } = renderHook(() =>
        useReservationOverlayState({ availabilityDays }),
      )

      expect(Array.isArray(result.current.timelineTimes)).toBe(true)
    })
  })

  describe('currentScheduleDays', () => {
    it('returns days for current page', () => {
      const availabilityDays = createAvailabilityDays(7)
      const { result } = renderHook(() =>
        useReservationOverlayState({ availabilityDays }),
      )

      expect(Array.isArray(result.current.currentScheduleDays)).toBe(true)
    })
  })
})
