import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SkipLinks } from './SkipLinks'

describe('SkipLinks', () => {
  describe('rendering', () => {
    it('renders the skip link', () => {
      render(<SkipLinks />)
      const link = screen.getByRole('link', { name: 'メインコンテンツへスキップ' })
      expect(link).toBeInTheDocument()
    })

    it('has correct href to main content', () => {
      render(<SkipLinks />)
      const link = screen.getByRole('link', { name: 'メインコンテンツへスキップ' })
      expect(link).toHaveAttribute('href', '#main-content')
    })
  })

  describe('visibility', () => {
    it('is visually hidden by default', () => {
      render(<SkipLinks />)
      const container = screen.getByRole('link', { name: 'メインコンテンツへスキップ' }).parentElement
      expect(container).toHaveClass('sr-only')
    })

    it('becomes visible when focused', async () => {
      const user = userEvent.setup()
      render(<SkipLinks />)

      const link = screen.getByRole('link', { name: 'メインコンテンツへスキップ' })
      await user.tab()

      // When the link inside gets focus, the container should have focus-within styles
      const container = link.parentElement
      expect(container).toHaveClass('focus-within:not-sr-only')
      expect(container).toHaveClass('focus-within:fixed')
    })
  })

  describe('styling', () => {
    it('has proper focus styles for accessibility', () => {
      render(<SkipLinks />)
      const link = screen.getByRole('link', { name: 'メインコンテンツへスキップ' })

      // Check that focus ring styles are present
      expect(link).toHaveClass('focus:ring-2')
      expect(link).toHaveClass('focus:ring-brand-primary')
    })

    it('has brand primary background', () => {
      render(<SkipLinks />)
      const link = screen.getByRole('link', { name: 'メインコンテンツへスキップ' })
      expect(link).toHaveClass('bg-brand-primary')
    })
  })

  describe('accessibility', () => {
    it('has proper link role', () => {
      render(<SkipLinks />)
      expect(screen.getByRole('link')).toBeInTheDocument()
    })

    it('has accessible name', () => {
      render(<SkipLinks />)
      const link = screen.getByRole('link')
      expect(link).toHaveAccessibleName('メインコンテンツへスキップ')
    })

    it('contains an icon with aria-hidden', () => {
      render(<SkipLinks />)
      const svg = document.querySelector('svg')
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('integration with main content', () => {
    it('navigates to main-content anchor', () => {
      render(
        <>
          <SkipLinks />
          <main id="main-content" tabIndex={-1}>
            <p>Main content here</p>
          </main>
        </>
      )

      const link = screen.getByRole('link', { name: 'メインコンテンツへスキップ' })
      expect(link.getAttribute('href')).toBe('#main-content')

      // Verify main content exists with correct id
      const main = document.getElementById('main-content')
      expect(main).toBeInTheDocument()
      expect(main).toHaveAttribute('tabIndex', '-1')
    })
  })
})
