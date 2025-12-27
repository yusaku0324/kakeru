/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShopPhotosSection } from '../ShopPhotosSection'

describe('ShopPhotosSection', () => {
  const defaultProps = {
    photos: ['https://example.com/photo1.jpg'],
    onUpdatePhoto: vi.fn(),
    onAddPhoto: vi.fn(),
    onRemovePhoto: vi.fn(),
  }

  it('renders section header', () => {
    render(<ShopPhotosSection {...defaultProps} />)

    expect(screen.getByText('掲載写真URL')).toBeInTheDocument()
  })

  it('renders add button', () => {
    render(<ShopPhotosSection {...defaultProps} />)

    expect(screen.getByRole('button', { name: '行を追加' })).toBeInTheDocument()
  })

  it('calls onAddPhoto when add button is clicked', async () => {
    const user = userEvent.setup()
    const onAddPhoto = vi.fn()

    render(<ShopPhotosSection {...defaultProps} onAddPhoto={onAddPhoto} />)

    await user.click(screen.getByRole('button', { name: '行を追加' }))
    expect(onAddPhoto).toHaveBeenCalledTimes(1)
  })

  it('renders photo inputs', () => {
    const photos = [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
    ]

    render(<ShopPhotosSection {...defaultProps} photos={photos} />)

    const inputs = screen.getAllByTestId('shop-photo-input')
    expect(inputs).toHaveLength(2)
    expect(inputs[0]).toHaveValue('https://example.com/photo1.jpg')
    expect(inputs[1]).toHaveValue('https://example.com/photo2.jpg')
  })

  it('calls onUpdatePhoto when input value changes', async () => {
    const user = userEvent.setup()
    const onUpdatePhoto = vi.fn()

    render(<ShopPhotosSection {...defaultProps} onUpdatePhoto={onUpdatePhoto} />)

    const input = screen.getByTestId('shop-photo-input')
    await user.clear(input)
    await user.type(input, 'https://new-url.com/photo.jpg')

    expect(onUpdatePhoto).toHaveBeenCalled()
  })

  it('renders delete buttons for each photo', () => {
    const photos = [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
    ]

    render(<ShopPhotosSection {...defaultProps} photos={photos} />)

    const deleteButtons = screen.getAllByRole('button', { name: /を削除$/ })
    expect(deleteButtons).toHaveLength(2)
  })

  it('calls onRemovePhoto when delete button is clicked', async () => {
    const user = userEvent.setup()
    const onRemovePhoto = vi.fn()
    const photos = [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
    ]

    render(<ShopPhotosSection {...defaultProps} photos={photos} onRemovePhoto={onRemovePhoto} />)

    const deleteButtons = screen.getAllByRole('button', { name: /を削除$/ })
    await user.click(deleteButtons[1])

    expect(onRemovePhoto).toHaveBeenCalledWith(1)
  })

  it('disables delete button when only one photo exists', () => {
    const photos = ['https://example.com/photo1.jpg']

    render(<ShopPhotosSection {...defaultProps} photos={photos} />)

    const deleteButton = screen.getByRole('button', { name: /を削除$/ })
    expect(deleteButton).toBeDisabled()
  })

  it('enables delete buttons when multiple photos exist', () => {
    const photos = [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
    ]

    render(<ShopPhotosSection {...defaultProps} photos={photos} />)

    const deleteButtons = screen.getAllByRole('button', { name: /を削除$/ })
    deleteButtons.forEach(button => {
      expect(button).not.toBeDisabled()
    })
  })

  it('shows help text', () => {
    render(<ShopPhotosSection {...defaultProps} />)

    expect(screen.getByText(/公開ページに表示する画像のURLを/)).toBeInTheDocument()
  })

  it('has correct aria labels for inputs', () => {
    const photos = [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
    ]

    render(<ShopPhotosSection {...defaultProps} photos={photos} />)

    expect(screen.getByLabelText('写真URL 1')).toBeInTheDocument()
    expect(screen.getByLabelText('写真URL 2')).toBeInTheDocument()
  })

  it('has correct aria labels for delete buttons', () => {
    const photos = [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
    ]

    render(<ShopPhotosSection {...defaultProps} photos={photos} />)

    expect(screen.getByRole('button', { name: '写真URL 1を削除' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '写真URL 2を削除' })).toBeInTheDocument()
  })

  it('shows placeholder in input', () => {
    render(<ShopPhotosSection {...defaultProps} />)

    const input = screen.getByTestId('shop-photo-input')
    expect(input).toHaveAttribute('placeholder', 'https://example.com/photo.jpg')
  })
})
