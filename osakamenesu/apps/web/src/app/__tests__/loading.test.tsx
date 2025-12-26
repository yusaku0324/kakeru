/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Loading from '../loading'

describe('Loading', () => {
  it('renders loading skeleton', () => {
    render(<Loading />)

    const status = screen.getByRole('status')
    expect(status).toBeInTheDocument()
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveAttribute('aria-label', 'Loading')
  })

  it('renders multiple skeleton elements', () => {
    const { container } = render(<Loading />)

    // Should have skeleton elements with rounded-full class
    const skeletons = container.querySelectorAll('.rounded-full')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders card skeletons', () => {
    const { container } = render(<Loading />)

    // Should have card skeleton elements
    const cards = container.querySelectorAll('.rounded-2xl')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('renders section skeletons', () => {
    const { container } = render(<Loading />)

    // Should have section elements
    const sections = container.querySelectorAll('section')
    expect(sections.length).toBeGreaterThan(0)
  })

  it('renders header skeleton', () => {
    const { container } = render(<Loading />)

    const header = container.querySelector('header')
    expect(header).toBeInTheDocument()
  })

  it('renders navigation skeleton', () => {
    const { container } = render(<Loading />)

    const nav = container.querySelector('nav')
    expect(nav).toBeInTheDocument()
  })
})
