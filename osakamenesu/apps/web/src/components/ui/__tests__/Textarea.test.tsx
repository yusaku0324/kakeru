import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Textarea } from '../textarea'

describe('Textarea', () => {
  describe('rendering', () => {
    it('renders textarea element', () => {
      render(<Textarea />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('renders with placeholder', () => {
      render(<Textarea placeholder="Enter description" />)
      expect(screen.getByPlaceholderText('Enter description')).toBeInTheDocument()
    })
  })

  describe('props', () => {
    it('applies custom className', () => {
      render(<Textarea className="custom-textarea" />)
      expect(screen.getByRole('textbox')).toHaveClass('custom-textarea')
    })

    it('passes through rows attribute', () => {
      render(<Textarea rows={5} />)
      expect(screen.getByRole('textbox')).toHaveAttribute('rows', '5')
    })

    it('passes through name attribute', () => {
      render(<Textarea name="description" />)
      expect(screen.getByRole('textbox')).toHaveAttribute('name', 'description')
    })

    it('handles value and onChange', async () => {
      const handleChange = vi.fn()
      render(<Textarea onChange={handleChange} />)

      const textarea = screen.getByRole('textbox')
      await userEvent.type(textarea, 'test content')
      expect(handleChange).toHaveBeenCalled()
    })
  })

  describe('disabled state', () => {
    it('renders as disabled', () => {
      render(<Textarea disabled />)
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('applies disabled styles', () => {
      render(<Textarea disabled />)
      expect(screen.getByRole('textbox')).toHaveClass('disabled:opacity-50')
    })
  })

  describe('styling', () => {
    it('has base styles', () => {
      render(<Textarea />)
      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveClass('rounded-lg')
      expect(textarea).toHaveClass('border')
      expect(textarea).toHaveClass('w-full')
    })

    it('has min-height', () => {
      render(<Textarea />)
      expect(screen.getByRole('textbox')).toHaveClass('min-h-[80px]')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to textarea element', () => {
      const ref = { current: null as HTMLTextAreaElement | null }
      render(<Textarea ref={ref} />)
      expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
    })
  })

  describe('required state', () => {
    it('renders as required', () => {
      render(<Textarea required />)
      expect(screen.getByRole('textbox')).toBeRequired()
    })
  })

  describe('maxLength', () => {
    it('respects maxLength attribute', () => {
      render(<Textarea maxLength={100} />)
      expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '100')
    })
  })
})
