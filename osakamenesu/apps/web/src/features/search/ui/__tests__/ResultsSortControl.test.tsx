/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResultsSortControl } from '../ResultsSortControl'

// Mock Next.js navigation
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => '/search',
  useSearchParams: () => new URLSearchParams(),
}))

describe('ResultsSortControl', () => {
  const defaultOptions = [
    { value: 'recommended', label: 'おすすめ順' },
    { value: 'price_asc', label: '価格が安い順' },
    { value: 'price_desc', label: '価格が高い順' },
    { value: 'rating', label: '評価が高い順' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders label text', () => {
      render(<ResultsSortControl options={defaultOptions} />)
      expect(screen.getByText('並び替え')).toBeInTheDocument()
    })

    it('renders select element', () => {
      render(<ResultsSortControl options={defaultOptions} />)
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('renders all options', () => {
      render(<ResultsSortControl options={defaultOptions} />)
      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(4)
    })

    it('renders option labels', () => {
      render(<ResultsSortControl options={defaultOptions} />)
      expect(screen.getByText('おすすめ順')).toBeInTheDocument()
      expect(screen.getByText('価格が安い順')).toBeInTheDocument()
      expect(screen.getByText('価格が高い順')).toBeInTheDocument()
      expect(screen.getByText('評価が高い順')).toBeInTheDocument()
    })
  })

  describe('default value', () => {
    it('defaults to recommended', () => {
      render(<ResultsSortControl options={defaultOptions} />)
      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select.value).toBe('recommended')
    })

    it('uses provided currentSort', () => {
      render(<ResultsSortControl options={defaultOptions} currentSort="price_asc" />)
      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select.value).toBe('price_asc')
    })
  })

  describe('interaction', () => {
    it('calls router.replace when option is selected', () => {
      render(<ResultsSortControl options={defaultOptions} />)

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 'price_asc' } })

      expect(mockReplace).toHaveBeenCalled()
    })

    it('includes sort param in URL when not recommended', () => {
      render(<ResultsSortControl options={defaultOptions} />)

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 'price_asc' } })

      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining('sort=price_asc'),
        expect.any(Object),
      )
    })

    it('removes sort param when recommended is selected', () => {
      render(<ResultsSortControl options={defaultOptions} currentSort="price_asc" />)

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 'recommended' } })

      expect(mockReplace).toHaveBeenCalledWith(
        expect.not.stringContaining('sort='),
        expect.any(Object),
      )
    })

    it('includes hash target in URL', () => {
      render(<ResultsSortControl options={defaultOptions} hashTarget="results" />)

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 'price_asc' } })

      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining('#results'),
        expect.any(Object),
      )
    })

    it('uses default hash target when not provided', () => {
      render(<ResultsSortControl options={defaultOptions} />)

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 'price_asc' } })

      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining('#search-results'),
        expect.any(Object),
      )
    })
  })

  describe('styling', () => {
    it('applies select styling', () => {
      render(<ResultsSortControl options={defaultOptions} />)
      const select = screen.getByRole('combobox')
      expect(select).toHaveClass('rounded-full')
      expect(select).toHaveClass('border')
    })
  })

  describe('with empty options', () => {
    it('renders empty select', () => {
      render(<ResultsSortControl options={[]} />)
      const options = screen.queryAllByRole('option')
      expect(options).toHaveLength(0)
    })
  })
})
