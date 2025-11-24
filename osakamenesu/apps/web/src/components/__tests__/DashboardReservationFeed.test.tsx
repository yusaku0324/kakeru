import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi, type Mock } from 'vitest'

import DashboardReservationFeed from '@/features/reservations/ui/DashboardReservationFeed'

declare global {
  var __fetchDashboardReservationsMock: Mock | undefined
  var __updateDashboardReservationMock: Mock | undefined
}

vi.mock('@/lib/dashboard-reservations', () => {
  globalThis.__fetchDashboardReservationsMock =
    globalThis.__fetchDashboardReservationsMock ?? vi.fn()
  globalThis.__updateDashboardReservationMock =
    globalThis.__updateDashboardReservationMock ?? vi.fn()
  return {
    fetchDashboardReservations: (...args: unknown[]) =>
      globalThis.__fetchDashboardReservationsMock!(...args),
    updateDashboardReservation: (...args: unknown[]) =>
      globalThis.__updateDashboardReservationMock!(...args),
  }
})

const mockFetchReservations = () => globalThis.__fetchDashboardReservationsMock as Mock
const mockUpdateReservation = () => globalThis.__updateDashboardReservationMock as Mock

const replaceMock = vi.fn()
const refreshMock = vi.fn()
const routerMock = { replace: replaceMock, refresh: refreshMock }
const pushToastMock = vi.fn()
const removeToastMock = vi.fn()
const toastApi = { toasts: [], push: pushToastMock, remove: removeToastMock }
let searchParams: URLSearchParams

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => '/dashboard/profile',
  useSearchParams: () => searchParams,
}))

vi.mock('@/components/useToast', () => ({
  useToast: () => toastApi,
  ToastContainer: () => null,
}))

function createReservation(id: string, name: string, offsetMinutes = 0) {
  const now = new Date('2025-11-06T09:00:00.000Z')
  const start = new Date(now.getTime() + offsetMinutes * 60_000)
  const end = new Date(start.getTime() + 60_000)
  return {
    id,
    status: 'pending' as const,
    channel: 'web',
    desired_start: start.toISOString(),
    desired_end: end.toISOString(),
    customer_name: name,
    customer_phone: '09000000000',
    customer_email: `${name.replace(/\s+/g, '').toLowerCase()}@example.com`,
    notes: null,
    marketing_opt_in: false,
    staff_id: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    approval_decision: null,
    approval_decided_at: null,
    approval_decided_by: null,
    reminder_scheduled_at: null,
    preferred_slots: [],
  }
}

describe('DashboardReservationFeed pagination', () => {
  beforeEach(() => {
    globalThis.__fetchDashboardReservationsMock = vi.fn()
    globalThis.__updateDashboardReservationMock = vi.fn()
    replaceMock.mockReset()
    refreshMock.mockReset()
    searchParams = new URLSearchParams()
    sessionStorage.clear()
  })

  it('loads additional pages forward and backward', async () => {
    mockFetchReservations()
      .mockResolvedValueOnce({
        profile_id: 'profile-1',
        total: 1,
        reservations: [createReservation('res-1', 'Customer One')],
        next_cursor: 'cursor-next',
        prev_cursor: null,
      })
      .mockResolvedValueOnce({
        profile_id: 'profile-1',
        total: 2,
        reservations: [createReservation('res-2', 'Customer Two', 120)],
        next_cursor: null,
        prev_cursor: 'cursor-prev',
      })
      .mockResolvedValueOnce({
        profile_id: 'profile-1',
        total: 3,
        reservations: [createReservation('res-0', 'Customer Zero', -120)],
        next_cursor: 'cursor-next-again',
        prev_cursor: null,
      })

    render(<DashboardReservationFeed profileId="profile-1" />)

    await waitFor(() => expect(mockFetchReservations()).toHaveBeenCalledTimes(1))
    await screen.findByText('Customer One')

    const loadMoreButton = screen.getByRole('button', { name: 'さらに読み込む' })
    fireEvent.click(loadMoreButton)

    await screen.findByText('Customer Two')
    expect(mockFetchReservations()).toHaveBeenCalledTimes(2)
    expect(mockFetchReservations().mock.calls[1][1]).toMatchObject({
      cursor: 'cursor-next',
      cursorDirection: 'forward',
    })

    const loadPreviousButton = await screen.findByRole('button', { name: '新しい予約を読み込む' })
    fireEvent.click(loadPreviousButton)

    await screen.findByText('Customer Zero')
    expect(mockFetchReservations()).toHaveBeenCalledTimes(3)
    expect(mockFetchReservations().mock.calls[2][1]).toMatchObject({
      cursor: 'cursor-prev',
      cursorDirection: 'backward',
    })

    const customerEntries = screen.getAllByText(/Customer/)
    expect(customerEntries[0]).toHaveTextContent('Customer Zero')
  })

  it('updates limit and syncs search params when page size changes', async () => {
    mockFetchReservations()
      .mockResolvedValueOnce({
        profile_id: 'profile-2',
        total: 1,
        reservations: [createReservation('res-10', 'Customer Ten')],
        next_cursor: null,
        prev_cursor: null,
      })
      .mockResolvedValueOnce({
        profile_id: 'profile-2',
        total: 1,
        reservations: [createReservation('res-10', 'Customer Ten')],
        next_cursor: null,
        prev_cursor: null,
      })

    render(<DashboardReservationFeed profileId="profile-2" limit={10} />)
    await waitFor(() => expect(mockFetchReservations()).toHaveBeenCalledTimes(1))
    await screen.findByText('Customer Ten')

    replaceMock.mockClear()

    const pageSizeSelect = screen.getByLabelText('表示件数')
    fireEvent.change(pageSizeSelect, { target: { value: '50' } })

    await waitFor(() => expect(mockFetchReservations()).toHaveBeenCalledTimes(2))
    expect(mockFetchReservations().mock.calls[1][1]).toMatchObject({ limit: 50 })
    expect(replaceMock).toHaveBeenCalled()
    expect(replaceMock.mock.calls[0][0]).toContain('limit=50')
    expect(sessionStorage.getItem('dashboard:reservation-feed:filters:profile-2')).toContain(
      '"limit":50',
    )
  })
})
