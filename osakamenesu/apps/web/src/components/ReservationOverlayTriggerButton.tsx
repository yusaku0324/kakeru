"use client"

import { forwardRef } from 'react'

import type { ReservationOverlayProps } from '@/components/ReservationOverlay'

import { openReservationOverlay } from './reservationOverlayBus'

type OverlayPayload = Omit<ReservationOverlayProps, 'onClose'>

type ReservationOverlayTriggerButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  overlay?: OverlayPayload
  payload?: OverlayPayload
  defaultStart?: string | null
  defaultDurationMinutes?: number | null
  hitOverride?: OverlayPayload['hit']
}

const ReservationOverlayTriggerButton = forwardRef<HTMLButtonElement, ReservationOverlayTriggerButtonProps>(
  ({ overlay: overlayProp, payload, defaultStart, defaultDurationMinutes, hitOverride, onClick, type, ...rest }, ref) => {
    const overlay = payload ?? overlayProp
    return (
    <button
      {...rest}
      ref={ref}
      type={type ?? 'button'}
      onClick={(event) => {
        if (onClick) onClick(event)
        if (event.defaultPrevented) return

        if (!overlay) {
          console.warn('[ReservationOverlayTriggerButton] overlay payload is missing')
          return
        }

        const payload: OverlayPayload = {
          ...overlay,
          hit: hitOverride ?? overlay.hit,
          defaultStart: defaultStart ?? overlay.defaultStart ?? null,
          defaultDurationMinutes:
            typeof defaultDurationMinutes === 'number' && Number.isFinite(defaultDurationMinutes)
              ? defaultDurationMinutes
              : overlay.defaultDurationMinutes ?? null,
        }

        openReservationOverlay(payload)
      }}
    />
    )
  },
)

ReservationOverlayTriggerButton.displayName = 'ReservationOverlayTriggerButton'

export default ReservationOverlayTriggerButton
