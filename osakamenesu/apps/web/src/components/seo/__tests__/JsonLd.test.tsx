/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LocalBusinessJsonLd, BreadcrumbJsonLd, FAQJsonLd } from '../JsonLd'

describe('LocalBusinessJsonLd', () => {
  it('renders basic JSON-LD with name', () => {
    const { container } = render(<LocalBusinessJsonLd name="Test Shop" />)
    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).toBeInTheDocument()

    const data = JSON.parse(script!.innerHTML)
    expect(data['@context']).toBe('https://schema.org')
    expect(data['@type']).toBe('HealthAndBeautyBusiness')
    expect(data.name).toBe('Test Shop')
  })

  it('includes description when provided', () => {
    const { container } = render(
      <LocalBusinessJsonLd name="Test Shop" description="A great shop" />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.description).toBe('A great shop')
  })

  it('excludes description when null', () => {
    const { container } = render(
      <LocalBusinessJsonLd name="Test Shop" description={null} />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.description).toBeUndefined()
  })

  it('includes url when provided', () => {
    const { container } = render(
      <LocalBusinessJsonLd name="Test Shop" url="https://example.com" />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.url).toBe('https://example.com')
  })

  it('handles single image', () => {
    const { container } = render(
      <LocalBusinessJsonLd name="Test Shop" image="https://example.com/img.jpg" />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.image).toEqual(['https://example.com/img.jpg'])
  })

  it('handles array of images', () => {
    const images = ['https://example.com/1.jpg', 'https://example.com/2.jpg']
    const { container } = render(
      <LocalBusinessJsonLd name="Test Shop" image={images} />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.image).toEqual(images)
  })

  it('includes telephone when provided', () => {
    const { container } = render(
      <LocalBusinessJsonLd name="Test Shop" telephone="03-1234-5678" />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.telephone).toBe('03-1234-5678')
  })

  it('includes priceRange when provided', () => {
    const { container } = render(
      <LocalBusinessJsonLd name="Test Shop" priceRange="$$" />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.priceRange).toBe('$$')
  })

  it('includes address with PostalAddress type', () => {
    const { container } = render(
      <LocalBusinessJsonLd
        name="Test Shop"
        address="1-2-3 Shibuya"
        areaServed="渋谷区"
      />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: '渋谷区',
      streetAddress: '1-2-3 Shibuya',
      addressCountry: 'JP',
    })
  })

  it('uses default areaServed for address when not provided', () => {
    const { container } = render(
      <LocalBusinessJsonLd name="Test Shop" address="1-2-3 Test" />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.address.addressLocality).toBe('大阪府')
  })

  it('includes areaServed as City type', () => {
    const { container } = render(
      <LocalBusinessJsonLd name="Test Shop" areaServed="新宿区" />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.areaServed).toEqual({
      '@type': 'City',
      name: '新宿区',
    })
  })

  it('parses opening hours with colon format', () => {
    const { container } = render(
      <LocalBusinessJsonLd name="Test Shop" openingHours="10:00-22:00" />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.openingHours).toBe('Mo-Su 10:00-22:00')
  })

  it('parses opening hours with Japanese format', () => {
    const { container } = render(
      <LocalBusinessJsonLd name="Test Shop" openingHours="10時-22時" />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.openingHours).toBe('Mo-Su 10:00-22:00')
  })

  it('parses opening hours with tilde separator', () => {
    const { container } = render(
      <LocalBusinessJsonLd name="Test Shop" openingHours="9:00~21:00" />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.openingHours).toBe('Mo-Su 09:00-21:00')
  })

  it('does not include openingHours when format is not recognized', () => {
    const { container } = render(
      <LocalBusinessJsonLd name="Test Shop" openingHours="Always Open" />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.openingHours).toBeUndefined()
  })

  it('includes aggregateRating when valid', () => {
    const { container } = render(
      <LocalBusinessJsonLd
        name="Test Shop"
        aggregateRating={{ ratingValue: 4.5, reviewCount: 100 }}
      />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: '4.5',
      reviewCount: 100,
      bestRating: '5',
      worstRating: '1',
    })
  })

  it('excludes aggregateRating when ratingValue is 0', () => {
    const { container } = render(
      <LocalBusinessJsonLd
        name="Test Shop"
        aggregateRating={{ ratingValue: 0, reviewCount: 0 }}
      />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.aggregateRating).toBeUndefined()
  })

  it('excludes aggregateRating when reviewCount is 0', () => {
    const { container } = render(
      <LocalBusinessJsonLd
        name="Test Shop"
        aggregateRating={{ ratingValue: 4.5, reviewCount: 0 }}
      />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.aggregateRating).toBeUndefined()
  })

  it('excludes aggregateRating when null', () => {
    const { container } = render(
      <LocalBusinessJsonLd name="Test Shop" aggregateRating={null} />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)
    expect(data.aggregateRating).toBeUndefined()
  })
})

describe('BreadcrumbJsonLd', () => {
  it('renders breadcrumb list JSON-LD', () => {
    const items = [
      { name: 'Home', url: 'https://example.com' },
      { name: 'Category', url: 'https://example.com/category' },
      { name: 'Item' },
    ]
    const { container } = render(<BreadcrumbJsonLd items={items} />)
    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).toBeInTheDocument()

    const data = JSON.parse(script!.innerHTML)
    expect(data['@context']).toBe('https://schema.org')
    expect(data['@type']).toBe('BreadcrumbList')
  })

  it('includes correct positions', () => {
    const items = [{ name: 'Home' }, { name: 'Page' }]
    const { container } = render(<BreadcrumbJsonLd items={items} />)
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)

    expect(data.itemListElement[0].position).toBe(1)
    expect(data.itemListElement[1].position).toBe(2)
  })

  it('includes item URL when provided', () => {
    const items = [{ name: 'Home', url: 'https://example.com' }]
    const { container } = render(<BreadcrumbJsonLd items={items} />)
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)

    expect(data.itemListElement[0].item).toBe('https://example.com')
  })

  it('excludes item URL when not provided', () => {
    const items = [{ name: 'Home' }]
    const { container } = render(<BreadcrumbJsonLd items={items} />)
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)

    expect(data.itemListElement[0].item).toBeUndefined()
  })

  it('handles empty items array', () => {
    const { container } = render(<BreadcrumbJsonLd items={[]} />)
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)

    expect(data.itemListElement).toEqual([])
  })
})

describe('FAQJsonLd', () => {
  it('renders FAQ page JSON-LD', () => {
    const items = [
      { question: 'What is this?', answer: 'This is a test.' },
    ]
    const { container } = render(<FAQJsonLd items={items} />)
    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).toBeInTheDocument()

    const data = JSON.parse(script!.innerHTML)
    expect(data['@context']).toBe('https://schema.org')
    expect(data['@type']).toBe('FAQPage')
  })

  it('renders nothing when items is empty', () => {
    const { container } = render(<FAQJsonLd items={[]} />)
    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeInTheDocument()
  })

  it('includes Question and Answer types', () => {
    const items = [
      { question: 'Q1?', answer: 'A1' },
      { question: 'Q2?', answer: 'A2' },
    ]
    const { container } = render(<FAQJsonLd items={items} />)
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)

    expect(data.mainEntity).toHaveLength(2)
    expect(data.mainEntity[0]['@type']).toBe('Question')
    expect(data.mainEntity[0].name).toBe('Q1?')
    expect(data.mainEntity[0].acceptedAnswer['@type']).toBe('Answer')
    expect(data.mainEntity[0].acceptedAnswer.text).toBe('A1')
  })

  it('handles multiple FAQ items', () => {
    const items = [
      { question: 'Question 1', answer: 'Answer 1' },
      { question: 'Question 2', answer: 'Answer 2' },
      { question: 'Question 3', answer: 'Answer 3' },
    ]
    const { container } = render(<FAQJsonLd items={items} />)
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.innerHTML)

    expect(data.mainEntity).toHaveLength(3)
    expect(data.mainEntity[2].name).toBe('Question 3')
    expect(data.mainEntity[2].acceptedAnswer.text).toBe('Answer 3')
  })
})
