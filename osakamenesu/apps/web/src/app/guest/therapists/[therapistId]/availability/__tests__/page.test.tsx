import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import TherapistAvailabilityPage from '@/app/guest/therapists/[therapistId]/availability/page'
import { toLocalDateISO } from '@/lib/date'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ therapistId: 'thera-1' }),
}))

describe('Therapist availability page', () => {
  const therapistId = 'thera-1'
  const today = new Date()
  const todayIso = toLocalDateISO(today)
  const tomorrowIso = (() => {
    const t = new Date(today)
    t.setDate(t.getDate() + 1)
    return toLocalDateISO(t)
  })()
  const tomorrowLabel = (() => {
    const d = new Date(tomorrowIso)
    return `${d.getMonth() + 1}/${d.getDate()}`
  })()

  beforeEach(() => {
    global.fetch = vi.fn(async (input: any) => {
      const url = typeof input === 'string' ? input : input?.url
      if (url?.includes('availability_summary')) {
        return new Response(
          JSON.stringify({
            therapist_id: therapistId,
            items: [
              { date: todayIso, has_available: true },
              { date: tomorrowIso, has_available: false },
            ],
          }),
          { status: 200 },
        )
      }
      if (url?.includes('availability_slots')) {
        const search = new URL(url, 'http://localhost').searchParams
        if (search.get('date') === todayIso) {
          return new Response(
            JSON.stringify({
              therapist_id: therapistId,
              date: todayIso,
              slots: [
                { start_at: `${todayIso}T10:00:00Z`, end_at: `${todayIso}T11:00:00Z` },
                { start_at: `${todayIso}T12:00:00Z`, end_at: `${todayIso}T13:30:00Z` },
              ],
            }),
            { status: 200 },
          )
        }
        return new Response(
          JSON.stringify({ therapist_id: therapistId, date: tomorrowIso, slots: [] }),
          { status: 200 },
        )
      }
      return new Response('not found', { status: 404 })
    }) as any
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows daily chips and slots list', async () => {
    render(<TherapistAvailabilityPage />)

    await waitFor(() => expect(screen.getByText('空き状況')).toBeInTheDocument())
    expect(await screen.findByText('○ 空きあり')).toBeInTheDocument()

    const reserveButtons = await screen.findAllByText('この時間で予約する')
    expect(reserveButtons).toHaveLength(2)
  })

  it('shows empty message when no slots for selected day', async () => {
    render(<TherapistAvailabilityPage />)
    const closedChip = await screen.findByRole('button', {
      name: new RegExp(`${tomorrowLabel} .*× 受付終了`),
    })
    fireEvent.click(closedChip)
    await screen.findByText('空きがありません。')
  })
})
