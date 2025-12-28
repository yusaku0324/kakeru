import { describe, it, expect } from 'vitest'
import { getSampleShops, SAMPLE_SHOPS, buildSlotTime, type SampleShop } from '../sampleShops'

describe('sampleShops', () => {
  describe('getSampleShops', () => {
    it('returns an array of sample shops', () => {
      const shops = getSampleShops()
      expect(Array.isArray(shops)).toBe(true)
      expect(shops.length).toBeGreaterThan(0)
    })

    it('returns shops with required fields', () => {
      const shops = getSampleShops()
      shops.forEach(shop => {
        expect(shop.id).toBeDefined()
        expect(shop.name).toBeDefined()
        expect(shop.area).toBeDefined()
        expect(shop.min_price).toBeDefined()
        expect(shop.max_price).toBeDefined()
      })
    })

    it('returns fresh data on each call', () => {
      const shops1 = getSampleShops()
      const shops2 = getSampleShops()
      // Both should have same length
      expect(shops1.length).toBe(shops2.length)
      // But different reference
      expect(shops1).not.toBe(shops2)
    })

    it('includes staff with availability information', () => {
      const shops = getSampleShops()
      const shopWithStaff = shops.find(s => s.staff && s.staff.length > 0)
      expect(shopWithStaff).toBeDefined()

      if (shopWithStaff?.staff) {
        const staffWithAvailability = shopWithStaff.staff.find(s => s.next_available_at)
        expect(staffWithAvailability).toBeDefined()
      }
    })

    it('includes availability calendar with slots', () => {
      const shops = getSampleShops()
      const shopWithCalendar = shops.find(s => s.availability_calendar)
      expect(shopWithCalendar).toBeDefined()
      expect(shopWithCalendar?.availability_calendar?.days.length).toBeGreaterThan(0)

      const firstDay = shopWithCalendar?.availability_calendar?.days[0]
      expect(firstDay?.slots.length).toBeGreaterThan(0)
    })

    it('generates valid ISO timestamps for slots', () => {
      const shops = getSampleShops()
      const shopWithCalendar = shops.find(s => s.availability_calendar)

      if (shopWithCalendar?.availability_calendar) {
        const firstSlot = shopWithCalendar.availability_calendar.days[0].slots[0]
        // Check that start_at is a valid ISO timestamp with +09:00 timezone
        expect(firstSlot.start_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/)
        expect(firstSlot.end_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/)
      }
    })
  })

  describe('SAMPLE_SHOPS', () => {
    it('is an array of shops', () => {
      expect(Array.isArray(SAMPLE_SHOPS)).toBe(true)
      expect(SAMPLE_SHOPS.length).toBeGreaterThan(0)
    })

    it('has the same structure as getSampleShops', () => {
      const freshShops = getSampleShops()
      expect(SAMPLE_SHOPS.length).toBe(freshShops.length)

      // Check each shop has same id
      SAMPLE_SHOPS.forEach((shop, index) => {
        expect(shop.id).toBe(freshShops[index].id)
      })
    })
  })

  describe('shop data structure', () => {
    it('includes menus with proper structure', () => {
      const shops = getSampleShops()
      const shopWithMenus = shops.find(s => s.menus && s.menus.length > 0)
      expect(shopWithMenus).toBeDefined()

      if (shopWithMenus?.menus) {
        const menu = shopWithMenus.menus[0]
        expect(menu.id).toBeDefined()
        expect(menu.name).toBeDefined()
        expect(menu.price).toBeDefined()
        expect(menu.duration_minutes).toBeDefined()
      }
    })

    it('includes contact information', () => {
      const shops = getSampleShops()
      const shopWithContact = shops.find(s => s.contact)
      expect(shopWithContact).toBeDefined()
      expect(shopWithContact?.contact?.phone || shopWithContact?.contact?.line_id).toBeDefined()
    })

    it('includes promotions', () => {
      const shops = getSampleShops()
      const shopWithPromotions = shops.find(s => s.promotions && s.promotions.length > 0)
      expect(shopWithPromotions).toBeDefined()

      if (shopWithPromotions?.promotions) {
        expect(shopWithPromotions.promotions[0].label).toBeDefined()
      }
    })

    it('includes reviews', () => {
      const shops = getSampleShops()
      const shopWithReviews = shops.find(s => s.reviews)
      expect(shopWithReviews).toBeDefined()
      expect(shopWithReviews?.reviews?.average_score).toBeDefined()
      expect(shopWithReviews?.reviews?.review_count).toBeDefined()
    })

    it('includes diaries', () => {
      const shops = getSampleShops()
      const shopWithDiaries = shops.find(s => s.diaries && s.diaries.length > 0)
      expect(shopWithDiaries).toBeDefined()

      if (shopWithDiaries?.diaries) {
        expect(shopWithDiaries.diaries[0].body).toBeDefined()
      }
    })

    it('includes photos', () => {
      const shops = getSampleShops()
      const shopWithPhotos = shops.find(s => s.photos && s.photos.length > 0)
      expect(shopWithPhotos).toBeDefined()

      if (shopWithPhotos?.photos) {
        expect(shopWithPhotos.photos[0].url).toBeDefined()
      }
    })
  })

  describe('buildSlotTime', () => {
    it('builds slot time for today at given hour', () => {
      const result = buildSlotTime(0, 10, 0)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T10:00:00\+09:00$/)
    })

    it('builds slot time with minutes', () => {
      const result = buildSlotTime(0, 14, 30)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T14:30:00\+09:00$/)
    })

    it('pads single digit hours', () => {
      const result = buildSlotTime(0, 9, 0)
      expect(result).toMatch(/T09:00:00\+09:00$/)
    })

    it('pads single digit minutes', () => {
      const result = buildSlotTime(0, 10, 5)
      expect(result).toMatch(/T10:05:00\+09:00$/)
    })

    it('handles day offset for tomorrow', () => {
      const today = buildSlotTime(0, 10, 0)
      const tomorrow = buildSlotTime(1, 10, 0)
      // Dates should be different
      expect(today.slice(0, 10)).not.toBe(tomorrow.slice(0, 10))
    })

    it('handles negative day offset', () => {
      const today = buildSlotTime(0, 10, 0)
      const yesterday = buildSlotTime(-1, 10, 0)
      // Dates should be different
      expect(today.slice(0, 10)).not.toBe(yesterday.slice(0, 10))
    })

    it('uses default minute value of 0', () => {
      const result = buildSlotTime(0, 12)
      expect(result).toMatch(/T12:00:00\+09:00$/)
    })
  })
})
