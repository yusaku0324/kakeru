/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import SchemaMarkup from '../SchemaMarkup'

vi.mock('@/lib/seo/structured-data', () => ({
  serializeStructuredData: vi.fn((data) => JSON.stringify(data)),
}))

describe('SchemaMarkup', () => {
  it('renders nothing when data is null', () => {
    const { container } = render(<SchemaMarkup data={null} />)
    const scripts = container.querySelectorAll('script[type="application/ld+json"]')
    expect(scripts).toHaveLength(0)
  })

  it('renders nothing when data is undefined', () => {
    const { container } = render(<SchemaMarkup data={undefined} />)
    const scripts = container.querySelectorAll('script[type="application/ld+json"]')
    expect(scripts).toHaveLength(0)
  })

  it('renders single schema', () => {
    const data = { '@type': 'LocalBusiness', name: 'Test Shop' }
    const { container } = render(<SchemaMarkup data={data} />)
    const scripts = container.querySelectorAll('script[type="application/ld+json"]')
    expect(scripts).toHaveLength(1)

    const parsed = JSON.parse(scripts[0].innerHTML)
    expect(parsed['@type']).toBe('LocalBusiness')
    expect(parsed.name).toBe('Test Shop')
  })

  it('renders multiple schemas from array', () => {
    const data = [
      { '@type': 'LocalBusiness', name: 'Shop 1' },
      { '@type': 'BreadcrumbList', items: [] },
    ]
    const { container } = render(<SchemaMarkup data={data} />)
    const scripts = container.querySelectorAll('script[type="application/ld+json"]')
    expect(scripts).toHaveLength(2)
  })

  it('uses correct script type', () => {
    const data = { '@type': 'Test' }
    const { container } = render(<SchemaMarkup data={data} />)
    const script = container.querySelector('script')
    expect(script?.getAttribute('type')).toBe('application/ld+json')
  })

  it('renders empty array without errors', () => {
    const { container } = render(<SchemaMarkup data={[]} />)
    const scripts = container.querySelectorAll('script[type="application/ld+json"]')
    expect(scripts).toHaveLength(0)
  })

  it('handles complex nested data', () => {
    const data = {
      '@type': 'Organization',
      name: 'Test Org',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '123 Main St',
      },
      contactPoint: [
        { '@type': 'ContactPoint', telephone: '+1-234-567-8900' },
      ],
    }
    const { container } = render(<SchemaMarkup data={data} />)
    const script = container.querySelector('script[type="application/ld+json"]')
    const parsed = JSON.parse(script!.innerHTML)

    expect(parsed.address['@type']).toBe('PostalAddress')
    expect(parsed.contactPoint[0].telephone).toBe('+1-234-567-8900')
  })
})
