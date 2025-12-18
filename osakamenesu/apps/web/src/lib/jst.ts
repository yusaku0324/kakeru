/**
 * JST（日本標準時）基準の日付ユーティリティ
 *
 * このプロジェクトのすべての日付処理はこのモジュールを経由すること。
 * Date オブジェクトを直接操作してはならない。
 *
 * 禁止事項:
 * - new Date() を直接使って日付計算
 * - date.getFullYear() / getMonth() / getDate() でローカルTZ依存の値を取得
 * - 日付文字列を手動で組み立てる
 *
 * 実装詳細:
 * - Intl.DateTimeFormat で timeZone: 'Asia/Tokyo' を明示指定
 * - サーバー（Vercel/UTC）でもブラウザ（ローカルTZ）でも同じ結果を返す
 */

// ============================================================================
// 定数
// ============================================================================

export const JST_TIMEZONE = 'Asia/Tokyo'

// ============================================================================
// 内部：フォーマッタ（Intl.DateTimeFormat で TZ を固定）
// ============================================================================

const dateIsoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: JST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const timeHmFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: JST_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dateTimePartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: JST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

// ============================================================================
// テスト用：現在時刻の注入ポイント
// ============================================================================

let testNow: Date | null = null

/**
 * 現在時刻を取得
 * テスト時に setNowForTesting() で固定可能
 */
export function now(): Date {
  return testNow ?? new Date()
}

/**
 * テスト用：現在時刻を固定
 * null を渡すとリセット
 */
export function setNowForTesting(date: Date | null): void {
  testNow = date
}

// ============================================================================
// コア：日付フォーマット
// ============================================================================

/**
 * Date オブジェクトを YYYY-MM-DD 形式（JST）で返す
 *
 * @example
 * formatDateISO(new Date('2024-12-17T15:00:00Z')) // '2024-12-18' (UTC 15:00 = JST 翌日 0:00)
 */
export function formatDateISO(date: Date): string {
  return dateIsoFormatter.format(date)
}

/**
 * Date オブジェクトを YYYY-MM-DDTHH:mm:ss+09:00 形式（JST）で返す
 *
 * @example
 * formatDateTimeISO(new Date('2024-12-17T09:30:00Z')) // '2024-12-17T18:30:00+09:00'
 */
export function formatDateTimeISO(date: Date): string {
  const parts = dateTimePartsFormatter.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''

  const year = get('year')
  const month = get('month')
  const day = get('day')
  const hour = get('hour')
  const minute = get('minute')
  const second = get('second')

  return `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`
}

/**
 * Date オブジェクトを HH:mm 形式（JST）で返す
 *
 * @example
 * formatTimeHM(new Date('2024-12-17T09:30:00Z')) // '18:30'
 */
export function formatTimeHM(date: Date): string {
  return timeHmFormatter.format(date)
}

// ============================================================================
// 本日判定
// ============================================================================

/**
 * 本日の日付を YYYY-MM-DD 形式で取得（JST）
 *
 * @example
 * today() // '2024-12-17'
 */
export function today(): string {
  return formatDateISO(now())
}

/**
 * 指定した日付文字列が本日かどうかを判定（JST）
 *
 * @example
 * isToday('2024-12-17') // true（本日が 2024-12-17 の場合）
 */
export function isToday(dateStr: string): boolean {
  return extractDate(dateStr) === today()
}

// ============================================================================
// 日付操作
// ============================================================================

/**
 * YYYY-MM-DD 文字列から Date オブジェクトを生成
 * JST の 0:00:00 として解釈する
 *
 * @example
 * parseJstDateAtMidnight('2024-12-17') // Date representing 2024-12-17T00:00:00+09:00
 */
export function parseJstDateAtMidnight(dateStr: string): Date {
  // +09:00 を明示して JST 0:00 として解釈
  return new Date(`${dateStr}T00:00:00+09:00`)
}

/**
 * 指定日数後の日付を YYYY-MM-DD 形式で取得
 *
 * @example
 * addDays('2024-12-17', 3) // '2024-12-20'
 * addDays('2024-12-31', 1) // '2025-01-01'
 */
export function addDays(dateStr: string, days: number): string {
  const base = parseJstDateAtMidnight(dateStr)
  const result = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
  return formatDateISO(result)
}

/**
 * 7日分の日付配列を生成
 *
 * @param from - 開始日（YYYY-MM-DD）。省略時は本日
 * @returns 7日分の YYYY-MM-DD 配列
 *
 * @example
 * weekRange('2024-12-17') // ['2024-12-17', '2024-12-18', ..., '2024-12-23']
 */
export function weekRange(from?: string): string[] {
  const start = from ?? today()
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    dates.push(addDays(start, i))
  }
  return dates
}

// ============================================================================
// ISO 文字列操作
// ============================================================================

/**
 * ISO 文字列から日付部分を抽出
 *
 * @example
 * extractDate('2024-12-17T18:00:00+09:00') // '2024-12-17'
 * extractDate('2024-12-17') // '2024-12-17'
 */
export function extractDate(isoString: string): string {
  return isoString.split('T')[0]
}

/**
 * ISO 文字列から時刻部分（HH:mm）を抽出
 *
 * @example
 * extractTime('2024-12-17T18:30:00+09:00') // '18:30'
 */
export function extractTime(isoString: string): string {
  return isoString.slice(11, 16)
}

// ============================================================================
// 比較
// ============================================================================

/**
 * 2つの日付文字列が同じ日かどうかを判定
 * ISO 文字列でも YYYY-MM-DD でも受け付ける
 *
 * @example
 * isSameDate('2024-12-17', '2024-12-17T18:00:00+09:00') // true
 * isSameDate('2024-12-17', '2024-12-18') // false
 */
export function isSameDate(a: string, b: string): boolean {
  return extractDate(a) === extractDate(b)
}
