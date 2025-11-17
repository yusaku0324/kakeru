import { type AvailabilityStatus } from '@/components/calendar/types'

type StaffMeta = Record<
  string,
  {
    details?: Array<{ label: string; value: string }>
    gallery?: string[]
    bio?: string
    schedule?: string
    pricing?: string
    options?: string[]
    availability?: Array<{
      dayOffset: number
      slots: Array<{
        hour: number
        minute: number
        durationMinutes: number
        status: AvailabilityStatus
      }>
    }>
  }
>

export const FALLBACK_STAFF_META: StaffMeta = {
  葵: {
    details: [
      { label: '年齢', value: '26歳' },
      { label: '身長', value: '165cm' },
      { label: 'スタイル', value: 'グラマー' },
      { label: '3サイズ', value: 'B88 W60 H89' },
    ],
    gallery: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1542293787938-4d2226c9dc13?auto=format&fit=crop&w=900&q=80',
    ],
    bio: 'タイ古式マッサージを得意としております。身体の芯からほぐしていきます。',
    schedule: '火・木・土・日 13:00〜23:00',
    pricing: '60分コース 11,000円〜 / 90分コース 15,000円〜',
    options: [
      'ホットストーン追加',
      'ドライヘッドスパ',
      'ハンドトリートメント延長',
      'アロマブレンド変更',
    ],
    availability: [
      {
        dayOffset: 0,
        slots: [
          { hour: 17, minute: 0, durationMinutes: 90, status: 'blocked' },
          { hour: 19, minute: 0, durationMinutes: 120, status: 'tentative' },
          { hour: 21, minute: 0, durationMinutes: 120, status: 'open' },
        ],
      },
      {
        dayOffset: 1,
        slots: [
          { hour: 14, minute: 0, durationMinutes: 90, status: 'open' },
          { hour: 18, minute: 0, durationMinutes: 120, status: 'open' },
        ],
      },
      {
        dayOffset: 2,
        slots: [
          { hour: 12, minute: 0, durationMinutes: 90, status: 'open' },
          { hour: 16, minute: 0, durationMinutes: 90, status: 'tentative' },
          { hour: 20, minute: 0, durationMinutes: 90, status: 'blocked' },
        ],
      },
      {
        dayOffset: 3,
        slots: [
          { hour: 13, minute: 0, durationMinutes: 90, status: 'tentative' },
          { hour: 19, minute: 30, durationMinutes: 90, status: 'open' },
        ],
      },
      {
        dayOffset: 4,
        slots: [
          { hour: 11, minute: 0, durationMinutes: 90, status: 'open' },
          { hour: 15, minute: 0, durationMinutes: 90, status: 'blocked' },
        ],
      },
      {
        dayOffset: 5,
        slots: [
          { hour: 10, minute: 30, durationMinutes: 90, status: 'open' },
          { hour: 17, minute: 30, durationMinutes: 90, status: 'tentative' },
        ],
      },
      {
        dayOffset: 6,
        slots: [
          { hour: 13, minute: 0, durationMinutes: 90, status: 'open' },
          { hour: 18, minute: 30, durationMinutes: 90, status: 'open' },
        ],
      },
    ],
  },
}

const pad = (value: number) => value.toString().padStart(2, '0')

export function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toIsoWithOffset(date: Date) {
  return `${formatLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00+09:00`
}
