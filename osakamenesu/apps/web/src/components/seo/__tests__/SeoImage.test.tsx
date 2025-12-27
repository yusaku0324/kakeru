/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock IntersectionObserver before any imports
beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
})

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: (props: {
    src: string
    alt: string
    title?: string
    width?: number
    height?: number
    priority?: boolean
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={props.src}
      alt={props.alt}
      title={props.title}
      width={props.width}
      height={props.height}
      data-priority={props.priority}
    />
  ),
}))

// Mock OptimizedImage component
vi.mock('@/components/ui/optimized-image', () => ({
  OptimizedImage: (props: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} data-optimized="true" />
  ),
}))

import SeoImage, { generateImageObject } from '../SeoImage'

describe('SeoImage', () => {
  it('renders with required props', () => {
    render(<SeoImage src="https://example.com/image.jpg" alt="Test image" />)
    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()
  })

  it('uses OptimizedImage for lazy loading by default', () => {
    render(<SeoImage src="https://example.com/image.jpg" alt="Test image" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('data-optimized', 'true')
  })

  it('uses Next.js Image for priority images', () => {
    render(
      <SeoImage
        src="https://example.com/image.jpg"
        alt="Test image"
        priority={true}
      />
    )
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('data-priority', 'true')
  })

  it('uses Next.js Image when useLazyLoading is false', () => {
    render(
      <SeoImage
        src="https://example.com/image.jpg"
        alt="Test image"
        useLazyLoading={false}
      />
    )
    const img = screen.getByRole('img')
    expect(img).not.toHaveAttribute('data-optimized')
  })

  it('optimizes alt text by removing file extension', () => {
    render(<SeoImage src="test.jpg" alt="my_image.jpg" priority />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('alt', 'My Image')
  })

  it('optimizes alt text by replacing underscores with spaces', () => {
    render(<SeoImage src="test.jpg" alt="beautiful_sunset_photo" priority />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('alt', 'Beautiful Sunset Photo')
  })

  it('capitalizes first letter of each word in alt text', () => {
    render(<SeoImage src="test.jpg" alt="hello world" priority />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('alt', 'Hello World')
  })

  it('truncates long alt text', () => {
    const longAlt = 'a'.repeat(150)
    render(<SeoImage src="test.jpg" alt={longAlt} priority />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('alt')?.length).toBeLessThanOrEqual(125)
    expect(img.getAttribute('alt')?.endsWith('...')).toBe(true)
  })

  it('uses alt text as title when title not provided', () => {
    render(<SeoImage src="test.jpg" alt="My Image" priority />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('title', 'My Image')
  })

  it('uses provided title', () => {
    render(<SeoImage src="test.jpg" alt="My Image" title="Custom Title" priority />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('title', 'Custom Title')
  })

  it('handles empty alt text', () => {
    const { container } = render(<SeoImage src="test.jpg" alt="" priority />)
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('alt', '')
  })

  it('uses default width and height for priority images', () => {
    render(<SeoImage src="test.jpg" alt="Test" priority />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('width', '800')
    expect(img).toHaveAttribute('height', '600')
  })

  it('uses provided width and height', () => {
    render(<SeoImage src="test.jpg" alt="Test" width={400} height={300} priority />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('width', '400')
    expect(img).toHaveAttribute('height', '300')
  })
})

describe('generateImageObject', () => {
  it('returns ImageObject with required fields', () => {
    const result = generateImageObject({
      url: 'https://example.com/image.jpg',
      alt: 'Test image',
    })
    expect(result['@type']).toBe('ImageObject')
    expect(result.url).toBe('https://example.com/image.jpg')
    expect(result.caption).toBe('Test image')
  })

  it('includes optional width and height', () => {
    const result = generateImageObject({
      url: 'https://example.com/image.jpg',
      alt: 'Test',
      width: 800,
      height: 600,
    })
    expect(result.width).toBe(800)
    expect(result.height).toBe(600)
  })

  it('uses caption when provided', () => {
    const result = generateImageObject({
      url: 'https://example.com/image.jpg',
      alt: 'Alt text',
      caption: 'Custom caption',
    })
    expect(result.caption).toBe('Custom caption')
  })

  it('falls back to alt when no caption', () => {
    const result = generateImageObject({
      url: 'https://example.com/image.jpg',
      alt: 'Fallback alt',
    })
    expect(result.caption).toBe('Fallback alt')
  })
})
