/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TherapistAvailability from '../TherapistAvailability'

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Calendar: () => <span data-testid="calendar-icon">Calendar</span>,
  Clock: () => <span data-testid="clock-icon">Clock</span>,
  ChevronLeft: () => <span data-testid="chevron-left">←</span>,
  ChevronRight: () => <span data-testid="chevron-right">→</span>,
}))

describe('TherapistAvailability', () => {
  const createMockSlot = (date: string, time: string, isAvailable = true) => ({
    starts_at: `${date}T${time}:00+09:00`,
    ends_at: `${date}T${String(parseInt(time.split(':')[0]) + 1).padStart(2, '0')}:00:00+09:00`,
    is_available: isAvailable,
    rejected_reasons: isAvailable ? undefined : ['予約済み'],
  })

  const defaultProps = {
    availability: {
      slots: [
        createMockSlot('2024-12-27', '10:00'),
        createMockSlot('2024-12-27', '11:00'),
        createMockSlot('2024-12-27', '14:00', false),
        createMockSlot('2024-12-28', '09:00'),
      ],
      phase: 'narrow' as const,
      window: {
        days: 7,
        slot_granularity_minutes: 60,
      },
    },
    therapistId: 'therapist-123',
    shopSlug: 'test-shop',
  }

  describe('rendering', () => {
    it('renders availability section title', () => {
      render(<TherapistAvailability {...defaultProps} />)
      expect(screen.getByText('空き状況')).toBeInTheDocument()
    })

    it('renders phase message for explore phase', () => {
      const props = {
        ...defaultProps,
        availability: { ...defaultProps.availability, phase: 'explore' as const },
      }
      render(<TherapistAvailability {...props} />)
      expect(screen.getByText('空き状況を確認中です')).toBeInTheDocument()
    })

    it('renders phase message for narrow phase', () => {
      render(<TherapistAvailability {...defaultProps} />)
      expect(screen.getByText('時間帯を選択してください')).toBeInTheDocument()
    })

    it('renders phase message for book phase', () => {
      const props = {
        ...defaultProps,
        availability: { ...defaultProps.availability, phase: 'book' as const },
      }
      render(<TherapistAvailability {...props} />)
      expect(screen.getByText('予約可能な時間帯です')).toBeInTheDocument()
    })

    it('renders window info', () => {
      render(<TherapistAvailability {...defaultProps} />)
      expect(screen.getByText('表示期間: 7日間')).toBeInTheDocument()
      expect(screen.getByText('60分単位')).toBeInTheDocument()
    })
  })

  describe('time slots', () => {
    it('renders available time slots', () => {
      render(<TherapistAvailability {...defaultProps} />)
      expect(screen.getByText('10:00')).toBeInTheDocument()
      expect(screen.getByText('11:00')).toBeInTheDocument()
    })

    it('renders unavailable time slots as disabled', () => {
      render(<TherapistAvailability {...defaultProps} />)
      const unavailableSlot = screen.getByText('14:00').closest('button')
      expect(unavailableSlot).toBeDisabled()
    })

    it('renders available slots count', () => {
      render(<TherapistAvailability {...defaultProps} />)
      expect(screen.getByText('2 枠空き')).toBeInTheDocument()
    })
  })

  describe('date navigation', () => {
    it('renders date navigation buttons', () => {
      render(<TherapistAvailability {...defaultProps} />)
      expect(screen.getByTestId('chevron-left')).toBeInTheDocument()
      expect(screen.getByTestId('chevron-right')).toBeInTheDocument()
    })

    it('navigates to next date when clicking right arrow', () => {
      render(<TherapistAvailability {...defaultProps} />)

      // First date should be selected initially - check for available slots count
      expect(screen.getByText('2 枠空き')).toBeInTheDocument()

      // Click next button
      const nextButton = screen.getByTestId('chevron-right').closest('button')!
      fireEvent.click(nextButton)

      // Now should show 1 slot (2024-12-28 has 1 slot)
      expect(screen.getByText('1 枠空き')).toBeInTheDocument()
    })

    it('disables prev button on first date', () => {
      render(<TherapistAvailability {...defaultProps} />)
      const prevButton = screen.getByTestId('chevron-left').closest('button')
      expect(prevButton).toBeDisabled()
    })

    it('disables next button on last date', () => {
      render(<TherapistAvailability {...defaultProps} />)

      // Navigate to last date
      const nextButton = screen.getByTestId('chevron-right').closest('button')!
      fireEvent.click(nextButton)

      expect(nextButton).toBeDisabled()
    })
  })

  describe('slot selection', () => {
    it('calls onSelectSlot when clicking available slot', () => {
      const onSelectSlot = vi.fn()
      render(<TherapistAvailability {...defaultProps} onSelectSlot={onSelectSlot} />)

      const slot = screen.getByText('10:00').closest('button')!
      fireEvent.click(slot)

      expect(onSelectSlot).toHaveBeenCalledWith(
        expect.objectContaining({
          starts_at: expect.stringContaining('10:00'),
          is_available: true,
        })
      )
    })

    it('does not call onSelectSlot when clicking unavailable slot', () => {
      const onSelectSlot = vi.fn()
      render(<TherapistAvailability {...defaultProps} onSelectSlot={onSelectSlot} />)

      const slot = screen.getByText('14:00').closest('button')!
      fireEvent.click(slot)

      expect(onSelectSlot).not.toHaveBeenCalled()
    })
  })

  describe('empty state', () => {
    it('shows empty message when no slots available', () => {
      const props = {
        ...defaultProps,
        availability: {
          ...defaultProps.availability,
          slots: [],
        },
      }
      render(<TherapistAvailability {...props} />)
      expect(screen.getByText('現在、空き枠がありません')).toBeInTheDocument()
    })

    it('shows calendar icon in empty state', () => {
      const props = {
        ...defaultProps,
        availability: {
          ...defaultProps.availability,
          slots: [],
        },
      }
      render(<TherapistAvailability {...props} />)
      expect(screen.getByTestId('calendar-icon')).toBeInTheDocument()
    })
  })

  describe('date picker', () => {
    it('renders date picker buttons', () => {
      render(<TherapistAvailability {...defaultProps} />)

      // Should have date buttons (showing day numbers)
      expect(screen.getByText('27')).toBeInTheDocument()
      expect(screen.getByText('28')).toBeInTheDocument()
    })

    it('changes selected date when clicking date button', () => {
      render(<TherapistAvailability {...defaultProps} />)

      // Click on 28th
      fireEvent.click(screen.getByText('28'))

      // Should now show 28th's slots (1 available)
      expect(screen.getByText('1 枠空き')).toBeInTheDocument()
    })
  })
})
