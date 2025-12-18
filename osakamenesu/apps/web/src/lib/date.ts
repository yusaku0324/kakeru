/**
 * 日付フォーマットユーティリティ
 *
 * 内部実装は lib/jst.ts に委譲。
 * このファイルは後方互換性のために維持。
 */

import { formatDateISO, extractDate, formatTimeHM, isSameDate } from '@/lib/jst'

/**
 * Date または ISO 文字列を YYYY-MM-DD 形式（JST）で返す
 *
 * @deprecated lib/jst.ts の formatDateISO() を直接使用してください
 */
export function toLocalDateISO(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) {
    return typeof input === 'string' ? input : ''
  }
  return formatDateISO(date)
}

/**
 * 予約時間帯を「YYYY/MM/DD HH:mm〜HH:mm」形式で表示
 *
 * @example
 * formatReservationRange('2024-12-17T18:00:00+09:00', '2024-12-17T19:30:00+09:00')
 * // '2024/12/17 18:00〜19:30'
 */
export function formatReservationRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${start}〜${end}`
  }

  // JST 基準でフォーマット
  const startDateStr = extractDate(formatDateISO(startDate))
  const endDateStr = extractDate(formatDateISO(endDate))
  const startTimeStr = formatTimeHM(startDate)
  const endTimeStr = formatTimeHM(endDate)

  // YYYY-MM-DD → YYYY/MM/DD に変換
  const startDateLabel = startDateStr.replace(/-/g, '/')
  const endDateLabel = endDateStr.replace(/-/g, '/')

  if (isSameDate(startDateStr, endDateStr)) {
    return `${startDateLabel} ${startTimeStr}〜${endTimeStr}`
  }

  return `${startDateLabel} ${startTimeStr}〜${endDateLabel} ${endTimeStr}`
}
