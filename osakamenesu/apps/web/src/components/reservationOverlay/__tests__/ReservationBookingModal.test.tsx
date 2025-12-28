import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ReservationBookingModal } from '../ReservationBookingModal'
import type { ReservationOverlayState } from '../useReservationOverlayState'

// Mock child components
vi.mock('@/components/ReservationForm', () => ({
  default: function MockReservationForm() {
    return <div data-testid="reservation-form">ReservationForm</div>
  },
}))

vi.mock('@/components/reservation', () => ({
  ReservationAvailabilitySection: function MockAvailabilitySection() {
    return <div data-testid="availability-section">AvailabilitySection</div>
  },
  SelectedSlotList: function MockSelectedSlotList({
    slots,
    onRemove,
  }: {
    slots: Array<{ startAt: string }>
    onRemove: (startAt: string) => void
  }) {
    return (
      <div data-testid="selected-slot-list">
        {slots.map((slot) => (
          <button
            key={slot.startAt}
            onClick={() => onRemove(slot.startAt)}
            data-testid={`remove-slot-${slot.startAt}`}
          >
            Remove {slot.startAt}
          </button>
        ))}
      </div>
    )
  },
}))

const mockHit = {
  id: 'hit-1',
  therapistId: 'therapist-1',
  staffId: 'staff-1',
  name: 'テストセラピスト',
  alias: null,
  headline: null,
  specialties: [],
  avatarUrl: null,
  rating: null,
  reviewCount: null,
  shopId: 'shop-1',
  shopSlug: null,
  shopName: 'テストショップ',
  shopArea: '大阪',
  shopAreaName: null,
  todayAvailable: false,
  nextAvailableSlot: null,
}

const mockCourseOptions = [{ id: 'course-1', value: 'course-1', label: '60分コース', price: 10000 }]

const mockBookingSteps = [
  { key: 'schedule', label: '日程', description: '希望日時を選択' },
  { key: 'course', label: 'コース', description: 'メニューを選択' },
  { key: 'info', label: '情報', description: 'お客様情報を入力' },
] as const

const mockStatusBadgeClasses = {
  open: 'bg-green-500',
  tentative: 'bg-yellow-500',
  blocked: 'bg-gray-500',
}

const createMockState = (overrides: Partial<ReservationOverlayState> = {}): ReservationOverlayState => ({
  formOpen: true,
  closeForm: vi.fn(),
  handleFormBackdrop: vi.fn(),
  formTab: 'schedule' as const,
  setFormTab: vi.fn(),
  currentScheduleDays: [],
  timelineTimes: [],
  selectedSlots: [],
  toggleSlot: vi.fn(),
  dayFormatter: new Intl.DateTimeFormat('ja-JP'),
  timeFormatter: new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }),
  availabilitySourceType: 'api' as const,
  schedulePage: 0,
  schedulePageCount: 1,
  setSchedulePage: vi.fn(),
  scheduleRangeLabel: '12/1 - 12/7',
  currentMonthLabel: '2024年12月',
  removeSlot: vi.fn(),
  ensureSelection: vi.fn(() => []),
  hasAvailability: true,
  openForm: vi.fn(),
  updateAvailability: vi.fn(),
  isRefreshing: false,
  ...overrides,
})

describe('ReservationBookingModal', () => {
  it('returns null when formOpen is false', () => {
    const state = createMockState({ formOpen: false })
    const { container } = render(
      <ReservationBookingModal
        hit={mockHit}
        courseOptions={mockCourseOptions}
        state={state}
        onRemoveSlot={vi.fn()}
        bookingSteps={mockBookingSteps}
        statusBadgeClasses={mockStatusBadgeClasses}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders modal with shop name when formOpen is true', () => {
    const state = createMockState({ formOpen: true })
    render(
      <ReservationBookingModal
        hit={mockHit}
        courseOptions={mockCourseOptions}
        state={state}
        onRemoveSlot={vi.fn()}
        bookingSteps={mockBookingSteps}
        statusBadgeClasses={mockStatusBadgeClasses}
      />,
    )
    expect(screen.getByText('テストセラピスト')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'テストセラピストの予約フォーム')
  })

  it('calls closeForm when close button is clicked', () => {
    const closeForm = vi.fn()
    const state = createMockState({ formOpen: true, closeForm })
    render(
      <ReservationBookingModal
        hit={mockHit}
        courseOptions={mockCourseOptions}
        state={state}
        onRemoveSlot={vi.fn()}
        bookingSteps={mockBookingSteps}
        statusBadgeClasses={mockStatusBadgeClasses}
      />,
    )
    fireEvent.click(screen.getByLabelText('予約フォームを閉じる'))
    expect(closeForm).toHaveBeenCalledTimes(1)
  })

  it('calls handleFormBackdrop when backdrop is clicked', () => {
    const handleFormBackdrop = vi.fn()
    const state = createMockState({ formOpen: true, handleFormBackdrop })
    render(
      <ReservationBookingModal
        hit={mockHit}
        courseOptions={mockCourseOptions}
        state={state}
        onRemoveSlot={vi.fn()}
        bookingSteps={mockBookingSteps}
        statusBadgeClasses={mockStatusBadgeClasses}
      />,
    )
    // Find backdrop element (has aria-hidden="true")
    const backdrop = document.querySelector('[aria-hidden="true"]')
    expect(backdrop).toBeInTheDocument()
    fireEvent.click(backdrop!)
    expect(handleFormBackdrop).toHaveBeenCalledTimes(1)
  })

  it('renders progress steps', () => {
    const state = createMockState({ formOpen: true })
    render(
      <ReservationBookingModal
        hit={mockHit}
        courseOptions={mockCourseOptions}
        state={state}
        onRemoveSlot={vi.fn()}
        bookingSteps={mockBookingSteps}
        statusBadgeClasses={mockStatusBadgeClasses}
      />,
    )
    expect(screen.getByText('日程')).toBeInTheDocument()
    expect(screen.getByText('コース')).toBeInTheDocument()
    expect(screen.getByText('情報')).toBeInTheDocument()
  })

  it('switches tab when mobile tab buttons are clicked', () => {
    const setFormTab = vi.fn()
    const state = createMockState({ formOpen: true, formTab: 'schedule', setFormTab })
    render(
      <ReservationBookingModal
        hit={mockHit}
        courseOptions={mockCourseOptions}
        state={state}
        onRemoveSlot={vi.fn()}
        bookingSteps={mockBookingSteps}
        statusBadgeClasses={mockStatusBadgeClasses}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /お客様情報/i }))
    expect(setFormTab).toHaveBeenCalledWith('info')
  })

  it('shows schedule complete step when slots are selected', () => {
    const state = createMockState({
      formOpen: true,
      selectedSlots: [{ startAt: '2024-12-01T10:00:00+09:00', endAt: '2024-12-01T11:00:00+09:00', date: '2024-12-01', status: 'open' as const }],
    })
    render(
      <ReservationBookingModal
        hit={mockHit}
        courseOptions={mockCourseOptions}
        state={state}
        onRemoveSlot={vi.fn()}
        bookingSteps={mockBookingSteps}
        statusBadgeClasses={mockStatusBadgeClasses}
      />,
    )
    // Schedule step should show checkmark (complete)
    expect(screen.getByText('1枠選択中')).toBeInTheDocument()
  })

  it('calls onRemoveSlot when slot is removed', () => {
    const onRemoveSlot = vi.fn()
    const state = createMockState({
      formOpen: true,
      selectedSlots: [{ startAt: '2024-12-01T10:00:00+09:00', endAt: '2024-12-01T11:00:00+09:00', date: '2024-12-01', status: 'open' as const }],
    })
    render(
      <ReservationBookingModal
        hit={mockHit}
        courseOptions={mockCourseOptions}
        state={state}
        onRemoveSlot={onRemoveSlot}
        bookingSteps={mockBookingSteps}
        statusBadgeClasses={mockStatusBadgeClasses}
      />,
    )
    fireEvent.click(screen.getByTestId('remove-slot-2024-12-01T10:00:00+09:00'))
    expect(onRemoveSlot).toHaveBeenCalledWith('2024-12-01T10:00:00+09:00')
  })

  it('renders ReservationForm with correct props', () => {
    const state = createMockState({ formOpen: true })
    render(
      <ReservationBookingModal
        hit={mockHit}
        tel="03-1234-5678"
        lineId="@line123"
        courseOptions={mockCourseOptions}
        state={state}
        onRemoveSlot={vi.fn()}
        bookingSteps={mockBookingSteps}
        statusBadgeClasses={mockStatusBadgeClasses}
      />,
    )
    expect(screen.getByTestId('reservation-form')).toBeInTheDocument()
  })

  it('shows info tab content when formTab is info', () => {
    const state = createMockState({ formOpen: true, formTab: 'info' })
    render(
      <ReservationBookingModal
        hit={mockHit}
        courseOptions={mockCourseOptions}
        state={state}
        onRemoveSlot={vi.fn()}
        bookingSteps={mockBookingSteps}
        statusBadgeClasses={mockStatusBadgeClasses}
      />,
    )
    // Multiple elements contain "お客様情報", check header specifically
    expect(screen.getByRole('heading', { name: 'お客様情報' })).toBeInTheDocument()
  })

  it('disables proceed button when no slots selected', () => {
    const state = createMockState({ formOpen: true, selectedSlots: [] })
    render(
      <ReservationBookingModal
        hit={mockHit}
        courseOptions={mockCourseOptions}
        state={state}
        onRemoveSlot={vi.fn()}
        bookingSteps={mockBookingSteps}
        statusBadgeClasses={mockStatusBadgeClasses}
      />,
    )
    const proceedButton = screen.getByRole('button', { name: /入力フォームへ進む/i })
    expect(proceedButton).toBeDisabled()
  })

  it('enables proceed button when slots are selected', () => {
    const state = createMockState({
      formOpen: true,
      selectedSlots: [{ startAt: '2024-12-01T10:00:00+09:00', endAt: '2024-12-01T11:00:00+09:00', date: '2024-12-01', status: 'open' as const }],
    })
    render(
      <ReservationBookingModal
        hit={mockHit}
        courseOptions={mockCourseOptions}
        state={state}
        onRemoveSlot={vi.fn()}
        bookingSteps={mockBookingSteps}
        statusBadgeClasses={mockStatusBadgeClasses}
      />,
    )
    const proceedButton = screen.getByRole('button', { name: /入力フォームへ進む/i })
    expect(proceedButton).not.toBeDisabled()
  })

  it('calls setFormTab when proceed button is clicked', () => {
    const setFormTab = vi.fn()
    const state = createMockState({
      formOpen: true,
      selectedSlots: [{ startAt: '2024-12-01T10:00:00+09:00', endAt: '2024-12-01T11:00:00+09:00', date: '2024-12-01', status: 'open' as const }],
      setFormTab,
    })
    render(
      <ReservationBookingModal
        hit={mockHit}
        courseOptions={mockCourseOptions}
        state={state}
        onRemoveSlot={vi.fn()}
        bookingSteps={mockBookingSteps}
        statusBadgeClasses={mockStatusBadgeClasses}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /入力フォームへ進む/i }))
    expect(setFormTab).toHaveBeenCalledWith('info')
  })

  it('does not propagate click events from dialog content', () => {
    const handleFormBackdrop = vi.fn()
    const state = createMockState({ formOpen: true, handleFormBackdrop })
    render(
      <ReservationBookingModal
        hit={mockHit}
        courseOptions={mockCourseOptions}
        state={state}
        onRemoveSlot={vi.fn()}
        bookingSteps={mockBookingSteps}
        statusBadgeClasses={mockStatusBadgeClasses}
      />,
    )
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)
    expect(handleFormBackdrop).not.toHaveBeenCalled()
  })
})
