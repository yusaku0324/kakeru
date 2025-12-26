import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Label } from '../label'

describe('Label', () => {
  describe('rendering', () => {
    it('renders children', () => {
      render(<Label>Email</Label>)
      expect(screen.getByText('Email')).toBeInTheDocument()
    })

    it('renders as label element', () => {
      render(<Label>Name</Label>)
      const label = screen.getByText('Name')
      expect(label.tagName).toBe('LABEL')
    })
  })

  describe('props', () => {
    it('applies custom className', () => {
      render(<Label className="custom-label">Custom</Label>)
      expect(screen.getByText('Custom')).toHaveClass('custom-label')
    })

    it('passes through htmlFor attribute', () => {
      render(<Label htmlFor="email-input">Email</Label>)
      expect(screen.getByText('Email')).toHaveAttribute('for', 'email-input')
    })

    it('passes through other HTML attributes', () => {
      render(<Label data-testid="test-label">Test</Label>)
      expect(screen.getByText('Test')).toHaveAttribute('data-testid', 'test-label')
    })
  })

  describe('styling', () => {
    it('has base text styles', () => {
      render(<Label>Styled</Label>)
      const label = screen.getByText('Styled')
      expect(label).toHaveClass('text-sm')
      expect(label).toHaveClass('font-medium')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to label element', () => {
      const ref = { current: null as HTMLLabelElement | null }
      render(<Label ref={ref}>With Ref</Label>)
      expect(ref.current).toBeInstanceOf(HTMLLabelElement)
    })
  })

  describe('integration', () => {
    it('associates with input via htmlFor', () => {
      render(
        <>
          <Label htmlFor="test-input">Test Label</Label>
          <input id="test-input" type="text" />
        </>,
      )

      const input = screen.getByRole('textbox')
      const label = screen.getByText('Test Label')
      expect(label).toHaveAttribute('for', 'test-input')
      expect(input).toHaveAttribute('id', 'test-input')
    })
  })
})
