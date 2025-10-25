import React, { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, beforeEach, afterEach, it, vi } from 'vitest'

import { TherapistFavoritesProvider, useTherapistFavorites } from '../TherapistFavoritesProvider'

const originalFetch = global.fetch

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
})
