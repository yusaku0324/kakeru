import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstinctTag } from '../instinct-tag'

describe('InstinctTag', () => {
  describe('rendering', () => {
    it('renders as button', () => {
      render(<InstinctTag kind="relax" />)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('renders default label for kind', () => {
      render(<InstinctTag kind="relax" />)
      expect(screen.getByText('とにかく癒されたい')).toBeInTheDocument()
    })

    it('renders custom label when provided', () => {
      render(<InstinctTag kind="relax" label="カスタムラベル" />)
      expect(screen.getByText('カスタムラベル')).toBeInTheDocument()
    })

    it('renders default emoji icon', () => {
      render(<InstinctTag kind="relax" />)
      expect(screen.getByText('🌿')).toBeInTheDocument()
    })

    it('hides icon when icon is null', () => {
      render(<InstinctTag kind="relax" icon={null} />)
      expect(screen.queryByText('🌿')).not.toBeInTheDocument()
    })

    it('renders custom icon when provided', () => {
      render(<InstinctTag kind="relax" icon={<span data-testid="custom-icon">★</span>} />)
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
    })
  })

  describe('instinct kinds', () => {
    it('renders relax kind', () => {
      render(<InstinctTag kind="relax" />)
      expect(screen.getByText('🌿')).toBeInTheDocument()
      expect(screen.getByText('とにかく癒されたい')).toBeInTheDocument()
    })

    it('renders talk kind', () => {
      render(<InstinctTag kind="talk" />)
      expect(screen.getByText('💬')).toBeInTheDocument()
      expect(screen.getByText('たくさん喋りたい')).toBeInTheDocument()
    })

    it('renders reset kind', () => {
      render(<InstinctTag kind="reset" />)
      expect(screen.getByText('🧖')).toBeInTheDocument()
    })

    it('renders excitement kind', () => {
      render(<InstinctTag kind="excitement" />)
      expect(screen.getByText('✨')).toBeInTheDocument()
    })

    it('renders healing kind', () => {
      render(<InstinctTag kind="healing" />)
      expect(screen.getByText('🤝')).toBeInTheDocument()
    })

    it('renders quiet kind', () => {
      render(<InstinctTag kind="quiet" />)
      expect(screen.getByText('🌙')).toBeInTheDocument()
    })
  })

  describe('active state', () => {
    it('sets aria-pressed to false by default', () => {
      render(<InstinctTag kind="relax" />)
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
    })

    it('sets aria-pressed to true when active', () => {
      render(<InstinctTag kind="relax" active />)
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    })

    it('sets data-active attribute', () => {
      render(<InstinctTag kind="relax" active />)
      expect(screen.getByRole('button')).toHaveAttribute('data-active', 'true')
    })

    it('sets data-instinct-kind attribute', () => {
      render(<InstinctTag kind="talk" />)
      expect(screen.getByRole('button')).toHaveAttribute('data-instinct-kind', 'talk')
    })
  })

  describe('sizes', () => {
    it('applies md size by default', () => {
      render(<InstinctTag kind="relax" />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('px-3')
      expect(button).toHaveClass('py-1.5')
      expect(button).toHaveClass('text-sm')
    })

    it('applies sm size', () => {
      render(<InstinctTag kind="relax" size="sm" />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('px-2.5')
      expect(button).toHaveClass('py-1')
      expect(button).toHaveClass('text-xs')
    })
  })

  describe('interaction', () => {
    it('handles click events', async () => {
      const handleClick = vi.fn()
      render(<InstinctTag kind="relax" onClick={handleClick} />)

      await userEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('is disabled when disabled prop is true', () => {
      render(<InstinctTag kind="relax" disabled />)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('does not call onClick when disabled', async () => {
      const handleClick = vi.fn()
      render(<InstinctTag kind="relax" onClick={handleClick} disabled />)

      await userEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('styling', () => {
    it('has base styles', () => {
      render(<InstinctTag kind="relax" />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('rounded-full')
      expect(button).toHaveClass('border')
    })

    it('applies custom className', () => {
      render(<InstinctTag kind="relax" className="custom-class" />)
      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to button element', () => {
      const ref = { current: null as HTMLButtonElement | null }
      render(<InstinctTag kind="relax" ref={ref} />)
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })
  })
})
