import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ReservationNotesPreferences from '../ReservationNotesPreferences'

describe('ReservationNotesPreferences', () => {
  const defaultProps = {
    notes: '',
    marketingOptIn: false,
    rememberProfile: false,
    onChange: vi.fn(),
    onToggleRemember: vi.fn(),
  }

  it('renders notes textarea with provided value', () => {
    render(<ReservationNotesPreferences {...defaultProps} notes="Test notes" />)
    const textarea = screen.getByPlaceholderText(/指名やオプションの希望などがあればご記入ください/)
    expect(textarea).toHaveValue('Test notes')
  })

  it('calls onChange when notes are updated', () => {
    const onChange = vi.fn()
    render(<ReservationNotesPreferences {...defaultProps} onChange={onChange} />)
    const textarea = screen.getByPlaceholderText(/指名やオプションの希望などがあればご記入ください/)
    fireEvent.change(textarea, { target: { value: 'New notes' } })
    expect(onChange).toHaveBeenCalledWith('notes', 'New notes')
  })

  it('renders rememberProfile checkbox with correct state', () => {
    render(<ReservationNotesPreferences {...defaultProps} rememberProfile={true} />)
    const checkbox = screen.getByLabelText(/次回のために連絡先情報を保存する/)
    expect(checkbox).toBeChecked()
  })

  it('calls onToggleRemember when rememberProfile is toggled', () => {
    const onToggleRemember = vi.fn()
    render(<ReservationNotesPreferences {...defaultProps} onToggleRemember={onToggleRemember} />)
    const checkbox = screen.getByLabelText(/次回のために連絡先情報を保存する/)
    fireEvent.click(checkbox)
    expect(onToggleRemember).toHaveBeenCalledWith(true)
  })

  it('renders marketingOptIn checkbox with correct state', () => {
    render(<ReservationNotesPreferences {...defaultProps} marketingOptIn={true} />)
    const checkbox = screen.getByLabelText(/お得な情報をメールで受け取る/)
    expect(checkbox).toBeChecked()
  })

  it('calls onChange when marketingOptIn is toggled', () => {
    const onChange = vi.fn()
    render(<ReservationNotesPreferences {...defaultProps} onChange={onChange} />)
    const checkbox = screen.getByLabelText(/お得な情報をメールで受け取る/)
    fireEvent.click(checkbox)
    expect(onChange).toHaveBeenCalledWith('marketingOptIn', true)
  })

  it('renders all form labels', () => {
    render(<ReservationNotesPreferences {...defaultProps} />)
    expect(screen.getByText('ご要望・指名など')).toBeInTheDocument()
    expect(screen.getByText('任意')).toBeInTheDocument()
    expect(screen.getByText(/次回のために連絡先情報を保存する/)).toBeInTheDocument()
    expect(screen.getByText(/お得な情報をメールで受け取る/)).toBeInTheDocument()
  })

  it('unchecks rememberProfile when already checked', () => {
    const onToggleRemember = vi.fn()
    render(
      <ReservationNotesPreferences
        {...defaultProps}
        rememberProfile={true}
        onToggleRemember={onToggleRemember}
      />,
    )
    const checkbox = screen.getByLabelText(/次回のために連絡先情報を保存する/)
    fireEvent.click(checkbox)
    expect(onToggleRemember).toHaveBeenCalledWith(false)
  })

  it('unchecks marketingOptIn when already checked', () => {
    const onChange = vi.fn()
    render(<ReservationNotesPreferences {...defaultProps} marketingOptIn={true} onChange={onChange} />)
    const checkbox = screen.getByLabelText(/お得な情報をメールで受け取る/)
    fireEvent.click(checkbox)
    expect(onChange).toHaveBeenCalledWith('marketingOptIn', false)
  })
})
