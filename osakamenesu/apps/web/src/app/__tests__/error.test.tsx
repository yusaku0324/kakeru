/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GlobalError from '../error'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

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

    expect(screen.getByText('予期しないエラーが発生しました')).toBeInTheDocument()
    expect(
      screen.getByText(/ページの読み込み中に問題が発生しました/)
    ).toBeInTheDocument()
  })

  it('displays error digest when available', () => {
    const error = Object.assign(new Error('Test error'), { digest: 'abc123' })
    render(<GlobalError error={error} reset={mockReset} />)

    expect(screen.getByText(/エラーID: abc123/)).toBeInTheDocument()
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

    const link = screen.getByText('トップへ戻る')
    expect(link).toHaveAttribute('href', '/')
  })

  it('logs error to console', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Test error')
    render(<GlobalError error={error} reset={mockReset} />)

    expect(consoleErrorSpy).toHaveBeenCalledWith('[Global Error]', error)
  })

  it('sends error to Sentry when DSN is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://test@sentry.io/123')
    vi.resetModules()

    const Sentry = await import('@sentry/nextjs')
    const error = Object.assign(new Error('Test error'), { digest: 'test-digest' })

    const { default: ErrorComponent } = await import('../error')
    render(<ErrorComponent error={error} reset={mockReset} />)

    // Sentry.captureException should have been called
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      extra: { digest: 'test-digest' },
    })
  })
})
