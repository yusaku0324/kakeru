/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConflictErrorBanner, type ConflictError } from '../ConflictErrorBanner'

describe('ConflictErrorBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when error is null', () => {
    const { container } = render(
      <ConflictErrorBanner error={null} onDismiss={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders error message when error is provided', () => {
    const error: ConflictError = {
      message: 'この時間は既に予約されています',
      slotStart: '2024-12-27T10:00:00',
      showUntil: Date.now() + 10000,
    }

    render(<ConflictErrorBanner error={error} onDismiss={vi.fn()} />)

    expect(screen.getByText('この時間は既に予約されています')).toBeInTheDocument()
    expect(screen.getByText(/カレンダーを更新しました/)).toBeInTheDocument()
  })

  it('has correct accessibility attributes', () => {
    const error: ConflictError = {
      message: 'Conflict error',
      slotStart: '2024-12-27T10:00:00',
      showUntil: Date.now() + 10000,
    }

    render(<ConflictErrorBanner error={error} onDismiss={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive')
  })

  it('calls onDismiss when close button is clicked', async () => {
    vi.useRealTimers() // Use real timers for user events
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    const error: ConflictError = {
      message: 'Conflict error',
      slotStart: '2024-12-27T10:00:00',
      showUntil: Date.now() + 10000,
    }

    render(<ConflictErrorBanner error={error} onDismiss={onDismiss} />)

    const closeButton = screen.getByRole('button', { name: '閉じる' })
    await user.click(closeButton)

    expect(onDismiss).toHaveBeenCalledTimes(1)
    vi.useFakeTimers() // Restore fake timers for other tests
  })

  it('auto-dismisses after showUntil time', async () => {
    const onDismiss = vi.fn()
    const now = Date.now()
    const error: ConflictError = {
      message: 'Conflict error',
      slotStart: '2024-12-27T10:00:00',
      showUntil: now + 5000, // 5 seconds from now
    }

    render(<ConflictErrorBanner error={error} onDismiss={onDismiss} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(onDismiss).not.toHaveBeenCalled()

    // Advance time past showUntil
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('dismisses immediately if showUntil is in the past', () => {
    const onDismiss = vi.fn()
    const error: ConflictError = {
      message: 'Conflict error',
      slotStart: '2024-12-27T10:00:00',
      showUntil: Date.now() - 1000, // Already passed
    }

    const { container } = render(
      <ConflictErrorBanner error={error} onDismiss={onDismiss} />
    )

    expect(container.firstChild).toBeNull()
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('clears timeout on unmount', () => {
    const onDismiss = vi.fn()
    const error: ConflictError = {
      message: 'Conflict error',
      slotStart: '2024-12-27T10:00:00',
      showUntil: Date.now() + 10000,
    }

    const { unmount } = render(
      <ConflictErrorBanner error={error} onDismiss={onDismiss} />
    )

    unmount()

    // Advance time - should not call onDismiss since unmounted
    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('hides when error becomes null', () => {
    const onDismiss = vi.fn()
    const error: ConflictError = {
      message: 'Conflict error',
      slotStart: '2024-12-27T10:00:00',
      showUntil: Date.now() + 10000,
    }

    const { rerender, container } = render(
      <ConflictErrorBanner error={error} onDismiss={onDismiss} />
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(<ConflictErrorBanner error={null} onDismiss={onDismiss} />)

    expect(container.firstChild).toBeNull()
  })
})
