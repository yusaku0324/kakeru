import { afterEach, describe, expect, it, vi } from 'vitest'

process.env.OSAKAMENESU_API_INTERNAL_BASE = 'https://internal.example.com'
process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE = 'https://public.example.com'

const originalFetch = global.fetch

describe('api/auth/session route', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    global.fetch = originalFetch
  })

  it('forwards cookies and returns session payload', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    global.fetch = fetchMock as unknown as typeof global.fetch

    const { GET } = await import('../route')

    const req = new Request('https://osakamenesu-web.test/api/auth/session', {
      headers: {
        cookie: 'osakamenesu_session=abc',
      },
    })

    const resp = await GET(req)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const forwardedHeaders = fetchMock.mock.calls[0]?.[1]?.headers as
      | Record<string, string>
      | undefined
    expect(forwardedHeaders?.cookie).toBe('osakamenesu_session=abc')
    expect(resp.status).toBe(200)
    const json = await resp.json()
    expect(json).toEqual({ authenticated: true })
  })
})
