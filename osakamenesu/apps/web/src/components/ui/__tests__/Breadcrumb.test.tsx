import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Breadcrumb } from '../Breadcrumb'

describe('Breadcrumb', () => {
  it('renders navigation with proper aria-label', () => {
    render(<Breadcrumb items={[{ label: 'Home' }]} />)
    expect(screen.getByRole('navigation', { name: 'パンくずリスト' })).toBeInTheDocument()
  })

  it('renders single item correctly', () => {
    render(<Breadcrumb items={[{ label: 'Current Page' }]} />)
    expect(screen.getByText('Current Page')).toBeInTheDocument()
  })

  it('renders multiple items with separators', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Shop', href: '/shop' },
          { label: 'Current' },
        ]}
      />,
    )

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Shop')).toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()

    const separators = screen.getAllByText('/')
    expect(separators).toHaveLength(2)
  })

  it('renders links for items with href except last item', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Current', href: '/current' },
        ]}
      />,
    )

    const homeLink = screen.getByRole('link', { name: 'Home' })
    expect(homeLink).toHaveAttribute('href', '/')

    expect(screen.queryByRole('link', { name: 'Current' })).not.toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()
  })

  it('marks last item with aria-current="page"', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Current Page' },
        ]}
      />,
    )

    const currentItem = screen.getByText('Current Page')
    expect(currentItem).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark non-last items with aria-current', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Current Page' },
        ]}
      />,
    )

    const homeLink = screen.getByRole('link', { name: 'Home' })
    expect(homeLink).not.toHaveAttribute('aria-current')
  })

  it('applies custom className', () => {
    render(<Breadcrumb items={[{ label: 'Home' }]} className="custom-breadcrumb" />)
    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('custom-breadcrumb')
  })

  it('renders items without href as span', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'No Link' },
          { label: 'Current' },
        ]}
      />,
    )

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('No Link')).toBeInTheDocument()
  })

  it('applies font-medium to last item', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Last Item' },
        ]}
      />,
    )

    const lastItem = screen.getByText('Last Item')
    expect(lastItem).toHaveClass('font-medium')
  })
})
