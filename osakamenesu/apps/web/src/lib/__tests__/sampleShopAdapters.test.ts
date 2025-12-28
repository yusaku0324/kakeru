import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sampleShopToHit, sampleShopToDetail } from '../sampleShopAdapters'
import type { SampleShop } from '../sampleShops'

// Helper to create a minimal valid SampleShop
const createMinimalShop = (overrides: Partial<SampleShop> = {}): SampleShop => ({
  id: 'shop-1',
  name: 'テスト店舗',
  area: '難波',
  min_price: 10000,
  max_price: 15000,
  ...overrides,
})

describe('sampleShopAdapters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sampleShopToHit', () => {
    it('converts minimal shop to ShopHit', () => {
      const shop = createMinimalShop()
      const hit = sampleShopToHit(shop)

      expect(hit.id).toBe('shop-1')
      expect(hit.name).toBe('テスト店舗')
      expect(hit.area).toBe('難波')
      expect(hit.min_price).toBe(10000)
      expect(hit.max_price).toBe(15000)
    })

    it('uses slug as id fallback', () => {
      const shop = createMinimalShop({ slug: 'test-shop-slug' })
      const hit = sampleShopToHit(shop)

      expect(hit.slug).toBe('test-shop-slug')
    })

    it('uses id as slug fallback when no slug provided', () => {
      const shop = createMinimalShop({ slug: undefined })
      const hit = sampleShopToHit(shop)

      expect(hit.slug).toBe('shop-1')
    })

    it('includes store_name when provided', () => {
      const shop = createMinimalShop({ store_name: 'ストア名' })
      const hit = sampleShopToHit(shop)

      expect(hit.store_name).toBe('ストア名')
    })

    it('uses name as store_name fallback', () => {
      const shop = createMinimalShop()
      const hit = sampleShopToHit(shop)

      expect(hit.store_name).toBe('テスト店舗')
    })

    it('includes area_name when provided', () => {
      const shop = createMinimalShop({ area_name: '大阪難波' })
      const hit = sampleShopToHit(shop)

      expect(hit.area_name).toBe('大阪難波')
    })

    it('uses area as area_name fallback', () => {
      const shop = createMinimalShop()
      const hit = sampleShopToHit(shop)

      expect(hit.area_name).toBe('難波')
    })

    it('includes rating from reviews', () => {
      const shop = createMinimalShop({
        reviews: { average_score: 4.5, review_count: 10 },
      })
      const hit = sampleShopToHit(shop)

      expect(hit.rating).toBe(4.5)
      expect(hit.review_count).toBe(10)
    })

    it('includes lead_image_url from first photo', () => {
      const shop = createMinimalShop({
        photos: [{ url: 'https://example.com/photo1.jpg' }],
      })
      const hit = sampleShopToHit(shop)

      expect(hit.lead_image_url).toBe('https://example.com/photo1.jpg')
    })

    it('includes badges when provided', () => {
      const shop = createMinimalShop({ badges: ['新店舗', '人気'] })
      const hit = sampleShopToHit(shop)

      expect(hit.badges).toEqual(['新店舗', '人気'])
    })

    it('includes today_available', () => {
      const shop = createMinimalShop({ today_available: true })
      const hit = sampleShopToHit(shop)

      expect(hit.today_available).toBe(true)
    })

    it('includes distance_km when provided', () => {
      const shop = createMinimalShop({ distance_km: 1.5 })
      const hit = sampleShopToHit(shop)

      expect(hit.distance_km).toBe(1.5)
    })

    it('sets online_reservation based on contact info', () => {
      const shop = createMinimalShop({
        contact: { reservation_form_url: 'https://example.com/reserve' },
      })
      const hit = sampleShopToHit(shop)

      expect(hit.online_reservation).toBe(true)
    })

    it('sets online_reservation from explicit value', () => {
      const shop = createMinimalShop({ online_reservation: true })
      const hit = sampleShopToHit(shop)

      expect(hit.online_reservation).toBe(true)
    })

    it('includes promotions when provided', () => {
      const shop = createMinimalShop({
        promotions: [{ label: '初回割引', description: '20%オフ' }],
      })
      const hit = sampleShopToHit(shop)

      expect(hit.promotions).toHaveLength(1)
      expect(hit.promotions?.[0].label).toBe('初回割引')
      expect(hit.has_promotions).toBe(true)
      expect(hit.promotion_count).toBe(1)
    })

    it('includes ranking_reason when provided', () => {
      const shop = createMinimalShop({ ranking_reason: '口コミ評価が高い' })
      const hit = sampleShopToHit(shop)

      expect(hit.ranking_reason).toBe('口コミ評価が高い')
    })

    it('includes diary info when provided', () => {
      const shop = createMinimalShop({
        diary_count: 5,
        has_diaries: true,
      })
      const hit = sampleShopToHit(shop)

      expect(hit.diary_count).toBe(5)
      expect(hit.has_diaries).toBe(true)
    })

    it('computes has_diaries from diaries array', () => {
      const shop = createMinimalShop({
        diaries: [{ body: 'テスト日記' }],
      })
      const hit = sampleShopToHit(shop)

      expect(hit.has_diaries).toBe(true)
      expect(hit.diary_count).toBe(1)
    })

    it('includes staff_preview limited to 3 members', () => {
      const shop = createMinimalShop({
        staff: [
          { id: 'staff-1', name: 'スタッフ1' },
          { id: 'staff-2', name: 'スタッフ2' },
          { id: 'staff-3', name: 'スタッフ3' },
          { id: 'staff-4', name: 'スタッフ4' },
        ],
      })
      const hit = sampleShopToHit(shop)

      expect(hit.staff_preview).toHaveLength(3)
      expect(hit.staff_preview?.[0].name).toBe('スタッフ1')
      expect(hit.staff_preview?.[2].name).toBe('スタッフ3')
    })

    it('includes staff details in preview', () => {
      const shop = createMinimalShop({
        staff: [
          {
            id: 'staff-1',
            name: 'テストスタッフ',
            alias: 'テスト',
            headline: 'ベテランセラピスト',
            rating: 4.8,
            review_count: 50,
            avatar_url: 'https://example.com/avatar.jpg',
            specialties: ['オイル', 'アロマ'],
          },
        ],
      })
      const hit = sampleShopToHit(shop)

      expect(hit.staff_preview?.[0]).toMatchObject({
        name: 'テストスタッフ',
        alias: 'テスト',
        headline: 'ベテランセラピスト',
        rating: 4.8,
        review_count: 50,
        avatar_url: 'https://example.com/avatar.jpg',
        specialties: ['オイル', 'アロマ'],
      })
    })

    it('uses default categories when not provided', () => {
      const shop = createMinimalShop()
      const hit = sampleShopToHit(shop)

      expect(hit.categories).toEqual(['メンズエステ'])
    })

    it('uses provided categories', () => {
      const shop = createMinimalShop({ categories: ['リラクゼーション', 'マッサージ'] })
      const hit = sampleShopToHit(shop)

      expect(hit.categories).toEqual(['リラクゼーション', 'マッサージ'])
    })

    describe('price band calculation', () => {
      it('computes price band from min_price', () => {
        const shop = createMinimalShop({ min_price: 12000, max_price: 18000 })
        const hit = sampleShopToHit(shop)

        expect(hit.price_band).toBe('10k_14k')
        expect(hit.price_band_label).toBe('1.0〜1.4万円')
      })

      it('computes highest price band for expensive shops', () => {
        const shop = createMinimalShop({ min_price: 25000, max_price: 30000 })
        const hit = sampleShopToHit(shop)

        expect(hit.price_band).toBe('22k_plus')
        expect(hit.price_band_label).toBe('2.2万円以上')
      })

      it('computes lowest price band for cheap shops', () => {
        const shop = createMinimalShop({ min_price: 5000, max_price: 8000 })
        const hit = sampleShopToHit(shop)

        expect(hit.price_band).toBe('under_10k')
        expect(hit.price_band_label).toBe('〜1万円')
      })

      it('uses menu price as fallback when no min_price', () => {
        const shop = createMinimalShop({
          min_price: 0,
          max_price: 0,
          menus: [{ id: 'm1', name: 'コース', price: 16000, duration_minutes: 60 }],
        })
        const hit = sampleShopToHit(shop)

        expect(hit.price_band).toBe('14k_18k')
      })

      it('uses menu price for band when no min_price/max_price', () => {
        const shop = createMinimalShop({
          min_price: 0,
          max_price: 0,
          menus: [{ id: 'm1', name: 'コース', price: 10000, duration_minutes: 60 }],
        })
        const hit = sampleShopToHit(shop)

        // Menu price 10000 falls into 10k-14k band
        expect(hit.price_band).toBe('10k_14k')
        expect(hit.price_band_label).toBe('1.0〜1.4万円')
      })
    })

    describe('next available slot', () => {
      it('includes next_available_slot when provided', () => {
        const futureDate = new Date(Date.now() + 3600000).toISOString()
        const shop = createMinimalShop({
          next_available_slot: { start_at: futureDate, status: 'ok' },
        })
        const hit = sampleShopToHit(shop)

        expect(hit.next_available_slot?.start_at).toBe(futureDate)
        expect(hit.next_available_slot?.status).toBe('ok')
      })

      it('computes next_available_slot from availability_calendar', () => {
        const futureDate = new Date(Date.now() + 3600000).toISOString()
        const shop = createMinimalShop({
          availability_calendar: {
            shop_id: 'shop-1',
            generated_at: new Date().toISOString(),
            days: [
              {
                date: new Date().toISOString().split('T')[0],
                slots: [
                  { start_at: futureDate, end_at: futureDate, status: 'open' as const },
                ],
              },
            ],
          },
        })
        const hit = sampleShopToHit(shop)

        expect(hit.next_available_slot).not.toBeNull()
        expect(hit.next_available_slot?.status).toBe('ok')
      })
    })
  })

  describe('sampleShopToDetail', () => {
    it('converts minimal shop to ShopDetail', () => {
      const shop = createMinimalShop()
      const detail = sampleShopToDetail(shop)

      expect(detail.id).toBe('shop-1')
      expect(detail.name).toBe('テスト店舗')
      expect(detail.area).toBe('難波')
      expect(detail.min_price).toBe(10000)
      expect(detail.max_price).toBe(15000)
    })

    it('includes description when provided', () => {
      const shop = createMinimalShop({ description: '素敵なお店です' })
      const detail = sampleShopToDetail(shop)

      expect(detail.description).toBe('素敵なお店です')
    })

    it('includes catch_copy when provided', () => {
      const shop = createMinimalShop({ catch_copy: '最高のリラクゼーション' })
      const detail = sampleShopToDetail(shop)

      expect(detail.catch_copy).toBe('最高のリラクゼーション')
    })

    it('includes photos with kind and caption', () => {
      const shop = createMinimalShop({
        photos: [
          { url: 'https://example.com/photo1.jpg', alt: '店内写真' },
          { url: 'https://example.com/photo2.jpg', alt: '外観' },
        ],
      })
      const detail = sampleShopToDetail(shop)

      expect(detail.photos).toHaveLength(2)
      expect(detail.photos?.[0].url).toBe('https://example.com/photo1.jpg')
      expect(detail.photos?.[0].kind).toBe('photo')
      expect(detail.photos?.[0].caption).toBe('店内写真')
    })

    it('includes contact information', () => {
      const shop = createMinimalShop({
        contact: {
          phone: '06-1234-5678',
          line_id: 'line123',
          website_url: 'https://example.com',
        },
      })
      const detail = sampleShopToDetail(shop)

      expect(detail.contact?.phone).toBe('06-1234-5678')
      expect(detail.contact?.line_id).toBe('line123')
      expect(detail.contact?.website_url).toBe('https://example.com')
    })

    it('includes menus with generated IDs', () => {
      const shop = createMinimalShop({
        menus: [
          { id: 'menu-1', name: '60分コース', price: 10000, duration_minutes: 60 },
          { id: 'menu-2', name: '90分コース', price: 15000, duration_minutes: 90 },
        ],
      })
      const detail = sampleShopToDetail(shop)

      expect(detail.menus).toHaveLength(2)
      expect(detail.menus?.[0].id).toBe('menu-1')
      expect(detail.menus?.[0].name).toBe('60分コース')
      expect(detail.menus?.[0].price).toBe(10000)
      expect(detail.menus?.[0].duration_minutes).toBe(60)
      expect(detail.menus?.[0].currency).toBe('JPY')
      // Second menu should have generated ID
      expect(detail.menus?.[1].id).toBeDefined()
      expect(detail.menus?.[1].id).not.toBe('')
    })

    it('includes staff with generated IDs', () => {
      const shop = createMinimalShop({
        staff: [
          { id: 'staff-1', name: 'スタッフ1', headline: 'ベテラン' },
          { id: 'staff-2', name: 'スタッフ2' },
        ],
      })
      const detail = sampleShopToDetail(shop)

      expect(detail.staff).toHaveLength(2)
      expect(detail.staff?.[0].name).toBe('スタッフ1')
      expect(detail.staff?.[0].headline).toBe('ベテラン')
      // Second staff should have generated ID
      expect(detail.staff?.[1].id).toBeDefined()
      expect(detail.staff?.[1].id).not.toBe('')
    })

    it('includes availability_calendar', () => {
      const today = new Date().toISOString().split('T')[0]
      const shop = createMinimalShop({
        availability_calendar: {
          shop_id: 'shop-1',
          generated_at: new Date().toISOString(),
          days: [
            {
              date: today,
              is_today: true,
              slots: [
                {
                  start_at: `${today}T10:00:00+09:00`,
                  end_at: `${today}T11:00:00+09:00`,
                  status: 'open' as const,
                },
              ],
            },
          ],
        },
      })
      const detail = sampleShopToDetail(shop)

      expect(detail.availability_calendar).not.toBeNull()
      expect(detail.availability_calendar?.shop_id).toBe('shop-1')
      expect(detail.availability_calendar?.days).toHaveLength(1)
      expect(detail.availability_calendar?.days[0].slots).toHaveLength(1)
    })

    it('includes promotions', () => {
      const shop = createMinimalShop({
        promotions: [
          { label: '初回割引', description: '20%オフ' },
        ],
      })
      const detail = sampleShopToDetail(shop)

      expect(detail.promotions).toHaveLength(1)
      expect(detail.promotions?.[0].label).toBe('初回割引')
    })

    it('includes reviews with highlighted', () => {
      const shop = createMinimalShop({
        reviews: {
          average_score: 4.5,
          review_count: 100,
          highlighted: [
            {
              title: '素晴らしい',
              body: '最高でした',
              score: 5,
              author_alias: 'ゲスト',
            },
          ],
          aspect_averages: {
            therapist_service: 4.8,
            staff_response: 4.6,
          },
        },
      })
      const detail = sampleShopToDetail(shop)

      expect(detail.reviews?.average_score).toBe(4.5)
      expect(detail.reviews?.review_count).toBe(100)
      expect(detail.reviews?.highlighted).toHaveLength(1)
      expect(detail.reviews?.highlighted?.[0].title).toBe('素晴らしい')
      expect(detail.reviews?.aspect_averages?.therapist_service).toBe(4.8)
    })

    it('includes diaries', () => {
      const shop = createMinimalShop({
        diaries: [
          {
            id: 'diary-1',
            title: '今日の日記',
            body: '本日も営業中です',
            hashtags: ['#営業中'],
          },
          {
            id: 'diary-2',
            body: '無題の日記',
          },
        ],
      })
      const detail = sampleShopToDetail(shop)

      expect(detail.diaries).toHaveLength(2)
      expect(detail.diaries?.[0].id).toBe('diary-1')
      expect(detail.diaries?.[0].title).toBe('今日の日記')
      expect(detail.diaries?.[0].body).toBe('本日も営業中です')
      expect(detail.diaries?.[0].hashtags).toEqual(['#営業中'])
      // Second diary should have generated ID
      expect(detail.diaries?.[1].id).toBeDefined()
    })

    it('includes metadata with distance and next_available', () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString()
      const shop = createMinimalShop({
        distance_km: 2.5,
        updated_at: '2024-01-01T00:00:00Z',
        next_available_at: futureDate,
      })
      const detail = sampleShopToDetail(shop)

      expect(detail.metadata?.distance_km).toBe(2.5)
      expect(detail.metadata?.updated_at).toBe('2024-01-01T00:00:00Z')
      expect(detail.metadata?.next_available_at).toBe(futureDate)
    })

    it('links slots to staff correctly', () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString()
      const shop = createMinimalShop({
        staff: [{ id: 'original-staff-1', name: 'スタッフ1' }],
        availability_calendar: {
          shop_id: 'shop-1',
          generated_at: new Date().toISOString(),
          days: [
            {
              date: new Date().toISOString().split('T')[0],
              slots: [
                {
                  start_at: futureDate,
                  end_at: futureDate,
                  status: 'open' as const,
                  staff_id: 'original-staff-1',
                },
              ],
            },
          ],
        },
      })
      const detail = sampleShopToDetail(shop)

      // The staff_id in slots should be mapped to the new generated ID
      const slot = detail.availability_calendar?.days[0].slots[0]
      expect(slot?.staff_id).toBeDefined()
    })
  })
})
