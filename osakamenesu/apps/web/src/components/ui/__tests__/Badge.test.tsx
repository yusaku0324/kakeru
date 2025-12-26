import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../Badge'

describe('Badge', () => {
  it('renders children correctly', () => {
    render(<Badge>Test Badge</Badge>)
    expect(screen.getByText('Test Badge')).toBeInTheDocument()
  })

  it('applies neutral variant by default', () => {
    render(<Badge>Default</Badge>)
    const badge = screen.getByText('Default').parentElement
    expect(badge).toHaveClass('bg-neutral-surfaceAlt')
  })

  it('applies brand variant when specified', () => {
    render(<Badge variant="brand">Brand</Badge>)
    const badge = screen.getByText('Brand').parentElement
    expect(badge).toHaveClass('bg-brand-primary')
  })

  it('applies success variant when specified', () => {
    render(<Badge variant="success">Success</Badge>)
    const badge = screen.getByText('Success').parentElement
    expect(badge).toHaveClass('bg-state-successBg')
  })

  it('applies danger variant when specified', () => {
    render(<Badge variant="danger">Danger</Badge>)
    const badge = screen.getByText('Danger').parentElement
    expect(badge).toHaveClass('bg-state-dangerBg')
  })

  it('applies outline variant when specified', () => {
    render(<Badge variant="outline">Outline</Badge>)
    const badge = screen.getByText('Outline').parentElement
    expect(badge).toHaveClass('bg-neutral-surface')
  })

  it('renders leadingIcon when provided', () => {
    render(<Badge leadingIcon={<span data-testid="icon">★</span>}>With Icon</Badge>)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('does not render icon container when no leadingIcon', () => {
    const { container } = render(<Badge>No Icon</Badge>)
    const iconContainers = container.querySelectorAll('.grid.place-items-center')
    expect(iconContainers).toHaveLength(0)
  })

  it('applies custom className', () => {
    render(<Badge className="custom-class">Custom</Badge>)
    const badge = screen.getByText('Custom').parentElement
    expect(badge).toHaveClass('custom-class')
  })
})
