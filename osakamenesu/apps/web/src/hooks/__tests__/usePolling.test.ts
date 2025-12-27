/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePolling } from '../usePolling'

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches data initially when enabled', async () => {
    const mockData = { message: 'test' }
    const fetcher = vi.fn().mockResolvedValue(mockData)

    const { result } = renderHook(() => usePolling(fetcher, { enabled: true }))

    // Wait for initial fetch to complete
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    expect(fetcher).toHaveBeenCalled()
    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('does not fetch when disabled', async () => {
    const fetcher = vi.fn().mockResolvedValue({ message: 'test' })

    const { result } = renderHook(() => usePolling(fetcher, { enabled: false }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    expect(fetcher).not.toHaveBeenCalled()
    expect(result.current.data).toBeNull()
  })

  it('continues polling at specified interval', async () => {
    const mockData = { message: 'test' }
    const fetcher = vi.fn().mockResolvedValue(mockData)

    renderHook(() => usePolling(fetcher, { enabled: true, intervalMs: 1000 }))

    // Initial fetch
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    const initialCalls = fetcher.mock.calls.length

    // After interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    // Should have at least one more call
    expect(fetcher.mock.calls.length).toBeGreaterThan(initialCalls)
  })

  it('handles fetch errors', async () => {
    const error = new Error('Fetch failed')
    const fetcher = vi.fn().mockRejectedValue(error)

    const { result } = renderHook(() => usePolling(fetcher, { enabled: true }))

    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    expect(result.current.error).toEqual(error)
    expect(result.current.data).toBeNull()
  })

  it('handles non-Error thrown values', async () => {
    const fetcher = vi.fn().mockRejectedValue('string error')

    const { result } = renderHook(() => usePolling(fetcher, { enabled: true }))

    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('polling failed')
  })

  it('provides a refresh function', async () => {
    const mockData = { message: 'test' }
    const fetcher = vi.fn().mockResolvedValue(mockData)

    const { result } = renderHook(() =>
      usePolling(fetcher, { enabled: true, intervalMs: 10000 })
    )

    // Initial fetch
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    const callsAfterInit = fetcher.mock.calls.length

    // Call refresh
    await act(async () => {
      result.current.refresh()
    })
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    // Should have more calls after refresh
    expect(fetcher.mock.calls.length).toBeGreaterThan(callsAfterInit)
  })

  it('returns initial state', () => {
    const fetcher = vi.fn().mockResolvedValue({ message: 'test' })

    const { result } = renderHook(() => usePolling(fetcher, { enabled: false }))

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(typeof result.current.refresh).toBe('function')
  })
})
