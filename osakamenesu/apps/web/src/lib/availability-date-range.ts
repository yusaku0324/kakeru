/**
 * Availability API用の日付・レンジ生成ロジック
 *
 * このモジュールは以下を純粋関数として提供:
 * - JST基準の今日の日付取得
 * - 7日分の日付レンジ生成
 * - 日付比較（is_today判定）
 *
 * ユニットテスト可能な形で切り出すことで、
 * タイムゾーン関連の不整合を早期検知できる
 */

// JST timezone formatter for consistent date formatting regardless of server timezone
const jstDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Format date to YYYY-MM-DD in JST timezone
 * This ensures consistent date handling whether running on UTC (Vercel) or JST (local)
 *
 * @param date - Date object to format
 * @returns YYYY-MM-DD string in JST
 */
export function formatDateJST(date: Date): string {
  return jstDateFormatter.format(date)
}

/**
 * Get today's date string in JST timezone
 *
 * @param now - Optional Date object for testing (defaults to new Date())
 * @returns YYYY-MM-DD string representing today in JST
 */
export function getTodayJST(now: Date = new Date()): string {
  return formatDateJST(now)
}

/**
 * Generate a 7-day date range starting from today (JST)
 *
 * @param now - Optional Date object for testing (defaults to new Date())
 * @returns Array of 7 date strings in YYYY-MM-DD format (JST)
 */
export function generateWeekDateRange(now: Date = new Date()): string[] {
  const dates: string[] = []
  const todayStr = formatDateJST(now)

  // Start from today (day 0) and generate 7 consecutive days
  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    const dateStr = formatDateJST(d)
    dates.push(dateStr)
  }

  return dates
}

/**
 * Generate week date range with is_today flags
 *
 * @param now - Optional Date object for testing (defaults to new Date())
 * @returns Array of objects with date and is_today properties
 */
export function generateWeekDateRangeWithToday(
  now: Date = new Date()
): Array<{ date: string; is_today: boolean }> {
  const todayStr = formatDateJST(now)
  const dates = generateWeekDateRange(now)

  return dates.map((date) => ({
    date,
    is_today: date === todayStr,
  }))
}

/**
 * Check if a date string represents today in JST
 *
 * @param dateStr - YYYY-MM-DD date string to check
 * @param now - Optional Date object for testing (defaults to new Date())
 * @returns true if dateStr is today in JST
 */
export function isDateToday(dateStr: string, now: Date = new Date()): boolean {
  return dateStr === formatDateJST(now)
}

/**
 * Validate that a date string is in YYYY-MM-DD format
 *
 * @param dateStr - Date string to validate
 * @returns true if valid YYYY-MM-DD format
 */
export function isValidDateFormat(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
}

/**
 * Validate that dates in array are consecutive (no gaps, no duplicates)
 *
 * @param dates - Array of YYYY-MM-DD date strings
 * @returns true if dates are consecutive
 */
export function areDatesConsecutive(dates: string[]): boolean {
  if (dates.length < 2) return true

  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(`${dates[i - 1]}T00:00:00+09:00`)
    const currDate = new Date(`${dates[i]}T00:00:00+09:00`)
    const diffMs = currDate.getTime() - prevDate.getTime()
    const diffDays = diffMs / (24 * 60 * 60 * 1000)

    if (diffDays !== 1) {
      return false
    }
  }

  return true
}

/**
 * Debug info for date range generation
 * Useful for diagnosing timezone-related issues
 *
 * @param now - Date object to analyze
 * @returns Object with debug information
 */
export function getDateRangeDebugInfo(now: Date = new Date()): {
  inputDate: string
  inputTimestamp: number
  jstTodayStr: string
  utcIsoString: string
  weekDates: string[]
  isConsecutive: boolean
} {
  const weekDates = generateWeekDateRange(now)
  return {
    inputDate: now.toString(),
    inputTimestamp: now.getTime(),
    jstTodayStr: formatDateJST(now),
    utcIsoString: now.toISOString(),
    weekDates,
    isConsecutive: areDatesConsecutive(weekDates),
  }
}
