import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Section } from '../Section'

describe('Section', () => {
  describe('rendering', () => {
    it('renders section element', () => {
      const { container } = render(
        <Section title="Test Title">
          <p>Content</p>
        </Section>,
      )
      expect(container.querySelector('section')).toBeInTheDocument()
    })

    it('renders title as h2', () => {
      render(
        <Section title="Section Title">
          <p>Content</p>
        </Section>,
      )
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Section Title')
    })

    it('renders children content', () => {
      render(
        <Section title="Test">
          <p>Child content</p>
        </Section>,
      )
      expect(screen.getByText('Child content')).toBeInTheDocument()
    })
  })

  describe('subtitle', () => {
    it('renders subtitle when provided', () => {
      render(
        <Section title="Title" subtitle="Subtitle text">
          <p>Content</p>
        </Section>,
      )
      expect(screen.getByText('Subtitle text')).toBeInTheDocument()
    })

    it('does not render subtitle when not provided', () => {
      render(
        <Section title="Title">
          <p>Content</p>
        </Section>,
      )
      expect(screen.queryByText(/subtitle/i)).not.toBeInTheDocument()
    })
  })

  describe('actions', () => {
    it('renders actions when provided', () => {
      render(
        <Section title="Title" actions={<button type="button">Action</button>}>
          <p>Content</p>
        </Section>,
      )
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
    })

    it('does not render actions container when not provided', () => {
      const { container } = render(
        <Section title="Title">
          <p>Content</p>
        </Section>,
      )
      const actionsContainer = container.querySelector('.flex.items-center.gap-2')
      expect(actionsContainer).not.toBeInTheDocument()
    })
  })

  describe('props', () => {
    it('applies custom className', () => {
      const { container } = render(
        <Section title="Title" className="custom-section">
          <p>Content</p>
        </Section>,
      )
      expect(container.querySelector('section')).toHaveClass('custom-section')
    })

    it('applies id attribute', () => {
      const { container } = render(
        <Section title="Title" id="test-section">
          <p>Content</p>
        </Section>,
      )
      expect(container.querySelector('section')).toHaveAttribute('id', 'test-section')
    })
  })

  describe('ariaLive', () => {
    it('applies default aria-live off', () => {
      const { container } = render(
        <Section title="Title">
          <p>Content</p>
        </Section>,
      )
      expect(container.querySelector('section')).toHaveAttribute('aria-live', 'off')
    })

    it('applies polite aria-live', () => {
      const { container } = render(
        <Section title="Title" ariaLive="polite">
          <p>Content</p>
        </Section>,
      )
      expect(container.querySelector('section')).toHaveAttribute('aria-live', 'polite')
    })

    it('applies assertive aria-live', () => {
      const { container } = render(
        <Section title="Title" ariaLive="assertive">
          <p>Content</p>
        </Section>,
      )
      expect(container.querySelector('section')).toHaveAttribute('aria-live', 'assertive')
    })
  })

  describe('styling', () => {
    it('has base section styles', () => {
      const { container } = render(
        <Section title="Title">
          <p>Content</p>
        </Section>,
      )
      const section = container.querySelector('section')
      expect(section).toHaveClass('rounded-section')
      expect(section).toHaveClass('bg-neutral-surface')
      expect(section).toHaveClass('p-6')
    })
  })
})
