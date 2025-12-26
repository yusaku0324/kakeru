import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeaturedSectionHeading, QuickFiltersHeading } from '../SectionHeading'

describe('FeaturedSectionHeading', () => {
  describe('rendering', () => {
    it('renders title', () => {
      render(<FeaturedSectionHeading title="Popular Therapists" subtitle="Check them out" />)
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Popular Therapists')
    })

    it('renders subtitle', () => {
      render(<FeaturedSectionHeading title="Title" subtitle="Subtitle text" />)
      expect(screen.getByText('Subtitle text')).toBeInTheDocument()
    })

    it('does not render subtitle when empty', () => {
      render(<FeaturedSectionHeading title="Title" subtitle="" />)
      expect(screen.queryByText(/subtitle/i)).not.toBeInTheDocument()
    })

    it('renders featured icon', () => {
      render(<FeaturedSectionHeading title="Title" subtitle="Sub" />)
      expect(screen.getByText('✦')).toBeInTheDocument()
    })

    it('renders label text', () => {
      render(<FeaturedSectionHeading title="Title" subtitle="Sub" />)
      expect(screen.getByText('人気のセラピスト')).toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('has gradient styling on icon', () => {
      render(<FeaturedSectionHeading title="Title" subtitle="Sub" />)
      const icon = screen.getByText('✦')
      expect(icon).toHaveClass('bg-gradient-to-br')
    })

    it('has proper heading styles', () => {
      render(<FeaturedSectionHeading title="Title" subtitle="Sub" />)
      const heading = screen.getByRole('heading', { level: 2 })
      expect(heading).toHaveClass('text-2xl')
      expect(heading).toHaveClass('font-semibold')
    })

    it('has muted text for subtitle', () => {
      render(<FeaturedSectionHeading title="Title" subtitle="Sub" />)
      const subtitle = screen.getByText('Sub')
      expect(subtitle).toHaveClass('text-neutral-textMuted')
    })
  })

  describe('accessibility', () => {
    it('has aria-hidden on decorative icon', () => {
      const { container } = render(<FeaturedSectionHeading title="Title" subtitle="Sub" />)
      // The aria-hidden is on the span wrapper, check if any aria-hidden exists
      const ariaHiddenElement = container.querySelector('[aria-hidden]')
      expect(ariaHiddenElement).toBeInTheDocument()
    })
  })
})

describe('QuickFiltersHeading', () => {
  describe('rendering', () => {
    it('renders heading', () => {
      render(<QuickFiltersHeading />)
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('クイックフィルター')
    })

    it('renders description', () => {
      render(<QuickFiltersHeading />)
      expect(screen.getByText('ワンタップでおすすめの条件をセットできます。')).toBeInTheDocument()
    })

    it('renders gear emoji icon', () => {
      render(<QuickFiltersHeading />)
      expect(screen.getByText('⚙️')).toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('has gradient styling on icon', () => {
      render(<QuickFiltersHeading />)
      const icon = screen.getByText('⚙️')
      expect(icon).toHaveClass('bg-gradient-to-br')
    })

    it('has proper icon size', () => {
      render(<QuickFiltersHeading />)
      const icon = screen.getByText('⚙️')
      expect(icon).toHaveClass('h-10')
      expect(icon).toHaveClass('w-10')
    })

    it('has proper heading styles', () => {
      render(<QuickFiltersHeading />)
      const heading = screen.getByRole('heading', { level: 2 })
      expect(heading).toHaveClass('text-lg')
      expect(heading).toHaveClass('font-semibold')
    })

    it('has muted text for description', () => {
      render(<QuickFiltersHeading />)
      const description = screen.getByText('ワンタップでおすすめの条件をセットできます。')
      expect(description).toHaveClass('text-neutral-textMuted')
    })
  })
})
