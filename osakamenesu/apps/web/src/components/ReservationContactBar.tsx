'use client'

import { useMemo } from 'react'

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

function buildLineLink(lineId: string, message: string | null) {
  const base = lineId.startsWith('http') ? lineId : `https://line.me/R/ti/p/${lineId}`
  if (!message) return base
  const encoded = encodeURIComponent(message)
  return base.includes('?') ? `${base}&text=${encoded}` : `${base}?text=${encoded}`
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
      return buildLineLink(lineId, shopName ? `${shopName}の件で` : null)
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
    return buildLineLink(lineId, message)
  }, [lineId, reservationId, shopName, lastPayload])

  const telUrl = tel ? `tel:${tel}` : null

  if (!telUrl && !lineUrl) return null

  return (
    <div className="text-sm text-slate-600">
      <div className="flex flex-col gap-2">
        {telUrl ? (
          <a
            className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 text-white px-3 py-2"
            href={telUrl}
          >
            TELで問い合わせる{reservationId ? `（ID: ${reservationId} をお伝えください）` : ''}
          </a>
        ) : null}
        {lineUrl ? (
          <a
            className="inline-flex items-center justify-center gap-2 rounded bg-[#06C755] text-white px-3 py-2"
            href={lineUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            LINEで問い合わせる{reservationId ? `（ID: ${reservationId}）` : ''}
          </a>
        ) : null}
      </div>
    </div>
  )
}
