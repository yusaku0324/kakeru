import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from '../ConfirmDialog'

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    title: 'Confirm Action',
    message: 'Are you sure?',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock showModal and close methods for dialog
    HTMLDialogElement.prototype.showModal = vi.fn()
    HTMLDialogElement.prototype.close = vi.fn()
  })

  describe('rendering', () => {
    it('renders dialog when open', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} />)
      expect(container.querySelector('dialog')).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} open={false} />)
      expect(container.querySelector('dialog')).not.toBeInTheDocument()
    })

    it('renders title', () => {
      render(<ConfirmDialog {...defaultProps} />)
      expect(screen.getByText('Confirm Action')).toBeInTheDocument()
    })

    it('renders message', () => {
      render(<ConfirmDialog {...defaultProps} />)
      expect(screen.getByText('Are you sure?')).toBeInTheDocument()
    })

    it('renders default button labels', () => {
      render(<ConfirmDialog {...defaultProps} />)
      expect(screen.getByText('キャンセル')).toBeInTheDocument()
      expect(screen.getByText('確認')).toBeInTheDocument()
    })

    it('renders custom button labels', () => {
      render(
        <ConfirmDialog
          {...defaultProps}
          confirmLabel="Delete"
          cancelLabel="Go Back"
        />,
      )
      expect(screen.getByText('Go Back')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
  })

  describe('interaction', () => {
    it('calls onConfirm when confirm button is clicked', async () => {
      const onConfirm = vi.fn()
      render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />)

      await userEvent.click(screen.getByText('確認'))
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('calls onCancel when cancel button is clicked', async () => {
      const onCancel = vi.fn()
      render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)

      await userEvent.click(screen.getByText('キャンセル'))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('calls onCancel when Escape key is pressed', async () => {
      const onCancel = vi.fn()
      const { container } = render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)

      const dialog = container.querySelector('dialog')
      dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('variants', () => {
    it('applies default variant styling', () => {
      render(<ConfirmDialog {...defaultProps} />)
      const confirmButton = screen.getByText('確認').closest('button')
      expect(confirmButton).toHaveClass('bg-brand-primary')
    })

    it('applies danger variant styling', () => {
      render(<ConfirmDialog {...defaultProps} variant="danger" />)
      const confirmButton = screen.getByText('確認').closest('button')
      expect(confirmButton).toHaveClass('bg-red-600')
    })
  })

  describe('accessibility', () => {
    it('has aria-labelledby for title', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} />)
      const dialog = container.querySelector('dialog')
      const titleId = dialog?.getAttribute('aria-labelledby')
      expect(titleId).toBeTruthy()
      expect(document.getElementById(titleId!)).toHaveTextContent('Confirm Action')
    })

    it('has aria-describedby for message', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} />)
      const dialog = container.querySelector('dialog')
      const descId = dialog?.getAttribute('aria-describedby')
      expect(descId).toBeTruthy()
      expect(document.getElementById(descId!)).toHaveTextContent('Are you sure?')
    })

    it('has document role inside dialog', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} />)
      const docElement = container.querySelector('[role="document"]')
      expect(docElement).toBeInTheDocument()
    })
  })

  describe('showModal behavior', () => {
    it('calls showModal when opened', () => {
      const showModalMock = vi.fn()
      HTMLDialogElement.prototype.showModal = showModalMock

      render(<ConfirmDialog {...defaultProps} open={true} />)
      expect(showModalMock).toHaveBeenCalled()
    })
  })
})
