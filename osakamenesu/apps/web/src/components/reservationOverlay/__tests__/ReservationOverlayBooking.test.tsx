'use client'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import ReservationOverlayBooking from '../ReservationOverlayBooking'
import type { ReservationOverlayState } from '../useReservationOverlayState'
import type { TherapistHit } from '@/components/staff/TherapistCard'

// Mock child components
vi.mock('../ReservationBookingModal', () => ({
  ReservationBookingModal: () => <div data-testid="booking-modal">Booking Modal</div>,
}))

vi.mock('@/components/reservation', () => ({
  ReservationAvailabilitySection: ({ onRequestReservation }: { onRequestReservation: () => void }) => (
    <div data-testid="availability-section">
      <button onClick={onRequestReservation}>Request Reservation</button>
    </div>
  ),
  ReservationScheduleHeader: ({
    onPrev,
    onNext,
    onReset,
    onRefresh,
    isRefreshing,
  }: {
    onPrev: () => void
    onNext: () => void
    onReset: () => void
    onRefresh?: () => Promise<void>
    isRefreshing?: boolean
  }) => (
    <div data-testid="schedule-header">
      <button onClick={onPrev} data-testid="prev-btn">Prev</button>
      <button onClick={onNext} data-testid="next-btn">Next</button>
      <button onClick={onReset} data-testid="reset-btn">Reset</button>
      {onRefresh && (
        <button onClick={onRefresh} data-testid="refresh-btn">
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      )}
    </div>
  ),
  ReservationContactList: () => <div data-testid="contact-list">Contact List</div>,
  SelectedSlotList: () => <div data-testid="slot-list">Slot List</div>,
}))

const mockHit: TherapistHit = {
  id: 'test-id',
  therapistId: 'therapist-uuid',
  staffId: 'staff-identifier',
  name: 'テストセラピスト',
  alias: null,
  headline: null,
  specialties: [],
  avatarUrl: null,
  rating: null,
  reviewCount: null,
  shopId: 'shop-uuid',
  shopSlug: null,
  shopName: 'テスト店舗',
  shopArea: '大阪',
  shopAreaName: null,
  todayAvailable: true,
  nextAvailableSlot: null,
}

const createMockState = (overrides: Partial<ReservationOverlayState> = {}): ReservationOverlayState => ({
  dayFormatter: new Intl.DateTimeFormat('ja-JP'),
  timeFormatter: new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }),
  scheduleRangeLabel: '12/1 - 12/7',
  currentMonthLabel: '2024年12月',
  schedulePage: 0,
  schedulePageCount: 4,
  setSchedulePage: vi.fn(),
  currentScheduleDays: [],
  timelineTimes: [],
  selectedSlots: [],
  toggleSlot: vi.fn(),
  removeSlot: vi.fn(),
  ensureSelection: vi.fn().mockReturnValue([]),
  hasAvailability: true,
  availabilitySourceType: 'api',
  formOpen: false,
  formTab: 'schedule',
  setFormTab: vi.fn(),
  openForm: vi.fn(),
  closeForm: vi.fn(),
  handleFormBackdrop: vi.fn(),
  updateAvailability: vi.fn(),
  isRefreshing: false,
  ...overrides,
})

const defaultProps = {
  hit: mockHit,
  contactItems: [],
  courseOptions: [],
  onOpenForm: vi.fn(),
  state: createMockState(),
}

describe('ReservationOverlayBooking', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ days: [] }),
    } as Response)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders main components', () => {
      render(<ReservationOverlayBooking {...defaultProps} />)
      expect(screen.getByTestId('schedule-header')).toBeInTheDocument()
      expect(screen.getByTestId('availability-section')).toBeInTheDocument()
      expect(screen.getByTestId('slot-list')).toBeInTheDocument()
      expect(screen.getByTestId('contact-list')).toBeInTheDocument()
      expect(screen.getByTestId('booking-modal')).toBeInTheDocument()
    })

    it('renders reservation form button', () => {
      render(<ReservationOverlayBooking {...defaultProps} />)
      expect(screen.getByText('予約フォームに進む')).toBeInTheDocument()
    })
  })

  describe('sample data warning', () => {
    it('does not show sample data warning by default', () => {
      render(<ReservationOverlayBooking {...defaultProps} />)
      expect(screen.queryByText('サンプルデータを表示中')).not.toBeInTheDocument()
    })

    it('shows sample data warning when API returns sample flag', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ days: [], sample: true }),
      } as Response)

      render(<ReservationOverlayBooking {...defaultProps} therapistId="test-therapist" />)

      await waitFor(() => {
        expect(screen.getByText('サンプルデータを表示中')).toBeInTheDocument()
      })
    })
  })

  describe('schedule navigation', () => {
    it('calls setSchedulePage when prev button is clicked', () => {
      const setSchedulePage = vi.fn()
      const state = createMockState({ setSchedulePage, schedulePage: 1 })
      render(<ReservationOverlayBooking {...defaultProps} state={state} />)

      fireEvent.click(screen.getByTestId('prev-btn'))

      expect(setSchedulePage).toHaveBeenCalled()
    })

    it('calls setSchedulePage when next button is clicked', () => {
      const setSchedulePage = vi.fn()
      const state = createMockState({ setSchedulePage, schedulePage: 0 })
      render(<ReservationOverlayBooking {...defaultProps} state={state} />)

      fireEvent.click(screen.getByTestId('next-btn'))

      expect(setSchedulePage).toHaveBeenCalled()
    })

    it('calls setSchedulePage(0) when reset button is clicked', () => {
      const setSchedulePage = vi.fn()
      const state = createMockState({ setSchedulePage, schedulePage: 2 })
      render(<ReservationOverlayBooking {...defaultProps} state={state} />)

      fireEvent.click(screen.getByTestId('reset-btn'))

      expect(setSchedulePage).toHaveBeenCalledWith(0)
    })
  })

  describe('form opening', () => {
    it('calls onOpenForm when form button is clicked', () => {
      const onOpenForm = vi.fn()
      render(<ReservationOverlayBooking {...defaultProps} onOpenForm={onOpenForm} />)

      fireEvent.click(screen.getByText('予約フォームに進む'))

      expect(onOpenForm).toHaveBeenCalled()
    })

    it('calls onOpenForm from availability section', () => {
      const onOpenForm = vi.fn()
      render(<ReservationOverlayBooking {...defaultProps} onOpenForm={onOpenForm} />)

      fireEvent.click(screen.getByText('Request Reservation'))

      expect(onOpenForm).toHaveBeenCalled()
    })
  })

  describe('availability fetching', () => {
    it('fetches availability when therapistId is provided', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ days: [{ date: '2024-12-01', slots: [] }] }),
      } as Response)

      const updateAvailability = vi.fn()
      const state = createMockState({ updateAvailability })

      render(
        <ReservationOverlayBooking
          {...defaultProps}
          state={state}
          therapistId="test-therapist-id"
        />,
      )

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/guest/therapists/test-therapist-id/availability_slots'),
          expect.any(Object),
        )
      })

      await waitFor(() => {
        expect(updateAvailability).toHaveBeenCalledWith([{ date: '2024-12-01', slots: [] }])
      })
    })

    it('does not fetch when therapistId is not provided', () => {
      const fetchSpy = vi.spyOn(global, 'fetch')

      render(<ReservationOverlayBooking {...defaultProps} therapistId={undefined} />)

      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('handles fetch error gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))

      render(<ReservationOverlayBooking {...defaultProps} therapistId="test-therapist" />)

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[ReservationOverlayBooking] Failed to fetch fresh availability:',
          expect.any(Error),
        )
      })

      consoleWarnSpy.mockRestore()
    })

    it('handles non-ok response', async () => {
      const updateAvailability = vi.fn()
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        json: async () => ({}),
      } as Response)

      const state = createMockState({ updateAvailability })

      render(
        <ReservationOverlayBooking
          {...defaultProps}
          state={state}
          therapistId="test-therapist"
        />,
      )

      // Wait a bit for the effect to run
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(updateAvailability).not.toHaveBeenCalled()
    })

    it('only fetches once even if component rerenders', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ days: [] }),
      } as Response)

      const { rerender } = render(
        <ReservationOverlayBooking {...defaultProps} therapistId="test-therapist" />,
      )

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1)
      })

      rerender(<ReservationOverlayBooking {...defaultProps} therapistId="test-therapist" />)

      // Still only one call
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('refresh functionality', () => {
    it('passes onRefresh to header when provided', () => {
      const onRefresh = vi.fn().mockResolvedValue(undefined)

      render(<ReservationOverlayBooking {...defaultProps} onRefresh={onRefresh} />)

      expect(screen.getByTestId('refresh-btn')).toBeInTheDocument()
    })

    it('shows refreshing state when isPolling is true', () => {
      const onRefresh = vi.fn().mockResolvedValue(undefined)

      render(<ReservationOverlayBooking {...defaultProps} onRefresh={onRefresh} isPolling={true} />)

      // The mock shows "Refreshing..." when isRefreshing is true
      // isRefreshing || isPolling should make it show refreshing state
      expect(screen.getByTestId('refresh-btn')).toHaveTextContent('Refreshing...')
    })

    it('shows refreshing state when state.isRefreshing is true', () => {
      const state = createMockState({ isRefreshing: true })
      const onRefresh = vi.fn().mockResolvedValue(undefined)

      render(<ReservationOverlayBooking {...defaultProps} state={state} onRefresh={onRefresh} />)

      expect(screen.getByTestId('refresh-btn')).toHaveTextContent('Refreshing...')
    })
  })
})
