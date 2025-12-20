/**
 * Constants for SearchFilters component.
 */

export const AREA_ORDER = [
  '難波/日本橋',
  '梅田',
  '心斎橋',
  '天王寺',
  '谷町九丁目',
  '堺筋本町',
  '京橋',
  '北新地',
  '本町',
  '南森町',
  '新大阪',
  '江坂',
  '堺',
]

export const numberFormatter = new Intl.NumberFormat('ja-JP')

export const BUST_SIZES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
export const BUST_MIN_INDEX = 0
export const BUST_MAX_INDEX = BUST_SIZES.length - 1
export const AGE_MIN = 18
export const AGE_MAX_LIMIT = 65
export const AGE_DEFAULT_MAX = 35
export const HEIGHT_MIN = 145
export const HEIGHT_MAX_LIMIT = 190
export const HEIGHT_DEFAULT_MAX = 175
export const DEFAULT_TAG = '指定なし'
export const HAIR_COLOR_OPTIONS = [DEFAULT_TAG, '黒髪', '茶髪', '明るめ', '金髪', 'ピンク', 'その他']
export const HAIR_STYLE_OPTIONS = [DEFAULT_TAG, 'ロング', 'ミディアム', 'ショート', 'ボブ', 'ポニーテール']
export const BODY_TYPE_OPTIONS = [DEFAULT_TAG, 'スレンダー', '普通', 'グラマー', 'ぽっちゃり']
export const TAB_VALUE_SET = new Set(['all', 'therapists', 'shops'])

export const AREA_SELECT_OPTIONS_DEFAULT = [{ value: '', label: 'すべて' }]
export const SERVICE_SELECT_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'store', label: '店舗型' },
  { value: 'dispatch', label: '派遣型' },
]
export const SORT_SELECT_OPTIONS = [
  { value: 'recommended', label: 'おすすめ順' },
  { value: 'price_asc', label: '料金が安い順' },
  { value: 'price_desc', label: '料金が高い順' },
  { value: 'rating', label: 'クチコミ評価順' },
  { value: 'reviews', label: '口コミ件数順' },
  { value: 'availability', label: '予約可能枠が多い順' },
  { value: 'new', label: '更新が新しい順' },
  { value: 'favorites', label: 'お気に入り数順' },
] as const

export const buildHighlightStyle = (
  minValue: number,
  maxValue: number,
  minBound: number,
  maxBound: number,
) => {
  const range = maxBound - minBound
  if (range <= 0) return { left: '0%', right: '0%' }
  const start = ((minValue - minBound) / range) * 100
  const end = ((maxValue - minBound) / range) * 100
  return {
    left: `${Math.max(0, Math.min(start, 100))}%`,
    right: `${Math.max(0, 100 - Math.max(0, Math.min(end, 100)))}%`,
  }
}

export type FacetValue = {
  value: string
  label?: string | null
  count?: number
  selected?: boolean | null
}

export type Facets = Record<string, FacetValue[] | undefined>
