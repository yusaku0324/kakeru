import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Alert, ErrorAlert } from '../Alert'

describe('Alert', () => {
  it('renders children correctly', () => {
    render(<Alert>Test message</Alert>)
    expect(screen.getByText('Test message')).toBeInTheDocument()
  })

  it('renders title when provided', () => {
    render(<Alert title="Alert Title">Message</Alert>)
    expect(screen.getByText('Alert Title')).toBeInTheDocument()
    expect(screen.getByText('Message')).toBeInTheDocument()
  })

  it('has role="alert"', () => {
    render(<Alert>Accessible alert</Alert>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('applies info variant by default', () => {
    render(<Alert>Default alert</Alert>)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveClass('border-blue-200')
  })

  it('applies error variant styles', () => {
    render(<Alert variant="error">Error alert</Alert>)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveClass('border-red-200')
  })

  it('applies warning variant styles', () => {
    render(<Alert variant="warning">Warning alert</Alert>)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveClass('border-amber-200')
  })

  it('applies success variant styles', () => {
    render(<Alert variant="success">Success alert</Alert>)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveClass('border-green-200')
  })

  it('shows dismiss button when onDismiss is provided', () => {
    const onDismiss = vi.fn()
    render(<Alert onDismiss={onDismiss}>Dismissible alert</Alert>)
    expect(screen.getByLabelText('閉じる')).toBeInTheDocument()
  })

  it('does not show dismiss button when onDismiss is not provided', () => {
    render(<Alert>Non-dismissible alert</Alert>)
    expect(screen.queryByLabelText('閉じる')).not.toBeInTheDocument()
  })

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    render(<Alert onDismiss={onDismiss}>Dismissible alert</Alert>)

    fireEvent.click(screen.getByLabelText('閉じる'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('applies custom className', () => {
    render(<Alert className="custom-alert">Custom styled</Alert>)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveClass('custom-alert')
  })
})

describe('ErrorAlert', () => {
  it('renders error message', () => {
    render(<ErrorAlert message="Something went wrong" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('has role="alert"', () => {
    render(<ErrorAlert message="Error" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows retry button when onRetry is provided', () => {
    const onRetry = vi.fn()
    render(<ErrorAlert message="Error" onRetry={onRetry} />)
    expect(screen.getByText('再試行')).toBeInTheDocument()
  })

  it('does not show retry button when onRetry is not provided', () => {
    render(<ErrorAlert message="Error" />)
    expect(screen.queryByText('再試行')).not.toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn()
    render(<ErrorAlert message="Error" onRetry={onRetry} />)

    fireEvent.click(screen.getByText('再試行'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('applies custom className', () => {
    render(<ErrorAlert message="Error" className="custom-error" />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveClass('custom-error')
  })
})
