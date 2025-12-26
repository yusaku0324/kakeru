import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '../Card'

describe('Card', () => {
  it('renders children correctly', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('renders as article by default', () => {
    render(<Card>Content</Card>)
    const card = screen.getByText('Content').closest('article')
    expect(card).toBeInTheDocument()
  })

  it('renders as div when specified', () => {
    render(<Card as="div">Content</Card>)
    const card = screen.getByText('Content').closest('div')
    expect(card).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('renders as section when specified', () => {
    render(<Card as="section">Content</Card>)
    const card = screen.getByText('Content').closest('section')
    expect(card).toBeInTheDocument()
  })

  it('applies base styles', () => {
    render(<Card>Styled card</Card>)
    const card = screen.getByText('Styled card').closest('article')
    expect(card).toHaveClass('rounded-card')
    expect(card).toHaveClass('border')
    expect(card).toHaveClass('bg-neutral-surface')
  })

  it('applies custom className', () => {
    render(<Card className="custom-card">Custom</Card>)
    const card = screen.getByText('Custom').closest('article')
    expect(card).toHaveClass('custom-card')
  })

  it('applies interactive styles when interactive is true', () => {
    render(<Card interactive>Interactive card</Card>)
    const card = screen.getByText('Interactive card').closest('article')
    expect(card).toHaveClass('hover:shadow-cardHover')
    expect(card).toHaveClass('focus-within:shadow-cardHover')
  })

  it('does not apply interactive styles by default', () => {
    render(<Card>Non-interactive card</Card>)
    const card = screen.getByText('Non-interactive card').closest('article')
    expect(card).not.toHaveClass('hover:shadow-cardHover')
  })

  it('passes through additional props', () => {
    render(<Card data-testid="test-card">Content</Card>)
    expect(screen.getByTestId('test-card')).toBeInTheDocument()
  })
})
