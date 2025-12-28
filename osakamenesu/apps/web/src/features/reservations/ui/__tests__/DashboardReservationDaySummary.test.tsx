/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DashboardReservationDaySummary from '../DashboardReservationDaySummary'
import type { DashboardReservationItem } from '@/lib/dashboard-reservations'

// Mock dashboard-reservations
const mockFetchDashboardReservations = vi.fn()
vi.mock('@/lib/dashboard-reservations', () => ({
  fetchDashboardReservations: (...args: unknown[]) => mockFetchDashboardReservations(...args),
}))

// Mock reservations usecases
const mockLoadShopReservationsForDay = vi.fn()
vi.mock('@/features/reservations/usecases', () => ({
  loadShopReservationsForDay: (...args: unknown[]) => mockLoadShopReservationsForDay(...args),
}))

// Mock reservation status
vi.mock('@/components/reservations/status', () => ({
  RESERVATION_STATUS_BADGES: {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    completed: 'bg-blue-100 text-blue-800',
  },
  getReservationStatusDisplay: (status: string) => {
    const displays: Record<string, string> = {
      pending: '確認待ち',
      confirmed: '確認済み',
      cancelled: 'キャンセル',
      completed: '完了',
    }
    return displays[status] || status
  },
}))

// Mock Card component
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}))

describe('DashboardReservationDaySummary', () => {
  const mockProfileId = 'profile-123'

  const createMockReservation = (overrides: Partial<DashboardReservationItem> = {}): DashboardReservationItem => ({
    id: 'res-1',
    status: 'confirmed' as const,
    customer_name: 'テスト顧客',
    desired_start: '2024-12-27T10:00:00+09:00',
    desired_end: '2024-12-27T11:00:00+09:00',
    customer_email: 'test@example.com',
    customer_phone: '090-1234-5678',
    channel: 'web',
    created_at: '2024-12-27T09:00:00+09:00',
    updated_at: '2024-12-27T09:00:00+09:00',
    preferred_slots: [],
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadShopReservationsForDay.mockResolvedValue([])
    mockFetchDashboardReservations.mockResolvedValue({ reservations: [] })
  })

  describe('rendering', () => {
    it('renders header', async () => {
      render(<DashboardReservationDaySummary profileId={mockProfileId} />)

      expect(screen.getByText('直近の予約状況')).toBeInTheDocument()
      expect(screen.getByText('今日は誰が来店しますか？')).toBeInTheDocument()

      // Wait for async operations to complete
      await waitFor(() => {
        expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument()
      })
    })

    it('renders day tabs', async () => {
      render(<DashboardReservationDaySummary profileId={mockProfileId} />)

      expect(screen.getByRole('button', { name: '今日' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '明日' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '日付指定' })).toBeInTheDocument()

      // Wait for async operations to complete
      await waitFor(() => {
        expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument()
      })
    })

    it('shows loading state initially', async () => {
      render(<DashboardReservationDaySummary profileId={mockProfileId} />)

      expect(screen.getByText('読み込み中...')).toBeInTheDocument()

      // Wait for async operations to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument()
      })
    })

    it('shows empty state when no reservations', async () => {
      mockLoadShopReservationsForDay.mockResolvedValue([])
      render(<DashboardReservationDaySummary profileId={mockProfileId} />)

      await waitFor(() => {
        expect(screen.getByText('今日の予約はまだありません。')).toBeInTheDocument()
      })
    })
  })

  describe('reservation display', () => {
    it('displays reservations when loaded', async () => {
      const mockReservations = [
        createMockReservation({ id: 'res-1', customer_name: '田中太郎' }),
        createMockReservation({ id: 'res-2', customer_name: '山田花子' }),
      ]

      mockLoadShopReservationsForDay.mockResolvedValue(mockReservations)
      render(<DashboardReservationDaySummary profileId={mockProfileId} />)

      await waitFor(() => {
        expect(screen.getByText('田中太郎')).toBeInTheDocument()
        expect(screen.getByText('山田花子')).toBeInTheDocument()
      })
    })

    it('displays reservation time range', async () => {
      const mockReservation = createMockReservation({
        desired_start: '2024-12-27T14:00:00+09:00',
        desired_end: '2024-12-27T15:30:00+09:00',
      })

      mockLoadShopReservationsForDay.mockResolvedValue([mockReservation])
      render(<DashboardReservationDaySummary profileId={mockProfileId} />)

      await waitFor(() => {
        expect(screen.getByText('14:00〜15:30')).toBeInTheDocument()
      })
    })

    it('displays channel info', async () => {
      const mockReservation = createMockReservation({ channel: 'LINE' })

      mockLoadShopReservationsForDay.mockResolvedValue([mockReservation])
      render(<DashboardReservationDaySummary profileId={mockProfileId} />)

      await waitFor(() => {
        expect(screen.getByText('経路: LINE')).toBeInTheDocument()
      })
    })

    it('displays status badge', async () => {
      const mockReservation = createMockReservation({ status: 'confirmed' })

      mockLoadShopReservationsForDay.mockResolvedValue([mockReservation])
      render(<DashboardReservationDaySummary profileId={mockProfileId} />)

      await waitFor(() => {
        expect(screen.getByText('確認済み')).toBeInTheDocument()
      })
    })
  })

  describe('summary calculation', () => {
    it('counts total reservations', async () => {
      const mockReservations = [
        createMockReservation({ id: 'res-1' }),
        createMockReservation({ id: 'res-2' }),
        createMockReservation({ id: 'res-3' }),
      ]

      mockLoadShopReservationsForDay.mockResolvedValue(mockReservations)
      render(<DashboardReservationDaySummary profileId={mockProfileId} />)

      await waitFor(() => {
        expect(screen.getByText(/今日の予約: 3件/)).toBeInTheDocument()
      })
    })

    it('counts active vs cancelled reservations', async () => {
      const mockReservations = [
        createMockReservation({ id: 'res-1', status: 'confirmed' }),
        createMockReservation({ id: 'res-2', status: 'confirmed' }),
        createMockReservation({ id: 'res-3', status: 'cancelled' }),
      ]

      mockLoadShopReservationsForDay.mockResolvedValue(mockReservations)
      render(<DashboardReservationDaySummary profileId={mockProfileId} />)

      await waitFor(() => {
        expect(screen.getByText(/来店予定 2件/)).toBeInTheDocument()
        expect(screen.getByText(/キャンセル 1件/)).toBeInTheDocument()
      })
    })
  })

  describe('tab switching', () => {
    it('switches to tomorrow tab', async () => {
      mockLoadShopReservationsForDay.mockResolvedValue([])
      render(<DashboardReservationDaySummary profileId={mockProfileId} />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: '明日' }))

      await waitFor(() => {
        expect(screen.getByText('明日の予約はまだありません。')).toBeInTheDocument()
      })
    })

    it('shows date input when custom tab selected', async () => {
      mockLoadShopReservationsForDay.mockResolvedValue([])
      render(<DashboardReservationDaySummary profileId={mockProfileId} />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: '日付指定' }))

      await waitFor(() => {
        // input[type="date"] doesn't have role="textbox", use querySelector
        const dateInput = document.querySelector('input[type="date"]')
        expect(dateInput).toBeTruthy()
      })
    })

    it('loads data for custom date', async () => {
      mockLoadShopReservationsForDay.mockResolvedValue([])
      mockFetchDashboardReservations.mockResolvedValue({ reservations: [] })

      render(<DashboardReservationDaySummary profileId={mockProfileId} />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: '日付指定' }))

      await waitFor(() => {
        expect(mockFetchDashboardReservations).toHaveBeenCalled()
      })
    })
  })

  describe('error handling', () => {
    it('displays error message on load failure', async () => {
      mockLoadShopReservationsForDay.mockRejectedValue(new Error('Network error'))
      render(<DashboardReservationDaySummary profileId={mockProfileId} />)

      await waitFor(() => {
        expect(screen.getByText('予約の取得に失敗しました')).toBeInTheDocument()
      })
    })
  })

  describe('initial data loading', () => {
    it('loads today and tomorrow data on mount', async () => {
      render(<DashboardReservationDaySummary profileId={mockProfileId} />)

      await waitFor(() => {
        expect(mockLoadShopReservationsForDay).toHaveBeenCalledWith(
          mockProfileId,
          'today',
          expect.objectContaining({ signal: expect.any(AbortSignal) })
        )
        expect(mockLoadShopReservationsForDay).toHaveBeenCalledWith(
          mockProfileId,
          'tomorrow',
          expect.objectContaining({ signal: expect.any(AbortSignal) })
        )
      })
    })
  })
})
