import { afterEach, describe, expect, it, vi } from 'vitest'

process.env.OSAKAMENESU_API_INTERNAL_BASE = 'https://internal.example.com'
process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE = 'https://public.example.com'

vi.mock('@/lib/availability-date-range', async () => {
  const actual = await vi.importActual<typeof import('@/lib/availability-date-range')>(
    '@/lib/availability-date-range',
  )
  return {
    ...actual,
    generateWeekDateRangeWithToday: () => [{ date: '2025-12-17', is_today: false }],
  }
})

const originalFetch = global.fetch

describe('api/guest/therapists/[therapistId]/availability_slots route', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    global.fetch = originalFetch
  })

  it('generates week calendar slots without relying on server TZ', async () => {
    // Simulate a server runtime where local time behaves like UTC (e.g. Vercel).
    // If the implementation relies on Date#getHours(), the generated grid can become empty.
    const getHoursSpy = vi
      .spyOn(Date.prototype, 'getHours')
      .mockImplementation(function () {
        return this.getUTCHours()
      })

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          slots: [{ start_at: '2025-12-17T01:00:00.000Z', end_at: '2025-12-17T05:00:00.000Z' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    global.fetch = fetchMock as unknown as typeof global.fetch

    const { GET } = await import('../route')
    const req = new Request('https://osakamenesu-web.test/api/guest/therapists/t1/availability_slots')
    const resp = await GET(req as any, { params: Promise.resolve({ therapistId: 't1' }) } as any)
    expect(resp.status).toBe(200)
    const json = (await resp.json()) as any

    expect(Array.isArray(json?.days)).toBe(true)
    expect(json.days).toHaveLength(1)
    expect(json.days[0].date).toBe('2025-12-17')
    expect(Array.isArray(json.days[0].slots)).toBe(true)
    expect(json.days[0].slots.some((slot: any) => slot.status === 'open')).toBe(true)

    getHoursSpy.mockRestore()
  })
})
