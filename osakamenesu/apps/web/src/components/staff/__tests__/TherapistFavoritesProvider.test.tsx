import React, { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, beforeEach, afterEach, it, vi } from 'vitest'

import { TherapistFavoritesProvider, useTherapistFavorites } from '../TherapistFavoritesProvider'

const originalFetch = global.fetch
const originalInternalBase = process.env.OSAKAMENESU_API_INTERNAL_BASE
const originalPublicBase = process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE
const originalFallbackBase = process.env.NEXT_PUBLIC_API_BASE

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
}

function wrapperFactory() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <TherapistFavoritesProvider>{children}</TherapistFavoritesProvider>
  }
}

describe('TherapistFavoritesProvider', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    global.fetch = originalFetch
    process.env.OSAKAMENESU_API_INTERNAL_BASE = originalInternalBase
    process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE = originalPublicBase
    process.env.NEXT_PUBLIC_API_BASE = originalFallbackBase
  })

  it('loads existing favorites on mount', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        { therapist_id: 't-1', shop_id: 's-1', created_at: '2024-01-01T00:00:00Z' },
      ])
    )
    global.fetch = fetchMock

    const { result } = renderHook(() => useTherapistFavorites(), {
      wrapper: wrapperFactory(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isFavorite('t-1')).toBe(true)
    expect(result.current.isAuthenticated).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('adds a favorite via toggleFavorite', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(jsonResponse([])) // initial load
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { therapist_id: 't-2', shop_id: 's-2', created_at: '2024-02-02T10:00:00Z' },
        { status: 201 }
      )
    )
    global.fetch = fetchMock

    const { result } = renderHook(() => useTherapistFavorites(), {
      wrapper: wrapperFactory(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.toggleFavorite({ therapistId: 't-2', shopId: 's-2' })
    })

    expect(result.current.isFavorite('t-2')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('removes a favorite via toggleFavorite', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ therapist_id: 't-remove', shop_id: 's-9', created_at: '2024-03-03T09:00:00Z' }])
    )
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    global.fetch = fetchMock

    const { result } = renderHook(() => useTherapistFavorites(), {
      wrapper: wrapperFactory(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isFavorite('t-remove')).toBe(true)

    await act(async () => {
      await result.current.toggleFavorite({ therapistId: 't-remove', shopId: 's-9' })
    })

    expect(result.current.isFavorite('t-remove')).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('marks unauthenticated users when initial fetch returns 401 and prevents toggles', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))
    global.fetch = fetchMock

    const { result } = renderHook(() => useTherapistFavorites(), {
      wrapper: wrapperFactory(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isAuthenticated).toBe(false)

    await act(async () => {
      await result.current.toggleFavorite({ therapistId: 't-x', shopId: 's-x' })
    })

    // Should not attempt an extra fetch when already marked unauthenticated
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.isFavorite('t-x')).toBe(false)
  })

  it('keeps optimistic addition when initial fetch resolves later', async () => {
    const fetchMock = vi.fn()
    let resolveInitial: ((response: Response) => void) | undefined

    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveInitial = resolve
        }),
    )
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { therapist_id: 't-late', shop_id: 's-late', created_at: '2024-04-04T04:00:00Z' },
        { status: 201 },
      ),
    )
    global.fetch = fetchMock

    const { result } = renderHook(() => useTherapistFavorites(), {
      wrapper: wrapperFactory(),
    })

    await act(async () => {
      await result.current.toggleFavorite({ therapistId: 't-late', shopId: 's-late' })
    })

    expect(result.current.isFavorite('t-late')).toBe(true)

    resolveInitial?.(jsonResponse([]))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isFavorite('t-late')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falls back to public API host when /api returns 404', async () => {
    process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE = 'https://api.example.com'
    process.env.OSAKAMENESU_API_INTERNAL_BASE = ''
    process.env.NEXT_PUBLIC_API_BASE = ''

    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const urlString = typeof url === 'string' ? url : url.toString()
      if (urlString.startsWith('/api/')) {
        return Promise.resolve(new Response(null, { status: 404 }))
      }
      if (urlString.startsWith('https://api.example.com')) {
        return Promise.resolve(
          jsonResponse([
            { therapist_id: 'fallback-1', shop_id: 'shop-1', created_at: '2024-05-05T05:00:00Z' },
          ]),
        )
      }
      return Promise.reject(new Error(`Unexpected fetch url: ${urlString}`))
    })

    global.fetch = fetchMock

    const { result } = renderHook(() => useTherapistFavorites(), {
      wrapper: wrapperFactory(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.isFavorite('fallback-1')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/favorites/therapists')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.example.com/api/favorites/therapists')
  })
})
