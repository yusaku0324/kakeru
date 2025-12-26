/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotFound from '../not-found'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

describe('NotFound', () => {
  it('renders not found message', () => {
    render(<NotFound />)

    expect(screen.getByText('ページが見つかりません')).toBeInTheDocument()
    expect(
      screen.getByText(/お探しのページは存在しないか、移動した可能性があります/)
    ).toBeInTheDocument()
  })

  it('has link to home page', () => {
    render(<NotFound />)

    const link = screen.getByText('トップへ戻る')
    expect(link).toHaveAttribute('href', '/')
  })

  it('has correct structure and styling classes', () => {
    render(<NotFound />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveClass('text-xl', 'font-bold')
  })
})
