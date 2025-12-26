import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../input'

describe('Input', () => {
  describe('rendering', () => {
    it('renders input element', () => {
      render(<Input />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('renders with placeholder', () => {
      render(<Input placeholder="Enter text" />)
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
    })
  })

  describe('types', () => {
    it('renders input without explicit type attribute by default', () => {
      const { container } = render(<Input />)
      const input = container.querySelector('input')
      // Without explicit type, HTML inputs default to text
      expect(input).toBeInTheDocument()
    })

    it('renders email type', () => {
      render(<Input type="email" data-testid="email-input" />)
      expect(screen.getByTestId('email-input')).toHaveAttribute('type', 'email')
    })

    it('renders password type', () => {
      const { container } = render(<Input type="password" />)
      const input = container.querySelector('input[type="password"]')
      expect(input).toBeInTheDocument()
    })

    it('renders number type', () => {
      render(<Input type="number" />)
      expect(screen.getByRole('spinbutton')).toBeInTheDocument()
    })
  })

  describe('props', () => {
    it('applies custom className', () => {
      render(<Input className="custom-input" />)
      expect(screen.getByRole('textbox')).toHaveClass('custom-input')
    })

    it('passes through HTML input attributes', () => {
      render(<Input name="email" required data-testid="email-input" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('name', 'email')
      expect(input).toBeRequired()
      expect(input).toHaveAttribute('data-testid', 'email-input')
    })

    it('handles value and onChange', async () => {
      const handleChange = vi.fn()
      render(<Input onChange={handleChange} />)

      const input = screen.getByRole('textbox')
      await userEvent.type(input, 'test')
      expect(handleChange).toHaveBeenCalled()
    })
  })

  describe('disabled state', () => {
    it('renders as disabled', () => {
      render(<Input disabled />)
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('applies disabled styles', () => {
      render(<Input disabled />)
      expect(screen.getByRole('textbox')).toHaveClass('disabled:opacity-50')
    })
  })

  describe('styling', () => {
    it('has base styles', () => {
      render(<Input />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('rounded-lg')
      expect(input).toHaveClass('border')
      expect(input).toHaveClass('w-full')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to input element', () => {
      const ref = { current: null as HTMLInputElement | null }
      render(<Input ref={ref} />)
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })
  })
})
