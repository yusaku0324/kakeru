'use client'

import { useMemo } from 'react'

import type { ReservationContactItem } from '@/components/reservation'
import {
  buildLineContactUrl,
  buildReservationContactItems,
} from '@/components/reservationOverlay/utils'

type Props = {
  tel?: string | null
  lineId?: string | null
  reservationId?: string | null
  shopName?: string | null
  lastPayload?: {
    desiredStart?: string
    duration?: number
    notes?: string
  } | null
}

export default function ReservationContactBar({
  tel,
  lineId,
  reservationId,
  shopName,
  lastPayload,
}: Props) {
  const lineUrl = useMemo(() => {
    if (!lineId) return null
    if (!lastPayload && !reservationId)
      return buildLineContactUrl(lineId, shopName ? `${shopName}の件で` : null)
    const parts: string[] = []
    if (shopName) parts.push(`${shopName}の件で`)
    if (lastPayload?.desiredStart) {
      try {
        const date = new Date(lastPayload.desiredStart)
        if (!Number.isNaN(date.getTime())) {
          parts.push(`${date.toLocaleString('ja-JP')} 希望`)
        }
      } catch {}
    }
    if (lastPayload?.duration) {
      parts.push(`利用時間 ${lastPayload.duration}分`)
    }
    if (reservationId) {
      parts.push(`予約ID: ${reservationId}`)
    }
    if (lastPayload?.notes) {
      parts.push(`メモ: ${lastPayload.notes}`)
    }
    const message = parts.length ? parts.join(' / ') : null
    return buildLineContactUrl(lineId, message)
  }, [lineId, reservationId, shopName, lastPayload])

  const telUrl = useMemo(() => (tel ? `tel:${tel}` : null), [tel])

  const contactItems = useMemo<ReservationContactItem[]>(
    () =>
      buildReservationContactItems({
        tel,
        lineId,
        telHref: telUrl,
        lineHref: lineUrl,
      }),
    [lineId, lineUrl, tel, telUrl],
  )

  const actionableItems = contactItems.filter((item) => item.href)

  if (!actionableItems.length) return null

  return (
    <div className="text-sm text-slate-600">
      <div className="flex flex-col gap-2">
        {actionableItems.map((item) => {
          const isLine = item.key === 'line'
          const buttonLabel = isLine
            ? `LINEで問い合わせる${reservationId ? `（ID: ${reservationId}）` : ''}`
            : `TELで問い合わせる${reservationId ? `（ID: ${reservationId} をお伝えください）` : ''}`
          return (
            <a
              key={item.key}
              className={`inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                isLine
                  ? 'bg-[#06C755] hover:bg-[#05B14D] focus-visible:outline-[#06C755]'
                  : 'bg-blue-600 hover:bg-blue-700 focus-visible:outline-blue-600'
              }`}
              href={item.href}
              target={isLine ? '_blank' : undefined}
              rel={isLine ? 'noopener noreferrer' : undefined}
            >
              {buttonLabel}
            </a>
          )
        })}
      </div>
    </div>
  )
}
