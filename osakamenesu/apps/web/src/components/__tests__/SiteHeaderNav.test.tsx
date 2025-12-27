import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/FavoriteHeartIcon', () => ({
  FavoriteHeartIcon: () => <span data-testid="heart-icon">❤</span>,
}))

vi.mock('@/app/auth/login/SiteLoginContent', () => ({
  SiteLoginContent: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="login-content">
      <input type="email" placeholder="Email" />
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

import SiteHeaderNav from '../SiteHeaderNav'

describe('SiteHeaderNav', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('shows login button for guest users', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    })

    render(<SiteHeaderNav />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
    })
  })

  it('shows logout button for authenticated users', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ display_name: 'Test User', email: 'test@example.com' }),
    })

    render(<SiteHeaderNav />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
    })
  })

  it('shows greeting with display name', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ display_name: 'テストユーザー' }),
    })

    render(<SiteHeaderNav />)

    await waitFor(() => {
      expect(screen.getByText('テストユーザー さん')).toBeInTheDocument()
    })
  })

  it('shows greeting with email when no display name', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ email: 'user@example.com' }),
    })

    render(<SiteHeaderNav />)

    await waitFor(() => {
      expect(screen.getByText('user@example.com さん')).toBeInTheDocument()
    })
  })

  it('shows generic greeting when no name or email', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    render(<SiteHeaderNav />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
    })
  })

  it('opens login overlay when login button is clicked', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    })

    render(<SiteHeaderNav />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(screen.getByTestId('login-content')).toBeInTheDocument()
  })

  it('closes login overlay when clicking backdrop', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    })

    render(<SiteHeaderNav />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }))
    expect(screen.getByTestId('login-content')).toBeInTheDocument()

    // Click the backdrop (aria-hidden div)
    const backdrop = screen.getByRole('dialog').parentElement?.querySelector('[aria-hidden="true"]')
    fireEvent.click(backdrop!)

    await waitFor(() => {
      expect(screen.queryByTestId('login-content')).not.toBeInTheDocument()
    })
  })

  it('closes login overlay on Escape key', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    })

    render(<SiteHeaderNav />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }))
    expect(screen.getByTestId('login-content')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByTestId('login-content')).not.toBeInTheDocument()
    })
  })

  it('shows favorites link', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    })

    render(<SiteHeaderNav />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'お気に入り' })).toBeInTheDocument()
    })
  })

  it('shows dashboard link for guests', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    })

    render(<SiteHeaderNav />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '店舗ダッシュボード' })).toBeInTheDocument()
    })
  })

  it('handles network errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    render(<SiteHeaderNav />)

    // Should fall back to guest state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
    })
  })

  it('handles malformed JSON response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('Invalid JSON')
      },
    })

    render(<SiteHeaderNav />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
    })
  })

  it('performs logout on button click', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ display_name: 'User' }),
      })
      .mockResolvedValueOnce({
        ok: true,
      })

    global.fetch = mockFetch

    render(<SiteHeaderNav />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }))
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
        method: 'POST',
      }))
    })
  })
})
