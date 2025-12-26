import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Chip } from '../Chip'

describe('Chip', () => {
  it('renders children correctly', () => {
    render(<Chip>Test Chip</Chip>)
    expect(screen.getByText('Test Chip')).toBeInTheDocument()
  })

  it('applies neutral variant by default', () => {
    render(<Chip>Default</Chip>)
    const chip = screen.getByText('Default')
    expect(chip).toHaveClass('bg-neutral-surfaceAlt')
  })

  it('applies accent variant when specified', () => {
    render(<Chip variant="accent">Accent</Chip>)
    const chip = screen.getByText('Accent')
    expect(chip).toHaveClass('bg-brand-primary/10')
  })

  it('applies subtle variant when specified', () => {
    render(<Chip variant="subtle">Subtle</Chip>)
    const chip = screen.getByText('Subtle')
    expect(chip).toHaveClass('bg-neutral-surface')
    expect(chip).toHaveClass('text-neutral-textMuted')
  })

  it('applies custom className', () => {
    render(<Chip className="custom-class">Custom</Chip>)
    const chip = screen.getByText('Custom')
    expect(chip).toHaveClass('custom-class')
  })

  it('has correct base styles', () => {
    render(<Chip>Styled</Chip>)
    const chip = screen.getByText('Styled')
    expect(chip).toHaveClass('inline-flex')
    expect(chip).toHaveClass('items-center')
    expect(chip).toHaveClass('rounded-badge')
  })
})
