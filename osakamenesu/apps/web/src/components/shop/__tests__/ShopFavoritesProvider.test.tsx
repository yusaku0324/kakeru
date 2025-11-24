import React, { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ShopFavoritesProvider, useShopFavorites } from '../ShopFavoritesProvider'

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
    return <ShopFavoritesProvider>{children}</ShopFavoritesProvider>
  }
}

describe('ShopFavoritesProvider', () => {
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
      jsonResponse([{ shop_id: 's-1', created_at: '2024-01-01T00:00:00Z' }]),
    )
    global.fetch = fetchMock

    const { result } = renderHook(() => useShopFavorites(), { wrapper: wrapperFactory() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isFavorite('s-1')).toBe(true)
    expect(result.current.isAuthenticated).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('adds a favorite via toggleFavorite', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(jsonResponse([])) // initial load
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ shop_id: 's-2', created_at: '2024-02-02T10:00:00Z' }, { status: 201 }),
    )
    global.fetch = fetchMock

    const { result } = renderHook(() => useShopFavorites(), { wrapper: wrapperFactory() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.toggleFavorite('s-2')
    })

    expect(result.current.isFavorite('s-2')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('removes a favorite via toggleFavorite', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ shop_id: 's-remove', created_at: '2024-03-03T09:00:00Z' }]),
    )
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    global.fetch = fetchMock

    const { result } = renderHook(() => useShopFavorites(), { wrapper: wrapperFactory() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isFavorite('s-remove')).toBe(true)

    await act(async () => {
      await result.current.toggleFavorite('s-remove')
    })

    expect(result.current.isFavorite('s-remove')).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('marks unauthenticated users when initial fetch returns 401 and prevents toggles', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))
    global.fetch = fetchMock

    const { result } = renderHook(() => useShopFavorites(), { wrapper: wrapperFactory() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isAuthenticated).toBe(false)

    await act(async () => {
      await result.current.toggleFavorite('s-x')
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.isFavorite('s-x')).toBe(false)
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
      jsonResponse({ shop_id: 's-late', created_at: '2024-04-04T04:00:00Z' }, { status: 201 }),
    )
    global.fetch = fetchMock

    const { result } = renderHook(() => useShopFavorites(), { wrapper: wrapperFactory() })

    await act(async () => {
      await result.current.toggleFavorite('s-late')
    })

    expect(result.current.isFavorite('s-late')).toBe(true)

    resolveInitial?.(jsonResponse([]))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isFavorite('s-late')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
