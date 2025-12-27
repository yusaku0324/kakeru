import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import ReservationOverlayTriggerButton from '../ReservationOverlayTriggerButton'
import * as overlayBus from '../reservationOverlayBus'
import type { TherapistHit } from '@/components/staff/TherapistCard'

vi.mock('../reservationOverlayBus', () => ({
  openReservationOverlay: vi.fn(),
}))

const mockOpenReservationOverlay = vi.mocked(overlayBus.openReservationOverlay)

const sampleHit: TherapistHit = {
  id: 'hit-1',
  therapistId: 'therapist-1',
  staffId: 'staff-1',
  name: 'テストセラピスト',
  alias: null,
  headline: 'テストヘッドライン',
  specialties: ['アロマ', 'オイル'],
  avatarUrl: null,
  rating: 4.5,
  reviewCount: 10,
  shopId: 'shop-1',
  shopSlug: 'test-shop',
  shopName: 'テストショップ',
  shopArea: '難波',
  shopAreaName: '難波エリア',
  todayAvailable: true,
  nextAvailableSlot: null,
}

const sampleOverlay = {
  hit: sampleHit,
}

describe('ReservationOverlayTriggerButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders button with children', () => {
    render(
      <ReservationOverlayTriggerButton overlay={sampleOverlay}>
        予約する
      </ReservationOverlayTriggerButton>,
    )
    expect(screen.getByRole('button', { name: '予約する' })).toBeInTheDocument()
  })

  it('defaults to type="button"', () => {
    render(
      <ReservationOverlayTriggerButton overlay={sampleOverlay}>
        予約
      </ReservationOverlayTriggerButton>,
    )
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('allows type override', () => {
    render(
      <ReservationOverlayTriggerButton overlay={sampleOverlay} type="submit">
        送信
      </ReservationOverlayTriggerButton>,
    )
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('opens overlay on click', () => {
    render(
      <ReservationOverlayTriggerButton overlay={sampleOverlay}>
        予約
      </ReservationOverlayTriggerButton>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(mockOpenReservationOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        hit: expect.objectContaining({ shopId: 'shop-1' }),
      }),
    )
  })

  it('accepts payload prop as alternative to overlay', () => {
    render(
      <ReservationOverlayTriggerButton payload={sampleOverlay}>
        予約
      </ReservationOverlayTriggerButton>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(mockOpenReservationOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        hit: expect.objectContaining({ shopId: 'shop-1' }),
      }),
    )
  })

  it('prefers payload over overlay prop', () => {
    const preferredHit: TherapistHit = { ...sampleHit, shopId: 'preferred-shop' }
    const payloadOverlay = { hit: preferredHit }
    render(
      <ReservationOverlayTriggerButton
        overlay={sampleOverlay}
        payload={payloadOverlay}
      >
        予約
      </ReservationOverlayTriggerButton>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(mockOpenReservationOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        hit: expect.objectContaining({ shopId: 'preferred-shop' }),
      }),
    )
  })

  it('warns and does not open overlay when no payload', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <ReservationOverlayTriggerButton>予約</ReservationOverlayTriggerButton>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(mockOpenReservationOverlay).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      '[ReservationOverlayTriggerButton] overlay payload is missing',
    )
    warnSpy.mockRestore()
  })

  it('calls onClick handler', () => {
    const handleClick = vi.fn()
    render(
      <ReservationOverlayTriggerButton overlay={sampleOverlay} onClick={handleClick}>
        予約
      </ReservationOverlayTriggerButton>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalled()
    expect(mockOpenReservationOverlay).toHaveBeenCalled()
  })

  it('does not open overlay if onClick prevents default', () => {
    const handleClick = vi.fn((e: React.MouseEvent) => e.preventDefault())
    render(
      <ReservationOverlayTriggerButton overlay={sampleOverlay} onClick={handleClick}>
        予約
      </ReservationOverlayTriggerButton>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalled()
    expect(mockOpenReservationOverlay).not.toHaveBeenCalled()
  })

  it('applies hitOverride when provided', () => {
    const overrideHit = { ...sampleOverlay.hit, id: 'override-hit' }
    render(
      <ReservationOverlayTriggerButton overlay={sampleOverlay} hitOverride={overrideHit}>
        予約
      </ReservationOverlayTriggerButton>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(mockOpenReservationOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        hit: expect.objectContaining({ id: 'override-hit' }),
      }),
    )
  })

  it('applies defaultStart when provided', () => {
    render(
      <ReservationOverlayTriggerButton
        overlay={sampleOverlay}
        defaultStart="2024-01-01T10:00:00+09:00"
      >
        予約
      </ReservationOverlayTriggerButton>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(mockOpenReservationOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultStart: '2024-01-01T10:00:00+09:00',
      }),
    )
  })

  it('applies defaultDurationMinutes when provided', () => {
    render(
      <ReservationOverlayTriggerButton
        overlay={sampleOverlay}
        defaultDurationMinutes={60}
      >
        予約
      </ReservationOverlayTriggerButton>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(mockOpenReservationOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultDurationMinutes: 60,
      }),
    )
  })

  it('ignores non-finite defaultDurationMinutes', () => {
    render(
      <ReservationOverlayTriggerButton
        overlay={sampleOverlay}
        defaultDurationMinutes={NaN}
      >
        予約
      </ReservationOverlayTriggerButton>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(mockOpenReservationOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultDurationMinutes: null,
      }),
    )
  })

  it('uses overlay defaultDurationMinutes when prop is not provided', () => {
    const overlayWithDuration = {
      ...sampleOverlay,
      defaultDurationMinutes: 90,
    }
    render(
      <ReservationOverlayTriggerButton overlay={overlayWithDuration}>
        予約
      </ReservationOverlayTriggerButton>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(mockOpenReservationOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultDurationMinutes: 90,
      }),
    )
  })

  it('passes through additional button props', () => {
    render(
      <ReservationOverlayTriggerButton
        overlay={sampleOverlay}
        className="custom-class"
        data-testid="custom-button"
        disabled
      >
        予約
      </ReservationOverlayTriggerButton>,
    )
    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
    expect(button).toHaveAttribute('data-testid', 'custom-button')
    expect(button).toBeDisabled()
  })
})
