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

type SlotTemplate = {
  hour: number
  minute: number
  durationMinutes: number
  status: AvailabilityStatus
}

type DayTemplate = {
  dayOffset: number
  slots: SlotTemplate[]
}

// Helper to generate availability slots for a week
// Exported to use as fallback when therapist is not in FALLBACK_STAFF_META
// If defaultStart is provided, ensures that slot is included in the appropriate day
export function generateDefaultAvailability(defaultStart?: string | null): DayTemplate[] {
  const baseSlots: DayTemplate[] = [
    {
      dayOffset: 0,
      slots: [
        { hour: 13, minute: 0, durationMinutes: 90, status: 'open' },
        { hour: 15, minute: 0, durationMinutes: 90, status: 'open' },
        { hour: 17, minute: 0, durationMinutes: 90, status: 'tentative' },
        { hour: 19, minute: 0, durationMinutes: 120, status: 'open' },
      ],
    },
    {
      dayOffset: 1,
      slots: [
        { hour: 14, minute: 0, durationMinutes: 90, status: 'open' },
        { hour: 16, minute: 0, durationMinutes: 90, status: 'open' },
        { hour: 18, minute: 0, durationMinutes: 120, status: 'open' },
      ],
    },
    {
      dayOffset: 2,
      slots: [
        { hour: 12, minute: 0, durationMinutes: 90, status: 'open' },
        { hour: 15, minute: 0, durationMinutes: 90, status: 'tentative' },
        { hour: 18, minute: 0, durationMinutes: 90, status: 'open' },
      ],
    },
    {
      dayOffset: 3,
      slots: [
        { hour: 13, minute: 0, durationMinutes: 90, status: 'open' },
        { hour: 17, minute: 0, durationMinutes: 90, status: 'open' },
        { hour: 20, minute: 0, durationMinutes: 90, status: 'tentative' },
      ],
    },
    {
      dayOffset: 4,
      slots: [
        { hour: 11, minute: 0, durationMinutes: 90, status: 'open' },
        { hour: 14, minute: 0, durationMinutes: 90, status: 'open' },
        { hour: 17, minute: 30, durationMinutes: 90, status: 'open' },
      ],
    },
    {
      dayOffset: 5,
      slots: [
        { hour: 10, minute: 30, durationMinutes: 90, status: 'open' },
        { hour: 13, minute: 0, durationMinutes: 90, status: 'open' },
        { hour: 16, minute: 0, durationMinutes: 90, status: 'tentative' },
      ],
    },
    {
      dayOffset: 6,
      slots: [
        { hour: 12, minute: 0, durationMinutes: 90, status: 'open' },
        { hour: 15, minute: 30, durationMinutes: 90, status: 'open' },
        { hour: 18, minute: 30, durationMinutes: 90, status: 'open' },
      ],
    },
  ]

  // If defaultStart is provided, inject it into the appropriate day
  if (defaultStart) {
    const startDate = new Date(defaultStart)
    if (!Number.isNaN(startDate.getTime())) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const startDay = new Date(startDate)
      startDay.setHours(0, 0, 0, 0)
      const dayOffset = Math.round((startDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      // Find or create the day entry
      let dayEntry = baseSlots.find((d) => d.dayOffset === dayOffset)
      if (!dayEntry && dayOffset >= 0 && dayOffset <= 13) {
        dayEntry = { dayOffset, slots: [] }
        baseSlots.push(dayEntry)
        baseSlots.sort((a, b) => a.dayOffset - b.dayOffset)
      }

      if (dayEntry) {
        const hour = startDate.getHours()
        const minute = startDate.getMinutes()
        // Check if slot already exists
        const slotExists = dayEntry.slots.some((s) => s.hour === hour && s.minute === minute)
        if (!slotExists) {
          // Add the defaultStart slot at the beginning (it's the most important)
          dayEntry.slots.unshift({
            hour,
            minute,
            durationMinutes: 90,
            status: 'open',
          })
          // Sort slots by time
          dayEntry.slots.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
        }
      }
    }
  }

  return baseSlots
}

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
  凛: {
    details: [
      { label: '年齢', value: '24歳' },
      { label: '身長', value: '158cm' },
      { label: 'スタイル', value: 'スレンダー' },
      { label: '3サイズ', value: 'B82 W58 H84' },
    ],
    gallery: [
      'https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=900&q=80',
    ],
    bio: 'ストレッチと指圧を組み合わせた独自の施術で、身体の可動域を広げながらコリをほぐします。',
    schedule: '月・水・金・土 12:00〜22:00',
    pricing: '60分コース 10,000円〜 / 90分コース 14,000円〜',
    options: ['ストレッチ強化', '指圧重点', 'スポーツケア'],
    availability: generateDefaultAvailability(),
  },
  真央: {
    details: [
      { label: '年齢', value: '27歳' },
      { label: '身長', value: '162cm' },
      { label: 'スタイル', value: '標準' },
      { label: '3サイズ', value: 'B85 W59 H86' },
    ],
    gallery: [
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=900&q=80',
    ],
    bio: 'オイルマッサージとヘッドスパの融合施術で、心身ともにリフレッシュ。',
    schedule: '火・木・土・日 11:00〜21:00',
    pricing: '60分コース 11,000円〜 / 90分コース 15,000円〜',
    options: ['ヘッドスパ延長', 'アロマオイル追加', '足つぼ追加'],
    availability: generateDefaultAvailability(),
  },
  美月: {
    details: [
      { label: '年齢', value: '29歳' },
      { label: '身長', value: '168cm' },
      { label: 'スタイル', value: 'モデル体型' },
      { label: '3サイズ', value: 'B86 W58 H88' },
    ],
    gallery: [
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80',
    ],
    bio: 'リンパドレナージュ専門。デトックス効果で疲れた身体をすっきりリフレッシュ。',
    schedule: '月・火・木・金 14:00〜24:00',
    pricing: '60分コース 12,000円〜 / 90分コース 16,000円〜',
    options: ['リンパ重点', 'フェイシャル追加', 'デトックスコース'],
    availability: generateDefaultAvailability(),
  },
  結衣: {
    details: [
      { label: '年齢', value: '25歳' },
      { label: '身長', value: '160cm' },
      { label: 'スタイル', value: 'ナチュラル' },
      { label: '3サイズ', value: 'B84 W60 H85' },
    ],
    gallery: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=80',
    ],
    bio: 'ホットストーンとアロマを組み合わせた温感施術で、深いリラクゼーションを。',
    schedule: '水・木・土・日 13:00〜23:00',
    pricing: '60分コース 11,000円〜 / 90分コース 15,000円〜',
    options: ['ホットストーン追加', 'アロマブレンド変更', '岩盤浴セット'],
    availability: generateDefaultAvailability(),
  },
  楓: {
    details: [
      { label: '年齢', value: '28歳' },
      { label: '身長', value: '163cm' },
      { label: 'スタイル', value: 'アスリート' },
      { label: '3サイズ', value: 'B83 W57 H85' },
    ],
    gallery: [
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=900&q=80',
    ],
    bio: '指圧とストレッチで身体の芯からほぐします。スポーツ後のケアにもおすすめ。',
    schedule: '月・火・水・金 12:00〜22:00',
    pricing: '60分コース 10,000円〜 / 90分コース 14,000円〜',
    options: ['スポーツケア', 'ストレッチ重点', '筋膜リリース'],
    availability: generateDefaultAvailability(),
  },
  美咲: {
    details: [
      { label: '年齢', value: '30歳' },
      { label: '身長', value: '167cm' },
      { label: 'スタイル', value: 'エレガント' },
      { label: '3サイズ', value: 'B87 W59 H88' },
    ],
    gallery: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
    ],
    bio: 'アロマ×ヒーリングで極上のリラックス体験を提供。心と身体の両方を癒します。',
    schedule: '火・木・土・日 14:00〜24:00',
    pricing: '90分コース 18,000円〜 / 120分コース 24,000円〜',
    options: ['VIPルーム', 'プレミアムアロマ', 'シャンパンサービス'],
    availability: generateDefaultAvailability(),
  },
}
