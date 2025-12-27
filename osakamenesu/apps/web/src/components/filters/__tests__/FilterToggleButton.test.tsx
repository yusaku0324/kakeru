/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterToggleButton } from '../FilterToggleButton'

describe('FilterToggleButton', () => {
  it('renders primary variant by default', () => {
    render(<FilterToggleButton onClick={vi.fn()} />)

    const button = screen.getByRole('button', { name: /フィルターを開く/i })
    expect(button).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(<FilterToggleButton onClick={onClick} />)

    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders secondary variant', () => {
    render(<FilterToggleButton onClick={vi.fn()} variant="secondary" />)

    const button = screen.getByRole('button', { name: /フィルターを開く/i })
    expect(button).toBeInTheDocument()
  })

  it('renders compact variant with different text', () => {
    render(<FilterToggleButton onClick={vi.fn()} variant="compact" />)

    const button = screen.getByRole('button', { name: /フィルターを変更/i })
    expect(button).toBeInTheDocument()
  })

  it('applies custom className to primary variant', () => {
    render(<FilterToggleButton onClick={vi.fn()} className="custom-class" />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })

  it('applies custom className to secondary variant', () => {
    render(
      <FilterToggleButton onClick={vi.fn()} variant="secondary" className="custom-class" />
    )

    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })

  it('applies custom className to compact variant', () => {
    render(
      <FilterToggleButton onClick={vi.fn()} variant="compact" className="custom-class" />
    )

    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })

  it('primary variant has gradient styling', () => {
    render(<FilterToggleButton onClick={vi.fn()} variant="primary" />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-gradient-to-r')
  })

  it('secondary variant has border styling', () => {
    render(<FilterToggleButton onClick={vi.fn()} variant="secondary" />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('border')
    expect(button).toHaveClass('bg-white')
  })

  it('compact variant has smaller styling', () => {
    render(<FilterToggleButton onClick={vi.fn()} variant="compact" />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('text-xs')
  })
})
