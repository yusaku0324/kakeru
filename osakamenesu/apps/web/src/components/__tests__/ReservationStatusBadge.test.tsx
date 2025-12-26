import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReservationStatusBadge } from '../ReservationStatusBadge'

describe('ReservationStatusBadge', () => {
  describe('rendering', () => {
    it('renders status text', () => {
      render(<ReservationStatusBadge status="pending" />)
      expect(screen.getByText('pending')).toBeInTheDocument()
    })

    it('renders as span element', () => {
      render(<ReservationStatusBadge status="pending" />)
      expect(screen.getByText('pending').tagName).toBe('SPAN')
    })

    it('renders dash for empty status', () => {
      render(<ReservationStatusBadge status="" />)
      expect(screen.getByText('-')).toBeInTheDocument()
    })
  })

  describe('status styles', () => {
    it('applies pending styles', () => {
      render(<ReservationStatusBadge status="pending" />)
      const badge = screen.getByText('pending')
      expect(badge).toHaveClass('bg-amber-50')
      expect(badge).toHaveClass('text-amber-800')
    })

    it('applies confirmed styles', () => {
      render(<ReservationStatusBadge status="confirmed" />)
      const badge = screen.getByText('confirmed')
      expect(badge).toHaveClass('bg-emerald-50')
      expect(badge).toHaveClass('text-emerald-800')
    })

    it('applies cancelled styles', () => {
      render(<ReservationStatusBadge status="cancelled" />)
      const badge = screen.getByText('cancelled')
      expect(badge).toHaveClass('bg-slate-100')
      expect(badge).toHaveClass('text-slate-700')
    })

    it('applies default styles for unknown status', () => {
      render(<ReservationStatusBadge status="unknown" />)
      const badge = screen.getByText('unknown')
      expect(badge).toHaveClass('bg-slate-100')
      expect(badge).toHaveClass('text-slate-700')
    })

    it('handles case insensitive status', () => {
      render(<ReservationStatusBadge status="PENDING" />)
      const badge = screen.getByText('PENDING')
      expect(badge).toHaveClass('bg-amber-50')
    })
  })

  describe('sizes', () => {
    it('applies sm size by default', () => {
      render(<ReservationStatusBadge status="pending" />)
      const badge = screen.getByText('pending')
      expect(badge).toHaveClass('px-2')
      expect(badge).toHaveClass('py-0.5')
      expect(badge).toHaveClass('text-[11px]')
    })

    it('applies md size when specified', () => {
      render(<ReservationStatusBadge status="pending" size="md" />)
      const badge = screen.getByText('pending')
      expect(badge).toHaveClass('px-3')
      expect(badge).toHaveClass('py-1')
      expect(badge).toHaveClass('text-xs')
    })
  })

  describe('base styles', () => {
    it('has rounded-full class', () => {
      render(<ReservationStatusBadge status="pending" />)
      expect(screen.getByText('pending')).toHaveClass('rounded-full')
    })

    it('has font-semibold class', () => {
      render(<ReservationStatusBadge status="pending" />)
      expect(screen.getByText('pending')).toHaveClass('font-semibold')
    })
  })

  describe('custom className', () => {
    it('applies custom className', () => {
      render(<ReservationStatusBadge status="pending" className="custom-class" />)
      expect(screen.getByText('pending')).toHaveClass('custom-class')
    })
  })
})
