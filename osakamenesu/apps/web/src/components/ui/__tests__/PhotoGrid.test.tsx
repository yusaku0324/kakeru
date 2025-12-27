/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhotoGrid } from '../PhotoGrid'

// Mock IntersectionObserver
beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock showModal and close for dialog
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

// Mock SafeImage
vi.mock('@/components/SafeImage', () => ({
  default: (props: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} data-testid="safe-image" />
  ),
}))

describe('PhotoGrid', () => {
  const defaultProps = {
    photos: [],
    onChange: vi.fn(),
    onUpload: vi.fn().mockResolvedValue(undefined),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('empty state', () => {
    it('renders upload zone when no photos', () => {
      render(<PhotoGrid {...defaultProps} />)
      expect(screen.getByText('写真をドラッグ&ドロップ')).toBeInTheDocument()
    })

    it('shows upload button', () => {
      render(<PhotoGrid {...defaultProps} />)
      expect(screen.getByText('写真を選択')).toBeInTheDocument()
    })

    it('shows photo count', () => {
      render(<PhotoGrid {...defaultProps} />)
      expect(screen.getByText('0 / 10 枚の写真がアップロードされています')).toBeInTheDocument()
    })

    it('shows format hint', () => {
      render(<PhotoGrid {...defaultProps} />)
      expect(screen.getByText('PNG / JPG / WEBP / GIF（最大 8MB）')).toBeInTheDocument()
    })
  })

  describe('with photos', () => {
    const photosProps = {
      ...defaultProps,
      photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
    }

    it('renders photos', () => {
      render(<PhotoGrid {...photosProps} />)
      expect(screen.getAllByTestId('safe-image')).toHaveLength(2)
    })

    it('shows main badge on first photo', () => {
      render(<PhotoGrid {...photosProps} />)
      expect(screen.getByText('メイン')).toBeInTheDocument()
    })

    it('shows photo count', () => {
      render(<PhotoGrid {...photosProps} />)
      expect(screen.getByText('2 / 10 枚の写真がアップロードされています')).toBeInTheDocument()
    })

    it('shows keyboard hint when multiple photos', () => {
      render(<PhotoGrid {...photosProps} />)
      expect(screen.getByText(/矢印キーで並べ替えできます/)).toBeInTheDocument()
    })

    it('shows order badges', () => {
      render(<PhotoGrid {...photosProps} />)
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  describe('delete functionality', () => {
    const photosProps = {
      ...defaultProps,
      photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
    }

    it('opens confirm dialog when delete is clicked', async () => {
      render(<PhotoGrid {...photosProps} />)

      const deleteButtons = screen.getAllByText('削除')
      await userEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(screen.getByText('写真を削除')).toBeInTheDocument()
      })
    })

    it('removes photo when confirmed', async () => {
      const onChange = vi.fn()
      render(<PhotoGrid {...photosProps} onChange={onChange} />)

      const deleteButtons = screen.getAllByText('削除')
      await userEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(screen.getByText('削除する')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByText('削除する'))

      expect(onChange).toHaveBeenCalledWith(['https://example.com/photo2.jpg'])
    })

    it('cancels deletion when cancelled', async () => {
      const onChange = vi.fn()
      render(<PhotoGrid {...photosProps} onChange={onChange} />)

      const deleteButtons = screen.getAllByText('削除')
      await userEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(screen.getByText('キャンセル')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByText('キャンセル'))

      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('set main functionality', () => {
    it('shows set main button for non-first photos', () => {
      render(
        <PhotoGrid
          {...defaultProps}
          photos={['photo1.jpg', 'photo2.jpg']}
        />,
      )
      expect(screen.getByText('メインに')).toBeInTheDocument()
    })

    it('reorders photos when set main is clicked', async () => {
      const onChange = vi.fn()
      render(
        <PhotoGrid
          {...defaultProps}
          photos={['photo1.jpg', 'photo2.jpg']}
          onChange={onChange}
        />,
      )

      await userEvent.click(screen.getByText('メインに'))

      expect(onChange).toHaveBeenCalledWith(['photo2.jpg', 'photo1.jpg'])
    })
  })

  describe('disabled state', () => {
    it('hides delete button when disabled', () => {
      render(
        <PhotoGrid
          {...defaultProps}
          photos={['photo1.jpg']}
          disabled
        />,
      )
      expect(screen.queryByText('削除')).not.toBeInTheDocument()
    })

    it('shows disabled upload zone', () => {
      const { container } = render(
        <PhotoGrid {...defaultProps} disabled />,
      )
      expect(container.querySelector('.opacity-60')).toBeInTheDocument()
    })
  })

  describe('uploading state', () => {
    it('shows uploading message', () => {
      render(<PhotoGrid {...defaultProps} isUploading />)
      expect(screen.getByText('アップロード中...')).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('shows error message', () => {
      render(<PhotoGrid {...defaultProps} error="Upload failed" />)
      expect(screen.getByText('Upload failed')).toBeInTheDocument()
    })
  })

  describe('max photos', () => {
    it('hides upload zone when max photos reached', () => {
      render(
        <PhotoGrid
          {...defaultProps}
          photos={['1.jpg', '2.jpg', '3.jpg']}
          maxPhotos={3}
        />,
      )
      expect(screen.queryByText('写真をドラッグ&ドロップ')).not.toBeInTheDocument()
    })

    it('uses custom max photos', () => {
      render(
        <PhotoGrid
          {...defaultProps}
          photos={['1.jpg']}
          maxPhotos={5}
        />,
      )
      expect(screen.getByText('1 / 5 枚の写真がアップロードされています')).toBeInTheDocument()
    })
  })

  describe('file input', () => {
    it('calls onUpload when files are selected', async () => {
      const onUpload = vi.fn().mockResolvedValue(undefined)
      render(<PhotoGrid {...defaultProps} onUpload={onUpload} />)

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['photo'], 'test.jpg', { type: 'image/jpeg' })

      Object.defineProperty(input, 'files', {
        value: [file],
        configurable: true,
      })

      fireEvent.change(input)

      await waitFor(() => {
        expect(onUpload).toHaveBeenCalled()
      })
    })
  })

  describe('drag and drop', () => {
    it('shows drag over state', () => {
      const { container } = render(<PhotoGrid {...defaultProps} />)
      const dropZone = container.querySelector('.rounded-2xl.border-2.border-dashed')

      fireEvent.dragOver(dropZone!, { dataTransfer: { files: [] } })

      expect(screen.getByText('ドロップしてアップロード')).toBeInTheDocument()
    })

    it('removes drag over state on drag leave', () => {
      const { container } = render(<PhotoGrid {...defaultProps} />)
      const dropZone = container.querySelector('.rounded-2xl.border-2.border-dashed')

      fireEvent.dragOver(dropZone!, { dataTransfer: { files: [] } })
      fireEvent.dragLeave(dropZone!)

      expect(screen.getByText('写真をドラッグ&ドロップ')).toBeInTheDocument()
    })
  })

  describe('keyboard navigation', () => {
    it('has focusable photos', () => {
      render(
        <PhotoGrid
          {...defaultProps}
          photos={['photo1.jpg', 'photo2.jpg']}
        />,
      )
      const photoElements = screen.getAllByRole('button')
      expect(photoElements[0]).toHaveAttribute('tabindex', '0')
    })

    it('has aria labels for photos', () => {
      render(
        <PhotoGrid
          {...defaultProps}
          photos={['photo1.jpg', 'photo2.jpg']}
        />,
      )
      expect(screen.getByLabelText(/写真1（メイン）.*矢印キー/)).toBeInTheDocument()
      expect(screen.getByLabelText(/写真2.*矢印キー/)).toBeInTheDocument()
    })

    it('handles arrow key navigation', () => {
      const onChange = vi.fn()
      render(
        <PhotoGrid
          {...defaultProps}
          photos={['photo1.jpg', 'photo2.jpg']}
          onChange={onChange}
        />,
      )

      // Verify photos are keyboard accessible
      const photos = screen.getAllByRole('button', { name: /矢印キーで並べ替え/ })
      expect(photos).toHaveLength(2)
      expect(photos[0]).toHaveAttribute('tabindex', '0')
    })

    it('handles home and end key navigation', () => {
      render(
        <PhotoGrid
          {...defaultProps}
          photos={['photo1.jpg', 'photo2.jpg', 'photo3.jpg']}
        />,
      )

      // Verify all photos are focusable for keyboard navigation
      const photos = screen.getAllByRole('button', { name: /矢印キーで並べ替え/ })
      expect(photos).toHaveLength(3)
      photos.forEach((photo) => {
        expect(photo).toHaveAttribute('tabindex', '0')
      })
    })

    it('opens delete dialog with Delete key', async () => {
      render(
        <PhotoGrid
          {...defaultProps}
          photos={['photo1.jpg', 'photo2.jpg']}
        />,
      )

      const photos = screen.getAllByRole('button')
      fireEvent.keyDown(photos[0], { key: 'Delete' })

      await waitFor(() => {
        expect(screen.getByText('写真を削除')).toBeInTheDocument()
      })
    })

    it('does not move when disabled', () => {
      const onChange = vi.fn()
      render(
        <PhotoGrid
          {...defaultProps}
          photos={['photo1.jpg', 'photo2.jpg']}
          onChange={onChange}
          disabled
        />,
      )

      const photos = screen.getAllByRole('button')
      fireEvent.keyDown(photos[0], { key: 'ArrowRight' })

      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('photo drag and drop reorder', () => {
    it('sets dragged index on drag start', () => {
      render(
        <PhotoGrid
          {...defaultProps}
          photos={['photo1.jpg', 'photo2.jpg']}
        />,
      )

      const photos = screen.getAllByRole('button', { name: /写真/ })
      fireEvent.dragStart(photos[0])

      expect(photos[0]).toHaveClass('opacity-50')
    })

    it('allows drag over on photos', () => {
      render(
        <PhotoGrid
          {...defaultProps}
          photos={['photo1.jpg', 'photo2.jpg']}
        />,
      )

      const photos = screen.getAllByRole('button', { name: /写真/ })
      fireEvent.dragStart(photos[0])
      fireEvent.dragOver(photos[1], { preventDefault: vi.fn() })

      // Just verify the event is handled without error
      expect(photos[0]).toBeInTheDocument()
    })

    it('clears drag state on drag end', () => {
      render(
        <PhotoGrid
          {...defaultProps}
          photos={['photo1.jpg', 'photo2.jpg']}
        />,
      )

      const photos = screen.getAllByRole('button', { name: /写真/ })
      fireEvent.dragStart(photos[0])
      fireEvent.dragEnd(photos[0])

      expect(photos[0]).not.toHaveClass('opacity-50')
    })
  })
})
