import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingSpinner, LoadingOverlay, LoadingPage } from '../LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders with default props', () => {
    render(<LoadingSpinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('has accessible label by default', () => {
    render(<LoadingSpinner />)
    expect(screen.getByLabelText('読み込み中')).toBeInTheDocument()
  })

  it('uses custom label for accessibility', () => {
    render(<LoadingSpinner label="データを取得中" />)
    expect(screen.getByLabelText('データを取得中')).toBeInTheDocument()
  })

  it('shows label text when provided', () => {
    render(<LoadingSpinner label="読み込み中..." />)
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('applies sm size class', () => {
    render(<LoadingSpinner size="sm" />)
    const spinner = screen.getByRole('status')
    expect(spinner).toHaveClass('h-4', 'w-4')
  })

  it('applies md size class by default', () => {
    render(<LoadingSpinner />)
    const spinner = screen.getByRole('status')
    expect(spinner).toHaveClass('h-6', 'w-6')
  })

  it('applies lg size class', () => {
    render(<LoadingSpinner size="lg" />)
    const spinner = screen.getByRole('status')
    expect(spinner).toHaveClass('h-8', 'w-8')
  })

  it('applies custom className', () => {
    const { container } = render(<LoadingSpinner className="custom-spinner" />)
    expect(container.firstChild).toHaveClass('custom-spinner')
  })

  it('has animation class', () => {
    render(<LoadingSpinner />)
    const spinner = screen.getByRole('status')
    expect(spinner).toHaveClass('animate-spin')
  })
})

describe('LoadingOverlay', () => {
  it('renders with default label', () => {
    render(<LoadingOverlay />)
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('renders with custom label', () => {
    render(<LoadingOverlay label="処理中..." />)
    expect(screen.getByText('処理中...')).toBeInTheDocument()
  })

  it('renders spinner with lg size', () => {
    render(<LoadingOverlay />)
    const spinner = screen.getByRole('status')
    expect(spinner).toHaveClass('h-8', 'w-8')
  })

  it('has min-height for overlay', () => {
    const { container } = render(<LoadingOverlay />)
    expect(container.firstChild).toHaveClass('min-h-[200px]')
  })
})

describe('LoadingPage', () => {
  it('renders with default label', () => {
    render(<LoadingPage />)
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('renders with custom label', () => {
    render(<LoadingPage label="ページを読み込み中..." />)
    expect(screen.getByText('ページを読み込み中...')).toBeInTheDocument()
  })

  it('renders spinner with lg size', () => {
    render(<LoadingPage />)
    const spinner = screen.getByRole('status')
    expect(spinner).toHaveClass('h-8', 'w-8')
  })

  it('has larger min-height for page', () => {
    const { container } = render(<LoadingPage />)
    expect(container.firstChild).toHaveClass('min-h-[400px]')
  })
})
