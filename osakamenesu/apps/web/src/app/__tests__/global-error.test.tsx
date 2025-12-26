/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GlobalError from '../global-error'

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

describe('GlobalError', () => {
  const mockReset = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('renders error message', () => {
    const error = new Error('Test error')
    render(<GlobalError error={error} reset={mockReset} />)

    expect(screen.getByText('システムエラー')).toBeInTheDocument()
    expect(
      screen.getByText(/申し訳ございません。システムエラーが発生しました/)
    ).toBeInTheDocument()
  })

  it('calls reset when retry button is clicked', () => {
    const error = new Error('Test error')
    render(<GlobalError error={error} reset={mockReset} />)

    fireEvent.click(screen.getByText('再試行'))
    expect(mockReset).toHaveBeenCalledTimes(1)
  })

  it('has link to home page', () => {
    const error = new Error('Test error')
    render(<GlobalError error={error} reset={mockReset} />)

    const link = screen.getByText('トップへ')
    expect(link).toHaveAttribute('href', '/')
  })

  it('logs error to console', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Test error')
    render(<GlobalError error={error} reset={mockReset} />)

    expect(consoleErrorSpy).toHaveBeenCalledWith('[Critical Error]', error)
  })

  it('sends error to Sentry when DSN is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://test@sentry.io/123')
    vi.resetModules()

    const Sentry = await import('@sentry/nextjs')
    const error = Object.assign(new Error('Test error'), { digest: 'test-digest' })

    const { default: ErrorComponent } = await import('../global-error')
    render(<ErrorComponent error={error} reset={mockReset} />)

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { level: 'critical' },
      extra: { digest: 'test-digest' },
    })
  })

  it('renders emoji and correct html structure', () => {
    const error = new Error('Test error')
    render(<GlobalError error={error} reset={mockReset} />)

    expect(screen.getByText('🚨')).toBeInTheDocument()
  })
})
