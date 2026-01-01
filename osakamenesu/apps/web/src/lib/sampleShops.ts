import { today, addDays, formatDateTimeISO, now as jstNow } from '@/lib/jst'

// Helper function to generate ISO timestamps relative to now (JST)
// This must match the logic in shared.ts to ensure consistency
function isoHoursFromNow(hours: number): string {
  const date = new Date(jstNow().getTime() + hours * 60 * 60 * 1000)
  return formatDateTimeISO(date)
}

// Helper to get next 30-minute aligned slot time (for canonicalization)
// e.g., 09:28 → 09:30, 09:00 → 09:00, 09:31 → 10:00
function nextSlotAlignedTime(hours: number): string {
  const date = new Date(jstNow().getTime() + hours * 60 * 60 * 1000)
  const minutes = date.getMinutes()
  // Round up to next 30-minute boundary
  const alignedMinutes = minutes === 0 ? 0 : minutes <= 30 ? 30 : 60
  date.setMinutes(alignedMinutes === 60 ? 0 : alignedMinutes, 0, 0)
  if (alignedMinutes === 60) {
    date.setHours(date.getHours() + 1)
  }
  return formatDateTimeISO(date)
}

// Helper to get today's date in YYYY-MM-DD format (JST)
function getLocalDateISO(offset = 0): string {
  if (offset === 0) return today()
  return addDays(today(), offset)
}

// Helper to build a slot time for a given day offset and hour (JST)
// Exported for testing purposes
export function buildSlotTime(dayOffset: number, hour: number, minute = 0): string {
  const dateStr = getLocalDateISO(dayOffset)
  const hourStr = String(hour).padStart(2, '0')
  const minuteStr = String(minute).padStart(2, '0')
  return `${dateStr}T${hourStr}:${minuteStr}:00+09:00`
}

export type SampleStaff = {
  id: string
  name: string
  alias?: string | null
  headline?: string | null
  rating?: number | null
  review_count?: number | null
  avatar_url?: string | null
  specialties?: string[] | null
  today_available?: boolean | null
  next_available_at?: string | null
  next_available_slot?: {
    start_at: string
    status: 'ok' | 'maybe'
  } | null
}

export type SampleAvailabilitySlot = {
  start_at: string
  end_at: string
  status: 'open' | 'tentative' | 'blocked'
  staff_id?: string | null
  menu_id?: string | null
}

export type SampleAvailabilityDay = {
  date: string
  is_today?: boolean | null
  slots: SampleAvailabilitySlot[]
}

export type SampleContact = {
  phone?: string | null
  line_id?: string | null
  website_url?: string | null
  reservation_form_url?: string | null
  sns?: Array<{ platform: string; url: string; label?: string | null }> | null
}

export type SampleShop = {
  id: string
  slug?: string | null
  name: string
  store_name?: string | null
  area: string
  area_name?: string | null
  address?: string | null
  categories?: string[] | null
  min_price: number
  max_price: number
  description?: string | null
  catch_copy?: string | null
  photos?: Array<{ url: string; alt?: string | null }> | null
  contact?: SampleContact | null
  menus?: Array<{
    id: string
    name: string
    description?: string | null
    duration_minutes?: number | null
    price: number
    tags?: string[] | null
  }> | null
  staff?: SampleStaff[] | null
  availability_calendar?: {
    shop_id: string
    generated_at: string
    days: SampleAvailabilityDay[]
  } | null
  badges?: string[] | null
  today_available?: boolean | null
  next_available_at?: string | null
  next_available_slot?: {
    start_at: string
    status: 'ok' | 'maybe'
  } | null
  distance_km?: number | null
  online_reservation?: boolean | null
  service_tags?: string[] | null
  metadata?: Record<string, unknown> | null
  has_promotions?: boolean | null
  promotion_count?: number | null
  has_discounts?: boolean | null
  promotions?: Array<{
    label: string
    description?: string | null
    expires_at?: string | null
  }> | null
  ranking_reason?: string | null
  updated_at?: string | null
  reviews?: {
    average_score?: number | null
    review_count?: number | null
    highlighted?: Array<{
      review_id?: string | null
      title: string
      body: string
      score: number
      visited_at?: string | null
      author_alias?: string | null
      aspects?: Record<string, unknown> | null
    }> | null
    aspect_averages?: Record<string, number> | null
    aspect_counts?: Record<string, number> | null
  } | null
  diary_count?: number | null
  has_diaries?: boolean | null
  diaries?: Array<{
    id?: string | null
    title?: string | null
    body: string
    photos?: string[] | null
    hashtags?: string[] | null
    published_at?: string | null
  }> | null
}

// Factory function to generate sample shops with fresh dates
function createSampleShops(): SampleShop[] {
  return [
    {
      id: '00000001-0000-0000-0000-000000000001',
      slug: 'sample-namba-resort',
      name: 'アロマリゾート 難波本店',
      store_name: 'アロマリゾート 難波本店',
      area: '難波/日本橋',
      area_name: '難波/日本橋',
      min_price: 11000,
      max_price: 18000,
      description:
        'リゾートのような完全個室空間で、丁寧なリンパケアが人気のメンエス。21時以降のビジネス利用も多数。',
      catch_copy: 'リゾートホテルを思わせる完全個室で極上の癒し体験を。',
      photos: [{ url: '/images/demo-shop-1.svg' }, { url: '/images/demo-shop-2.svg' }],
      contact: {
        phone: '066-100-1234',
        line_id: '@namba-resort',
        website_url: 'https://namba-resort.example.com',
        reservation_form_url: 'https://namba-resort.example.com/reserve',
        sns: [
          { platform: 'Instagram', url: 'https://instagram.com/namba.resort', label: 'Instagram' },
        ],
      },
      menus: [
        {
          id: 'sample-namba-course-90',
          name: 'スタンダードコース 90分',
          description: '全身リンパケア＋ドライヘッドスパ付き。',
          duration_minutes: 90,
          price: 13000,
          tags: ['リンパ', 'ドライヘッド'],
        },
        {
          id: 'sample-namba-course-120',
          name: 'プレミアムコース 120分',
          description: 'ホットストーンとハンドトリートメントで全身をケア。',
          duration_minutes: 120,
          price: 18000,
          tags: ['ホットストーン', 'ハンドケア'],
        },
      ],
      staff: [
        {
          id: '11111111-1111-1111-8888-111111111111',
          name: '葵',
          alias: 'Aoi',
          headline: '丁寧なオイルトリートメントで人気のセラピスト',
          rating: 4.6,
          review_count: 87,
          avatar_url: '/images/sample-therapist-aoi.png',
          specialties: ['リンパ', 'ホットストーン', '指名多数'],
          // Canonicalized: next_available_slot.start_at aligns with 30-min grid
          next_available_at: nextSlotAlignedTime(2),
          today_available: true,
          next_available_slot: {
            start_at: nextSlotAlignedTime(2),
            status: 'ok' as const,
          },
        },
        {
          id: '22222222-2222-2222-8888-222222222222',
          name: '凛',
          alias: 'Rin',
          headline: 'ストレッチと指圧を組み合わせた独自施術が評判',
          rating: 4.3,
          review_count: 52,
          avatar_url: '/images/sample-therapist-rin.png',
          specialties: ['ストレッチ', '指圧', 'ディープリンパ'],
          // Must match shared.ts: isoHoursFromNow(5)
          next_available_at: isoHoursFromNow(5),
        },
        {
          id: '22222222-2222-2222-8888-222222222223',
          name: '真央',
          alias: 'Mao',
          headline: 'オイルマッサージとヘッドスパの融合施術',
          rating: 4.5,
          review_count: 63,
          avatar_url: '/images/sample-therapist-mao.png',
          specialties: ['オイル', 'ヘッドスパ'],
          // Must match shared.ts: isoHoursFromNow(3)
          next_available_at: isoHoursFromNow(3),
        },
        {
          id: '22222222-2222-2222-8888-222222222224',
          name: '美月',
          alias: 'Mitsuki',
          headline: 'リンパドレナージュで疲れた身体をリフレッシュ',
          rating: 4.7,
          review_count: 91,
          avatar_url: '/images/sample-therapist-aoi.png',
          specialties: ['リンパドレナージュ', 'アロマ'],
          // Must match shared.ts: isoHoursFromNow(4)
          next_available_at: isoHoursFromNow(4),
        },
        {
          id: '22222222-2222-2222-8888-222222222225',
          name: '結衣',
          alias: 'Yui',
          headline: 'ホットストーンとアロマで至福のひととき',
          rating: 4.4,
          review_count: 45,
          avatar_url: '/images/sample-therapist-rin.png',
          specialties: ['ホットストーン', 'アロマ'],
          // Must match shared.ts: isoHoursFromNow(6)
          next_available_at: isoHoursFromNow(6),
        },
        {
          id: '22222222-2222-2222-8888-222222222226',
          name: '楓',
          alias: 'Kaede',
          headline: '指圧とストレッチで身体の芯からほぐします',
          rating: 4.8,
          review_count: 78,
          avatar_url: '/images/sample-therapist-mao.png',
          specialties: ['指圧', 'ストレッチ'],
          // Canonicalized: next_available_slot.start_at aligns with 30-min grid
          next_available_at: nextSlotAlignedTime(1),
          today_available: true,
          next_available_slot: {
            start_at: nextSlotAlignedTime(1),
            status: 'ok' as const,
          },
        },
      ],
      // Dynamic availability calendar - uses nextSlotAlignedTime for 30-min grid alignment
      // Each staff member's first available slot matches their next_available_slot.start_at
      availability_calendar: {
        shop_id: '00000001-0000-0000-0000-000000000001',
        generated_at: new Date().toISOString(),
        days: [
          {
            date: getLocalDateISO(0), // Today
            is_today: true,
            slots: [
              {
                // 楓's slot - canonicalized to 30-min grid
                start_at: nextSlotAlignedTime(1),
                end_at: nextSlotAlignedTime(2.5),
                status: 'open',
                staff_id: '22222222-2222-2222-8888-222222222226',
              },
              {
                // 葵's first open slot - canonicalized to 30-min grid
                start_at: nextSlotAlignedTime(2),
                end_at: nextSlotAlignedTime(3.5),
                status: 'open',
                staff_id: '11111111-1111-1111-8888-111111111111',
              },
              {
                // 真央's slot - canonicalized to 30-min grid
                start_at: nextSlotAlignedTime(3),
                end_at: nextSlotAlignedTime(4.5),
                status: 'open',
                staff_id: '22222222-2222-2222-8888-222222222223',
              },
              {
                // 美月's slot - canonicalized to 30-min grid
                start_at: nextSlotAlignedTime(4),
                end_at: nextSlotAlignedTime(5.5),
                status: 'open',
                staff_id: '22222222-2222-2222-8888-222222222224',
              },
              {
                // 凛's slot - canonicalized to 30-min grid
                start_at: nextSlotAlignedTime(5),
                end_at: nextSlotAlignedTime(7),
                status: 'tentative',
                staff_id: '22222222-2222-2222-8888-222222222222',
              },
              {
                // 結衣's slot - canonicalized to 30-min grid
                start_at: nextSlotAlignedTime(6),
                end_at: nextSlotAlignedTime(7.5),
                status: 'open',
                staff_id: '22222222-2222-2222-8888-222222222225',
              },
            ],
          },
          {
            date: getLocalDateISO(1), // Tomorrow
            slots: [
              {
                start_at: isoHoursFromNow(24 + 5), // Tomorrow 5 hours from midnight
                end_at: isoHoursFromNow(24 + 6.5),
                status: 'open',
                staff_id: '11111111-1111-1111-8888-111111111111',
              },
              {
                start_at: isoHoursFromNow(24 + 9),
                end_at: isoHoursFromNow(24 + 11),
                status: 'open',
                staff_id: '22222222-2222-2222-8888-222222222222',
              },
            ],
          },
          {
            date: getLocalDateISO(2), // Day after tomorrow
            slots: [
              {
                start_at: isoHoursFromNow(48 + 3),
                end_at: isoHoursFromNow(48 + 4.5),
                status: 'open',
                staff_id: '11111111-1111-1111-8888-111111111111',
              },
              {
                start_at: isoHoursFromNow(48 + 7),
                end_at: isoHoursFromNow(48 + 8.5),
                status: 'tentative',
                staff_id: '11111111-1111-1111-8888-111111111111',
              },
            ],
          },
          {
            date: getLocalDateISO(3),
            slots: [
              {
                start_at: isoHoursFromNow(72 + 4),
                end_at: isoHoursFromNow(72 + 5.5),
                status: 'tentative',
                staff_id: '22222222-2222-2222-8888-222222222222',
              },
              {
                start_at: isoHoursFromNow(72 + 10.5),
                end_at: isoHoursFromNow(72 + 12),
                status: 'open',
                staff_id: '11111111-1111-1111-8888-111111111111',
              },
            ],
          },
          {
            date: getLocalDateISO(4),
            slots: [
              {
                start_at: isoHoursFromNow(96 + 2),
                end_at: isoHoursFromNow(96 + 3.5),
                status: 'open',
                staff_id: '11111111-1111-1111-8888-111111111111',
              },
              {
                start_at: isoHoursFromNow(96 + 6),
                end_at: isoHoursFromNow(96 + 7.5),
                status: 'blocked',
                staff_id: '22222222-2222-2222-8888-222222222222',
              },
            ],
          },
          {
            date: getLocalDateISO(5),
            slots: [
              {
                start_at: isoHoursFromNow(120 + 1.5),
                end_at: isoHoursFromNow(120 + 3),
                status: 'open',
                staff_id: '11111111-1111-1111-8888-111111111111',
              },
              {
                start_at: isoHoursFromNow(120 + 8.5),
                end_at: isoHoursFromNow(120 + 10),
                status: 'tentative',
                staff_id: '11111111-1111-1111-8888-111111111111',
              },
            ],
          },
          {
            date: getLocalDateISO(6),
            slots: [
              {
                start_at: isoHoursFromNow(144 + 4),
                end_at: isoHoursFromNow(144 + 5.5),
                status: 'open',
                staff_id: '22222222-2222-2222-8888-222222222222',
              },
              {
                start_at: isoHoursFromNow(144 + 9.5),
                end_at: isoHoursFromNow(144 + 11),
                status: 'open',
                staff_id: '11111111-1111-1111-8888-111111111111',
              },
            ],
          },
        ],
      },
      badges: ['人気店', '駅チカ'],
      today_available: true,
      service_tags: ['個室', '日本人セラピスト', 'ペアルーム対応'],
      promotions: [{ label: '新人割 ¥1,000OFF', expires_at: '2025-12-31' }],
      ranking_reason: '口コミ評価4.7★。アロマ×リンパケアで全身リフレッシュ。',
      reviews: {
        average_score: 4.7,
        review_count: 128,
        highlighted: [
          {
            review_id: 'rev-1',
            title: '癒やされました',
            body: 'ゆっくりとした接客でリラックスできました。',
            score: 5,
            visited_at: '2025-09-20',
            author_alias: '会社員A',
          },
        ],
      },
      diary_count: 12,
      has_diaries: true,
      diaries: [
        {
          id: 'diary-aki-1',
          title: '本日の空き枠',
          body: '本日は21時〜と23時〜で空きがございます。お仕事帰りにぜひお立ち寄りください。',
          photos: ['/images/demo-shop-3.svg'],
          hashtags: ['葵', '当日予約'],
          published_at: '2025-10-01T09:00:00+09:00',
        },
      ],
    },
    // --- Additional sample shops for search results ---
    {
      id: 'sample-umeda-suite',
      slug: 'sample-umeda-suite',
      name: 'リラクゼーションSUITE 梅田',
      store_name: 'リラクゼーションSUITE 梅田',
      area: '梅田',
      area_name: '梅田',
      min_price: 13000,
      max_price: 22000,
      description: '完全予約制のラグジュアリー空間で、VIPルーム完備。深夜営業で仕事帰りも安心。',
      catch_copy: 'VIPルーム完備。完全予約制のラグジュアリー空間。',
      photos: [{ url: '/images/demo-shop-2.svg' }],
      contact: {
        phone: '066-200-2345',
        line_id: '@umeda-suite',
      },
      menus: [
        {
          id: 'sample-umeda-course-90',
          name: 'スタンダードコース 90分',
          duration_minutes: 90,
          price: 15000,
          tags: ['アロマ'],
        },
      ],
      staff: [
        {
          id: '33333333-3333-3333-8888-333333333333',
          name: '美咲',
          alias: 'Misaki',
          headline: 'アロマセラピーで心身をリフレッシュ',
          rating: 4.5,
          review_count: 65,
          avatar_url: '/images/sample-therapist-mao.png',
          specialties: ['アロマ', 'リフレクソロジー'],
          next_available_at: nextSlotAlignedTime(3),
        },
      ],
      availability_calendar: {
        shop_id: 'sample-umeda-suite',
        generated_at: new Date().toISOString(),
        days: [
          {
            date: getLocalDateISO(0),
            is_today: true,
            slots: [
              {
                start_at: nextSlotAlignedTime(3),
                end_at: nextSlotAlignedTime(4.5),
                status: 'open',
                staff_id: '33333333-3333-3333-8888-333333333333',
              },
            ],
          },
        ],
      },
      promotions: [{ label: '深夜割 ¥1,500OFF', expires_at: '2025-12-31' }],
      ranking_reason: '口コミ評価4.5★。VIP空間で極上のひととき。',
      reviews: {
        average_score: 4.5,
        review_count: 76,
        highlighted: [],
      },
      diary_count: 5,
      has_diaries: true,
    },
    {
      id: '00000002-0000-0000-0000-000000000002',
      slug: 'sample-shinsaibashi-lounge',
      name: 'メンズアロマLounge 心斎橋',
      store_name: 'メンズアロマLounge 心斎橋',
      area: '心斎橋/堀江',
      area_name: '心斎橋/堀江',
      min_price: 10000,
      max_price: 16000,
      description: 'アクセス抜群の心斎橋エリア。カジュアルな雰囲気でリピーター多数。',
      catch_copy: 'アクセス抜群。カジュアルに通えるメンズアロマ。',
      photos: [{ url: '/images/demo-shop-1.svg' }],
      contact: {
        phone: '066-300-3456',
        line_id: '@shinsaibashi-lounge',
      },
      menus: [
        {
          id: 'sample-shinsaibashi-course-60',
          name: 'クイックコース 60分',
          duration_minutes: 60,
          price: 10000,
          tags: ['ボディケア'],
        },
      ],
      staff: [
        {
          id: '44444444-4444-4444-8888-444444444444',
          name: '彩花',
          alias: 'Ayaka',
          headline: 'ボディケアで疲れを解消',
          rating: 4.4,
          review_count: 48,
          avatar_url: '/images/sample-therapist-aoi.png',
          specialties: ['ボディケア', 'ストレッチ'],
          next_available_at: nextSlotAlignedTime(2),
        },
        {
          id: '55555555-5555-5555-8888-555555555555',
          name: '優奈',
          alias: 'Yuna',
          headline: 'リンパマッサージで全身スッキリ',
          rating: 4.6,
          review_count: 72,
          avatar_url: '/images/sample-therapist-rin.png',
          specialties: ['リンパ', 'オイル'],
          next_available_at: nextSlotAlignedTime(4),
        },
      ],
      availability_calendar: {
        shop_id: '00000002-0000-0000-0000-000000000002',
        generated_at: new Date().toISOString(),
        days: [
          {
            date: getLocalDateISO(0),
            is_today: true,
            slots: [
              {
                start_at: nextSlotAlignedTime(2),
                end_at: nextSlotAlignedTime(3),
                status: 'open',
                staff_id: '44444444-4444-4444-8888-444444444444',
              },
              {
                start_at: nextSlotAlignedTime(4),
                end_at: nextSlotAlignedTime(5.5),
                status: 'open',
                staff_id: '55555555-5555-5555-8888-555555555555',
              },
            ],
          },
        ],
      },
      promotions: [],
      ranking_reason: '口コミ評価4.4★。リピーター率No.1。',
      reviews: {
        average_score: 4.4,
        review_count: 95,
        highlighted: [],
      },
      diary_count: 8,
      has_diaries: true,
    },
    {
      id: 'sample-tennoji-garden',
      slug: 'sample-tennoji-garden',
      name: 'リラクゼーションGarden 天王寺',
      store_name: 'リラクゼーションGarden 天王寺',
      area: '天王寺/阿倍野',
      area_name: '天王寺/阿倍野',
      min_price: 9000,
      max_price: 15000,
      description: '緑に囲まれた癒しの空間。リーズナブルな価格で本格施術。',
      catch_copy: '緑に囲まれた癒しの空間でリフレッシュ。',
      photos: [{ url: '/images/demo-shop-2.svg' }],
      contact: {
        phone: '066-400-4567',
        line_id: '@tennoji-garden',
      },
      menus: [
        {
          id: 'sample-tennoji-course-90',
          name: 'ガーデンコース 90分',
          duration_minutes: 90,
          price: 12000,
          tags: ['リンパ', 'アロマ'],
        },
      ],
      staff: [
        {
          id: '66666666-6666-6666-8888-666666666666',
          name: '愛理',
          alias: 'Airi',
          headline: 'アロマとリンパの融合施術',
          rating: 4.7,
          review_count: 89,
          avatar_url: '/images/sample-therapist-mao.png',
          specialties: ['アロマ', 'リンパ'],
          next_available_at: nextSlotAlignedTime(1),
        },
      ],
      availability_calendar: {
        shop_id: 'sample-tennoji-garden',
        generated_at: new Date().toISOString(),
        days: [
          {
            date: getLocalDateISO(0),
            is_today: true,
            slots: [
              {
                start_at: nextSlotAlignedTime(1),
                end_at: nextSlotAlignedTime(2.5),
                status: 'open',
                staff_id: '66666666-6666-6666-8888-666666666666',
              },
            ],
          },
        ],
      },
      promotions: [{ label: '初回限定 ¥2,000OFF', expires_at: '2025-12-31' }],
      ranking_reason: '口コミ評価4.7★。コスパ抜群の人気店。',
      reviews: {
        average_score: 4.7,
        review_count: 112,
        highlighted: [],
      },
      diary_count: 6,
      has_diaries: true,
    },
  ]
}

// Export function to get fresh sample shops data
export function getSampleShops(): SampleShop[] {
  return createSampleShops()
}

// For backward compatibility - but this will be stale after first import
// Use getSampleShops() for fresh data
export const SAMPLE_SHOPS: SampleShop[] = createSampleShops()
