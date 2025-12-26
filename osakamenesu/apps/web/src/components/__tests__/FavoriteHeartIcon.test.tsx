import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { FavoriteHeartIcon } from '../FavoriteHeartIcon'

describe('FavoriteHeartIcon', () => {
  describe('rendering', () => {
    it('renders svg element', () => {
      const { container } = render(<FavoriteHeartIcon filled={false} />)
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('has aria-hidden attribute', () => {
      const { container } = render(<FavoriteHeartIcon filled={false} />)
      expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    })

    it('contains path element', () => {
      const { container } = render(<FavoriteHeartIcon filled={false} />)
      expect(container.querySelector('path')).toBeInTheDocument()
    })
  })

  describe('filled state', () => {
    it('has fill none when not filled', () => {
      const { container } = render(<FavoriteHeartIcon filled={false} />)
      expect(container.querySelector('svg')).toHaveAttribute('fill', 'none')
    })

    it('has red fill when filled', () => {
      const { container } = render(<FavoriteHeartIcon filled={true} />)
      expect(container.querySelector('svg')).toHaveAttribute('fill', '#ef4444')
    })
  })

  describe('styling', () => {
    it('has default size classes', () => {
      const { container } = render(<FavoriteHeartIcon filled={false} />)
      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('h-5')
      expect(svg).toHaveClass('w-5')
    })

    it('applies custom className', () => {
      const { container } = render(
        <FavoriteHeartIcon filled={false} className="custom-class" />,
      )
      expect(container.querySelector('svg')).toHaveClass('custom-class')
    })

    it('merges custom className with default classes', () => {
      const { container } = render(
        <FavoriteHeartIcon filled={false} className="text-red-500" />,
      )
      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('h-5')
      expect(svg).toHaveClass('w-5')
      expect(svg).toHaveClass('text-red-500')
    })
  })

  describe('stroke attributes', () => {
    it('has stroke currentColor', () => {
      const { container } = render(<FavoriteHeartIcon filled={false} />)
      expect(container.querySelector('svg')).toHaveAttribute('stroke', 'currentColor')
    })

    it('has strokeWidth 1.8', () => {
      const { container } = render(<FavoriteHeartIcon filled={false} />)
      expect(container.querySelector('svg')).toHaveAttribute('stroke-width', '1.8')
    })
  })
})
