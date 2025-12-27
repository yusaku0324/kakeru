/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TherapistSchedule, type TherapistScheduleSlot } from '../TherapistSchedule'

// Mock next/navigation
const mockReplace = vi.fn()
const mockPathname = '/shops/test-shop/therapists/1'
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}))

// Mock @/lib/jst
vi.mock('@/lib/jst', () => ({
  formatDateISO: (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },
}))

// Mock @/utils/date
vi.mock('@/utils/date', () => ({
  getJaFormatter: (type: string) => ({
    format: (date: Date) => {
      if (type === 'day') {
        const month = date.getMonth() + 1
        const day = date.getDate()
        return `${month}/${day}(月)`
      }
      if (type === 'time') {
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${hours}:${minutes}`
      }
      return date.toISOString()
    },
  }),
}))

// Mock @/lib/schedule
vi.mock('@/lib/schedule', () => ({
  formatSlotJp: (slot: TherapistScheduleSlot) => {
    const date = new Date(slot.start)
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00〜`
  },
  getNextAvailableSlot: (slots: TherapistScheduleSlot[]) => {
    return slots.find(s => s.status === 'open' || s.status === 'tentative') || null
  },
}))

describe('TherapistSchedule', () => {
  const todayIso = (() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })()

  const tomorrowIso = (() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const year = tomorrow.getFullYear()
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const day = String(tomorrow.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })()

  const mockDays = [
    {
      date: todayIso,
      is_today: true,
      slots: [
        { start_at: `${todayIso}T10:00:00`, end_at: `${todayIso}T11:00:00`, status: 'open' as const },
        { start_at: `${todayIso}T11:00:00`, end_at: `${todayIso}T12:00:00`, status: 'tentative' as const },
        { start_at: `${todayIso}T14:00:00`, end_at: `${todayIso}T15:00:00`, status: 'blocked' as const },
      ],
    },
    {
      date: tomorrowIso,
      is_today: false,
      slots: [
        { start_at: `${tomorrowIso}T09:00:00`, end_at: `${tomorrowIso}T10:00:00`, status: 'open' as const },
      ],
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders schedule section', () => {
      render(<TherapistSchedule days={mockDays} />)
      expect(screen.getByText('空き枠サマリー')).toBeInTheDocument()
    })

    it('renders all days', () => {
      render(<TherapistSchedule days={mockDays} />)
      // "今日" appears in day chip and also in timeline label
      expect(screen.getAllByText('今日').length).toBeGreaterThanOrEqual(1)
      // "明日" appears in day chip
      expect(screen.getAllByText('明日').length).toBeGreaterThanOrEqual(1)
    })

    it('renders availability labels', () => {
      render(<TherapistSchedule days={mockDays} />)
      expect(screen.getByText('本日 空きあり')).toBeInTheDocument()
      // Tomorrow has 1 slot so it's "残りわずか"
      expect(screen.getByText('残りわずか')).toBeInTheDocument()
    })

    it('renders time slots', () => {
      render(<TherapistSchedule days={mockDays} />)
      expect(screen.getByText('10:00〜11:00')).toBeInTheDocument()
      expect(screen.getByText('11:00〜12:00')).toBeInTheDocument()
    })

    it('renders slot status labels', () => {
      render(<TherapistSchedule days={mockDays} />)
      expect(screen.getAllByText('◎ 空きあり').length).toBeGreaterThan(0)
      expect(screen.getByText('△ 要確認')).toBeInTheDocument()
      expect(screen.getByText('× 満席')).toBeInTheDocument()
    })

    it('returns null when no days provided', () => {
      const { container } = render(<TherapistSchedule days={[]} />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('day selection', () => {
    it('activates first day by default', () => {
      render(<TherapistSchedule days={mockDays} />)
      const todayButton = screen.getByRole('button', { name: /今日/ })
      expect(todayButton).toHaveAttribute('aria-pressed', 'true')
    })

    it('changes active day on click', () => {
      render(<TherapistSchedule days={mockDays} />)
      const tomorrowButton = screen.getByRole('button', { name: /明日/ })

      fireEvent.click(tomorrowButton)

      expect(tomorrowButton).toHaveAttribute('aria-pressed', 'true')
    })

    it('shows slots for active day', () => {
      render(<TherapistSchedule days={mockDays} />)

      // Initial state shows today's slots
      expect(screen.getByText('10:00〜11:00')).toBeInTheDocument()

      // Click tomorrow
      const tomorrowButton = screen.getByRole('button', { name: /明日/ })
      fireEvent.click(tomorrowButton)

      // Should now show tomorrow's slots
      expect(screen.getByText('09:00〜10:00')).toBeInTheDocument()
    })
  })

  describe('slot interaction', () => {
    it('blocked slots are not clickable', () => {
      render(<TherapistSchedule days={mockDays} />)

      // Find the blocked slot container - it's a div (not a button) with cursor-not-allowed
      const slotTimeElement = screen.getByText('14:00〜15:00')
      // The slot container is multiple levels up
      const slotContainer = slotTimeElement.closest('.cursor-not-allowed')
      expect(slotContainer).toBeTruthy()
    })

    it('open slots are clickable', () => {
      render(<TherapistSchedule days={mockDays} />)

      const openSlot = screen.getByText('10:00〜11:00').closest('button')
      expect(openSlot).toBeTruthy()
      expect(openSlot).not.toHaveClass('cursor-not-allowed')
    })

    it('clicking a slot updates URL', () => {
      render(<TherapistSchedule days={mockDays} />)

      const openSlot = screen.getByText('10:00〜11:00').closest('button')!
      fireEvent.click(openSlot)

      expect(mockReplace).toHaveBeenCalled()
    })
  })

  describe('empty states', () => {
    it('shows message when day has no slots', () => {
      const emptyDays = [
        {
          date: todayIso,
          is_today: true,
          slots: [],
        },
      ]

      render(<TherapistSchedule days={emptyDays} />)
      expect(screen.getByText('公開された枠がありません。店舗へ直接お問い合わせください。')).toBeInTheDocument()
    })

    it('shows different message when other days have slots', () => {
      const mixedDays = [
        {
          date: todayIso,
          is_today: true,
          slots: [],
        },
        {
          date: tomorrowIso,
          is_today: false,
          slots: [
            { start_at: `${tomorrowIso}T09:00:00`, end_at: `${tomorrowIso}T10:00:00`, status: 'open' as const },
          ],
        },
      ]

      render(<TherapistSchedule days={mixedDays} fullDays={mixedDays} />)

      // The component auto-selects the day with slots (tomorrow), so we need to click on today
      const todayButton = screen.getByRole('button', { name: /今日/ })
      fireEvent.click(todayButton)

      expect(screen.getByText('この日に公開されている枠はありません。他の日を選んでください。')).toBeInTheDocument()
    })
  })

  describe('availability indicators', () => {
    it('shows high availability indicator for days with many slots', () => {
      const highAvailDays = [
        {
          date: todayIso,
          is_today: true,
          slots: [
            { start_at: `${todayIso}T10:00:00`, end_at: `${todayIso}T11:00:00`, status: 'open' as const },
            { start_at: `${todayIso}T11:00:00`, end_at: `${todayIso}T12:00:00`, status: 'open' as const },
            { start_at: `${todayIso}T12:00:00`, end_at: `${todayIso}T13:00:00`, status: 'open' as const },
          ],
        },
      ]

      render(<TherapistSchedule days={highAvailDays} />)
      expect(screen.getByText('本日 空きあり')).toBeInTheDocument()
    })

    it('shows no availability for all blocked slots', () => {
      const blockedDays = [
        {
          date: todayIso,
          is_today: true,
          slots: [
            { start_at: `${todayIso}T10:00:00`, end_at: `${todayIso}T11:00:00`, status: 'blocked' as const },
          ],
        },
      ]

      render(<TherapistSchedule days={blockedDays} />)
      expect(screen.getByText('本日 空きなし')).toBeInTheDocument()
    })
  })

  describe('initial slot selection', () => {
    it('highlights initial slot when provided', () => {
      const initialSlot = `${todayIso}T11:00:00`
      render(<TherapistSchedule days={mockDays} initialSlotIso={initialSlot} />)

      const slot = screen.getByText('11:00〜12:00').closest('button')
      expect(slot).toHaveAttribute('aria-current', 'true')
    })

    it('selects correct day for initial slot', () => {
      const initialSlot = `${tomorrowIso}T09:00:00`
      render(<TherapistSchedule days={mockDays} initialSlotIso={initialSlot} />)

      const tomorrowButton = screen.getByRole('button', { name: /明日/ })
      expect(tomorrowButton).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('reserve button', () => {
    it('shows reserve button when slot is available', () => {
      render(<TherapistSchedule days={mockDays} />)
      expect(screen.getByText('この枠で予約フォームへ')).toBeInTheDocument()
    })

    it('does not show reserve button when all slots blocked', () => {
      const blockedDays = [
        {
          date: todayIso,
          is_today: true,
          slots: [
            { start_at: `${todayIso}T10:00:00`, end_at: `${todayIso}T11:00:00`, status: 'blocked' as const },
          ],
        },
      ]

      render(<TherapistSchedule days={blockedDays} />)
      expect(screen.queryByText('この枠で予約フォームへ')).not.toBeInTheDocument()
    })
  })

  describe('summary label', () => {
    it('displays next available slot info', () => {
      render(<TherapistSchedule days={mockDays} />)
      expect(screen.getByText(/次に入れる時間:/)).toBeInTheDocument()
    })

    it('shows message when no slots available', () => {
      const emptyDays = [
        {
          date: todayIso,
          is_today: true,
          slots: [],
        },
      ]

      render(<TherapistSchedule days={emptyDays} />)
      expect(screen.getByText(/公開された枠はまだ掲載されていません/)).toBeInTheDocument()
    })
  })
})
