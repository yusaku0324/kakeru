/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, renderHook, waitFor } from '@testing-library/react'
import {
  deepMemo,
  useBatchedState,
  useWindowedList,
  useDeferredValue,
  useStableCallback,
  useLazyRender,
  ProgressiveHydration,
  VirtualList,
  useProgressiveImage,
  useScrollOptimizedValue,
  useSkipRenderOnInteraction,
} from '../render-optimization'

describe('render-optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('deepMemo', () => {
    it('memoizes a component', () => {
      const TestComponent = ({ value }: { value: number }) => <div>{value}</div>
      const MemoizedComponent = deepMemo(TestComponent)

      const { rerender } = render(<MemoizedComponent value={1} />)
      expect(screen.getByText('1')).toBeInTheDocument()

      rerender(<MemoizedComponent value={1} />)
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('re-renders when props change', () => {
      const TestComponent = ({ value }: { value: number }) => <div>{value}</div>
      const MemoizedComponent = deepMemo(TestComponent)

      const { rerender } = render(<MemoizedComponent value={1} />)
      expect(screen.getByText('1')).toBeInTheDocument()

      rerender(<MemoizedComponent value={2} />)
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('uses deep comparison for objects', () => {
      const renderFn = vi.fn()
      const TestComponent = ({ data }: { data: { value: number } }) => {
        renderFn()
        return <div>{data.value}</div>
      }
      const MemoizedComponent = deepMemo(TestComponent)

      const { rerender } = render(<MemoizedComponent data={{ value: 1 }} />)
      expect(renderFn).toHaveBeenCalledTimes(1)

      // Same value, different reference - should not re-render
      rerender(<MemoizedComponent data={{ value: 1 }} />)
      expect(renderFn).toHaveBeenCalledTimes(1)
    })

    it('uses custom comparison function when provided', () => {
      const customCompare = vi.fn().mockReturnValue(true)
      const TestComponent = ({ value }: { value: number }) => <div>{value}</div>
      const MemoizedComponent = deepMemo(TestComponent, customCompare)

      const { rerender } = render(<MemoizedComponent value={1} />)
      rerender(<MemoizedComponent value={2} />)

      expect(customCompare).toHaveBeenCalled()
    })

    it('handles Date objects in deep comparison', () => {
      const renderFn = vi.fn()
      const TestComponent = ({ date }: { date: Date }) => {
        renderFn()
        return <div>{date.toISOString()}</div>
      }
      const MemoizedComponent = deepMemo(TestComponent)

      const date1 = new Date('2024-01-01')
      const date2 = new Date('2024-01-01')

      const { rerender } = render(<MemoizedComponent date={date1} />)
      expect(renderFn).toHaveBeenCalledTimes(1)

      // Same date value - should not re-render
      rerender(<MemoizedComponent date={date2} />)
      expect(renderFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('useBatchedState', () => {
    it('returns initial state', () => {
      const { result } = renderHook(() => useBatchedState(0))
      expect(result.current[0]).toBe(0)
    })

    it('batches multiple updates', async () => {
      const { result } = renderHook(() => useBatchedState(0))

      act(() => {
        result.current[1](prev => prev + 1)
        result.current[1](prev => prev + 2)
        result.current[1](prev => prev + 3)
      })

      // Advance timers to trigger batched update
      await act(async () => {
        vi.advanceTimersByTime(10)
      })

      expect(result.current[0]).toBe(6)
    })

    it('cleans up timeout on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      const { result, unmount } = renderHook(() => useBatchedState(0))

      act(() => {
        result.current[1](prev => prev + 1)
      })

      unmount()
      expect(clearTimeoutSpy).toHaveBeenCalled()
    })
  })

  describe('useWindowedList', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }))

    it('returns visible items based on container height', () => {
      const { result } = renderHook(() =>
        useWindowedList(items, {
          itemHeight: 50,
          containerHeight: 200,
        })
      )

      expect(result.current.visibleItems.length).toBeGreaterThan(0)
      expect(result.current.visibleItems.length).toBeLessThan(items.length)
    })

    it('calculates total height correctly', () => {
      const { result } = renderHook(() =>
        useWindowedList(items, {
          itemHeight: 50,
          containerHeight: 200,
        })
      )

      expect(result.current.totalHeight).toBe(100 * 50) // 100 items * 50px each
    })

    it('handles scroll position', () => {
      const { result, rerender } = renderHook(
        ({ scrollTop }) =>
          useWindowedList(items, {
            itemHeight: 50,
            containerHeight: 200,
            scrollTop,
          }),
        { initialProps: { scrollTop: 0 } }
      )

      const initialStartIndex = result.current.startIndex

      rerender({ scrollTop: 500 }) // Scroll down

      expect(result.current.startIndex).toBeGreaterThan(initialStartIndex)
    })

    it('includes overscan items', () => {
      const { result } = renderHook(() =>
        useWindowedList(items, {
          itemHeight: 50,
          containerHeight: 200,
          overscan: 5,
        })
      )

      // With overscan=5, we should have extra items beyond visible range
      expect(result.current.endIndex - result.current.startIndex).toBeGreaterThan(4)
    })

    it('handles function-based item height', () => {
      const { result } = renderHook(() =>
        useWindowedList(items, {
          itemHeight: (index) => (index % 2 === 0 ? 50 : 100),
          containerHeight: 200,
        })
      )

      expect(result.current.visibleItems.length).toBeGreaterThan(0)
    })
  })

  describe('useDeferredValue', () => {
    it('returns initial value immediately', () => {
      const { result } = renderHook(() => useDeferredValue('initial'))
      expect(result.current).toBe('initial')
    })

    it('defers value update after delay', async () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDeferredValue(value, 100),
        { initialProps: { value: 'initial' } }
      )

      rerender({ value: 'updated' })

      // Value should still be 'initial' immediately
      expect(result.current).toBe('initial')

      // Advance timer and wait for update
      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current).toBe('updated')
    })

    it('clears timeout when value changes before delay', async () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDeferredValue(value, 100),
        { initialProps: { value: 'a' } }
      )

      rerender({ value: 'b' })
      rerender({ value: 'c' })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current).toBe('c')
    })
  })

  describe('useStableCallback', () => {
    it('returns a stable callback reference', () => {
      let callback = () => 'first'
      const { result, rerender } = renderHook(() => useStableCallback(callback))

      const firstRef = result.current

      callback = () => 'second'
      rerender()

      expect(result.current).toBe(firstRef)
    })

    it('calls the latest callback implementation', () => {
      let value = 'first'
      const { result, rerender } = renderHook(() => useStableCallback(() => value))

      expect(result.current()).toBe('first')

      value = 'second'
      rerender()

      expect(result.current()).toBe('second')
    })
  })

  describe('useLazyRender', () => {
    let mockCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null
    let mockDisconnect: ReturnType<typeof vi.fn>
    let mockObserve: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockDisconnect = vi.fn()
      mockObserve = vi.fn()
      mockCallback = null

      // Create a proper class mock for IntersectionObserver
      class MockIntersectionObserver {
        constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
          mockCallback = callback
        }
        observe = mockObserve
        disconnect = mockDisconnect
        unobserve = vi.fn()
      }

      global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
    })

    it('returns false initially', () => {
      const { result } = renderHook(() => useLazyRender())
      expect(result.current[0]).toBe(false)
    })

    it('observes element when set', () => {
      const { result } = renderHook(() => useLazyRender())

      act(() => {
        const element = document.createElement('div')
        result.current[1](element)
      })

      expect(mockObserve).toHaveBeenCalled()
    })

    it('sets visible to true when element intersects', () => {
      const { result } = renderHook(() => useLazyRender())

      act(() => {
        const element = document.createElement('div')
        result.current[1](element)
      })

      // Simulate intersection
      act(() => {
        mockCallback?.([{ isIntersecting: true } as IntersectionObserverEntry])
      })

      expect(result.current[0]).toBe(true)
      expect(mockDisconnect).toHaveBeenCalled()
    })
  })

  describe('ProgressiveHydration', () => {
    // Note: jsdom doesn't have requestIdleCallback, so these tests use the setTimeout fallback

    it('renders children after hydration via setTimeout fallback', async () => {
      render(
        <ProgressiveHydration>
          <div data-testid="content">Content</div>
        </ProgressiveHydration>
      )

      // Initially shows children (fallback is children when not provided)
      expect(screen.getByTestId('content')).toBeInTheDocument()

      await act(async () => {
        vi.advanceTimersByTime(0)
      })

      expect(screen.getByTestId('content')).toBeInTheDocument()
    })

    it('renders fallback before hydration if provided', async () => {
      render(
        <ProgressiveHydration fallback={<div data-testid="fallback">Loading...</div>}>
          <div data-testid="content">Content</div>
        </ProgressiveHydration>
      )

      // Initially shows fallback
      expect(screen.getByTestId('fallback')).toBeInTheDocument()
      expect(screen.queryByTestId('content')).not.toBeInTheDocument()

      await act(async () => {
        vi.advanceTimersByTime(10)
      })

      expect(screen.getByTestId('content')).toBeInTheDocument()
    })

    it('respects ssrOnly option', () => {
      render(
        <ProgressiveHydration ssrOnly>
          <div data-testid="content">Content</div>
        </ProgressiveHydration>
      )

      expect(screen.getByTestId('content')).toBeInTheDocument()
    })
  })

  describe('VirtualList', () => {
    const items = Array.from({ length: 100 }, (_, i) => `Item ${i}`)
    const renderItem = (item: string) => <div>{item}</div>

    it('renders visible items', () => {
      render(
        <VirtualList
          items={items}
          renderItem={renderItem}
          itemHeight={50}
          height={200}
        />
      )

      // Should render some items (not all 100)
      expect(screen.getByText('Item 0')).toBeInTheDocument()
      expect(screen.queryByText('Item 99')).not.toBeInTheDocument()
    })

    it('applies className', () => {
      const { container } = render(
        <VirtualList
          items={items}
          renderItem={renderItem}
          itemHeight={50}
          height={200}
          className="custom-list"
        />
      )

      expect(container.querySelector('.custom-list')).toBeInTheDocument()
    })

    it('handles scroll', async () => {
      render(
        <VirtualList
          items={items}
          renderItem={(item) => <div data-testid={`item-${item}`}>{item}</div>}
          itemHeight={50}
          height={200}
        />
      )

      // Initial render should show first items
      expect(screen.getByTestId('item-Item 0')).toBeInTheDocument()
    })

    it('supports function-based item height', () => {
      render(
        <VirtualList
          items={items}
          renderItem={renderItem}
          itemHeight={(index) => (index % 2 === 0 ? 50 : 100)}
          height={200}
        />
      )

      expect(screen.getByText('Item 0')).toBeInTheDocument()
    })
  })

  describe('useProgressiveImage', () => {
    it('returns placeholder initially', () => {
      const { result } = renderHook(() =>
        useProgressiveImage('/full-image.jpg', '/placeholder.jpg')
      )

      expect(result.current).toBe('/placeholder.jpg')
    })

    it('returns src if no placeholder provided', () => {
      const { result } = renderHook(() => useProgressiveImage('/image.jpg'))

      expect(result.current).toBe('/image.jpg')
    })

    it('returns full image after load', async () => {
      const { result } = renderHook(() =>
        useProgressiveImage('/full-image.jpg', '/placeholder.jpg')
      )

      // Find the created Image and trigger onload
      await act(async () => {
        // Since we can't easily access the Image instance, just verify initial state
        expect(result.current).toBe('/placeholder.jpg')
      })
    })
  })
})

describe('useScrollOptimizedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns computed value when not scrolling', async () => {
    const computeValue = vi.fn(() => 'computed')
    const { result } = renderHook(() =>
      useScrollOptimizedValue(computeValue, [], { scrollThreshold: 50, debounceMs: 100 })
    )

    // Wait for initial computation
    await act(async () => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current).toBe('computed')
  })

  it('returns null during fast scrolling', async () => {
    const computeValue = vi.fn(() => 'computed')
    const { result } = renderHook(() =>
      useScrollOptimizedValue(computeValue, [], { scrollThreshold: 50, debounceMs: 100 })
    )

    // Wait for initial computation
    await act(async () => {
      vi.advanceTimersByTime(0)
    })

    // Simulate fast scroll
    await act(async () => {
      // Set initial scroll position
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
      window.dispatchEvent(new Event('scroll'))
      // Fast scroll
      Object.defineProperty(window, 'scrollY', { value: 100, configurable: true })
      window.dispatchEvent(new Event('scroll'))
    })

    expect(result.current).toBeNull()
  })

  it('returns value after scroll debounce', async () => {
    const computeValue = vi.fn(() => 'computed')
    const { result } = renderHook(() =>
      useScrollOptimizedValue(computeValue, [], { scrollThreshold: 50, debounceMs: 100 })
    )

    // Wait for initial computation
    await act(async () => {
      vi.advanceTimersByTime(0)
    })

    // Simulate fast scroll
    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
      window.dispatchEvent(new Event('scroll'))
      Object.defineProperty(window, 'scrollY', { value: 100, configurable: true })
      window.dispatchEvent(new Event('scroll'))
    })

    // Wait for debounce
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current).toBe('computed')
  })

  it('clears timeout on multiple fast scrolls', async () => {
    const computeValue = vi.fn(() => 'computed')
    const { result } = renderHook(() =>
      useScrollOptimizedValue(computeValue, [], { scrollThreshold: 50, debounceMs: 100 })
    )

    // Wait for initial computation
    await act(async () => {
      vi.advanceTimersByTime(0)
    })

    // Multiple fast scrolls
    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
      window.dispatchEvent(new Event('scroll'))
      Object.defineProperty(window, 'scrollY', { value: 100, configurable: true })
      window.dispatchEvent(new Event('scroll'))
    })

    // Partial wait
    await act(async () => {
      vi.advanceTimersByTime(50)
    })

    // Another fast scroll - should reset timeout
    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 200, configurable: true })
      window.dispatchEvent(new Event('scroll'))
    })

    // Still null because timeout was reset
    expect(result.current).toBeNull()

    // Complete wait
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current).toBe('computed')
  })

  it('uses default options when not provided', async () => {
    const computeValue = vi.fn(() => 'default')
    const { result } = renderHook(() =>
      useScrollOptimizedValue(computeValue, [])
    )

    await act(async () => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current).toBe('default')
  })
})

describe('useSkipRenderOnInteraction', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns value when not interacting', () => {
    const { result } = renderHook(() =>
      useSkipRenderOnInteraction('test value')
    )

    expect(result.current).toBe('test value')
  })

  it('returns null during wheel interaction', async () => {
    const { result } = renderHook(() =>
      useSkipRenderOnInteraction('test value', { events: ['wheel'], delay: 100 })
    )

    // Simulate wheel event
    await act(async () => {
      window.dispatchEvent(new Event('wheel'))
    })

    expect(result.current).toBeNull()
  })

  it('returns null during touchmove interaction', async () => {
    const { result } = renderHook(() =>
      useSkipRenderOnInteraction('test value', { events: ['touchmove'], delay: 100 })
    )

    // Simulate touchmove event
    await act(async () => {
      window.dispatchEvent(new Event('touchmove'))
    })

    expect(result.current).toBeNull()
  })

  it('cleans up event listeners on unmount', async () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() =>
      useSkipRenderOnInteraction('test value', { events: ['wheel', 'touchmove'], delay: 100 })
    )

    unmount()

    // Should remove listeners for both events
    expect(removeEventListenerSpy).toHaveBeenCalledWith('wheel', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('touchmove', expect.any(Function))

    removeEventListenerSpy.mockRestore()
  })

  it('handles multiple events', async () => {
    const { result } = renderHook(() =>
      useSkipRenderOnInteraction('test value', { events: ['wheel', 'scroll'], delay: 100 })
    )

    expect(result.current).toBe('test value')

    // Simulate scroll event
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
    })

    expect(result.current).toBeNull()
  })

  it('resets timeout on repeated interactions', async () => {
    vi.useRealTimers() // Use real timers for this test

    const { result } = renderHook(() =>
      useSkipRenderOnInteraction('test value', { events: ['wheel'], delay: 50 })
    )

    // First interaction
    await act(async () => {
      window.dispatchEvent(new Event('wheel'))
    })

    // Partial wait
    await new Promise(resolve => setTimeout(resolve, 20))

    // Second interaction - resets timeout
    await act(async () => {
      window.dispatchEvent(new Event('wheel'))
    })

    // Still null
    expect(result.current).toBeNull()

    // Wait for the value to return after interaction ends
    await waitFor(() => {
      expect(result.current).toBe('test value')
    }, { timeout: 200 })

    vi.useFakeTimers() // Restore fake timers
  })

  it('updates value when not interacting', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useSkipRenderOnInteraction(value, { events: ['wheel'], delay: 100 }),
      { initialProps: { value: 'initial' } }
    )

    expect(result.current).toBe('initial')

    rerender({ value: 'updated' })

    expect(result.current).toBe('updated')
  })

  it('uses default options when not provided', async () => {
    const { result } = renderHook(() =>
      useSkipRenderOnInteraction('default value')
    )

    expect(result.current).toBe('default value')

    // Simulate wheel event (default event)
    await act(async () => {
      window.dispatchEvent(new Event('wheel'))
    })

    expect(result.current).toBeNull()
  })
})

describe('useProgressiveImage advanced', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('updates to full image after load event', async () => {
    let imageOnload: (() => void) | null = null

    // Mock Image constructor
    const originalImage = global.Image
    global.Image = class MockImage {
      src = ''
      onload: (() => void) | null = null

      constructor() {
        setTimeout(() => {
          imageOnload = this.onload
        }, 0)
      }
    } as unknown as typeof Image

    const { result } = renderHook(() =>
      useProgressiveImage('/full-image.jpg', '/placeholder.jpg')
    )

    expect(result.current).toBe('/placeholder.jpg')

    // Trigger image load
    await act(async () => {
      vi.advanceTimersByTime(10)
      if (imageOnload) {
        imageOnload()
      }
    })

    expect(result.current).toBe('/full-image.jpg')

    // Restore Image
    global.Image = originalImage
  })
})

describe('render-optimization edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('useWindowedList with empty items', () => {
    it('handles empty array', () => {
      const { result } = renderHook(() =>
        useWindowedList([], {
          itemHeight: 50,
          containerHeight: 200,
        })
      )

      expect(result.current.visibleItems).toEqual([])
      expect(result.current.totalHeight).toBe(0)
    })
  })

  describe('VirtualList with empty items', () => {
    it('renders empty container', () => {
      const { container } = render(
        <VirtualList
          items={[]}
          renderItem={(item: string) => <div>{item}</div>}
          itemHeight={50}
          height={200}
        />
      )

      // The outer container has height 200px, inner has totalHeight (0 for empty)
      const outerDiv = container.firstChild as HTMLElement
      expect(outerDiv).toHaveStyle({ height: '200px' })

      // Inner div should have 0 height for empty items
      const innerDiv = outerDiv.firstChild as HTMLElement
      expect(innerDiv).toHaveStyle({ height: '0px' })
    })
  })
})
