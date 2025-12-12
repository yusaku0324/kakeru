/**
 * 時刻正規化モジュール
 *
 * API/E2E/UI で統一して使用する時刻正規化関数を提供
 * 全ての時刻比較はこのモジュールを通して行うことで、
 * "09:00" vs "09:00:00" vs ISO文字列 のような不整合を防ぐ
 *
 * @module time-normalize
 */

/**
 * JST タイムゾーンフォーマッター
 * サーバー（UTC）でもクライアント（JST）でも同じ結果を返す
 */
const jstTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * 時刻文字列を「00:00からの経過分数」に正規化
 *
 * 仕様:
 * - 入力: ISO文字列 / "HH:MM" / "HH:MM:SS" / "H:MM"
 * - 出力: 0〜1439 の整数（分単位）
 * - 丸め: なし（切り捨てなし、秒は無視）
 * - 無効な入力: -1 を返す
 *
 * @example
 * normalizeTimeToMinutes("09:00")        // => 540
 * normalizeTimeToMinutes("09:00:00")     // => 540
 * normalizeTimeToMinutes("9:00")         // => 540
 * normalizeTimeToMinutes("2025-12-12T00:00:00+09:00") // => 0 (JST)
 * normalizeTimeToMinutes("invalid")      // => -1
 *
 * @param timeStr - 時刻文字列（ISO / HH:MM / HH:MM:SS）
 * @returns 00:00からの経過分数（0-1439）、無効な場合は -1
 */
export function normalizeTimeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') {
    return -1
  }

  // ISO文字列の場合、JSTに変換してから分数を計算
  if (timeStr.includes('T')) {
    try {
      const date = new Date(timeStr)
      if (isNaN(date.getTime())) {
        return -1
      }
      const formatted = jstTimeFormatter.format(date)
      return normalizeTimeToMinutes(formatted)
    } catch {
      return -1
    }
  }

  // "HH:MM" or "HH:MM:SS" or "H:MM" 形式
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) {
    return -1
  }

  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return -1
  }

  return hours * 60 + minutes
}

/**
 * 分数を "HH:MM" 形式の文字列に変換
 *
 * @param minutes - 00:00からの経過分数
 * @returns "HH:MM" 形式の文字列、無効な場合は "N/A"
 */
export function minutesToTimeString(minutes: number): string {
  if (minutes < 0 || minutes > 1439) {
    return 'N/A'
  }
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 2つの時刻が同じかどうかを分単位で比較
 *
 * @param time1 - 時刻文字列1
 * @param time2 - 時刻文字列2
 * @returns 同じ時刻なら true、異なるか無効なら false
 */
export function areTimesEqual(time1: string | null, time2: string | null): boolean {
  if (!time1 || !time2) return false
  const m1 = normalizeTimeToMinutes(time1)
  const m2 = normalizeTimeToMinutes(time2)
  if (m1 < 0 || m2 < 0) return false
  return m1 === m2
}

/**
 * 時刻の差分を分単位で計算
 *
 * @param time1 - 時刻文字列1（基準）
 * @param time2 - 時刻文字列2
 * @returns time2 - time1 の分数（負の値もあり）、無効な場合は null
 */
export function getTimeDifferenceMinutes(
  time1: string | null,
  time2: string | null
): number | null {
  if (!time1 || !time2) return null
  const m1 = normalizeTimeToMinutes(time1)
  const m2 = normalizeTimeToMinutes(time2)
  if (m1 < 0 || m2 < 0) return null
  return m2 - m1
}

/**
 * ISO文字列からJST時刻（HH:MM）を抽出
 *
 * @param isoString - ISO 8601 形式の日時文字列
 * @returns "HH:MM" 形式の文字列
 */
export function formatTimeJST(isoString: string): string {
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) {
      return 'N/A'
    }
    return jstTimeFormatter.format(date)
  } catch {
    return 'N/A'
  }
}
