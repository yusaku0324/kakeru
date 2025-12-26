import { describe, it, expect } from 'vitest'
import { parsePricingText, type PricingItem } from '../pricing'

describe('parsePricingText', () => {
  it('returns empty array for null or undefined', () => {
    expect(parsePricingText(null)).toEqual([])
    expect(parsePricingText(undefined)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parsePricingText('')).toEqual([])
  })

  it('parses single pricing item with yen symbol', () => {
    const result = parsePricingText('アロマコース 60分 ¥8,000')
    expect(result).toEqual([
      {
        title: 'アロマコース',
        duration: '60分',
        price: '¥8,000',
        durationMinutes: 60,
      },
    ])
  })

  it('parses single pricing item with 円 suffix', () => {
    const result = parsePricingText('アロマコース 60分 8000円')
    expect(result).toEqual([
      {
        title: 'アロマコース',
        duration: '60分',
        price: '8000円',
        durationMinutes: 60,
      },
    ])
  })

  it('parses multiple pricing items separated by /', () => {
    const result = parsePricingText('60分 ¥8,000 / 90分 ¥12,000')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      title: '60分コース',
      duration: null,
      price: '¥8,000',
      durationMinutes: 60,
    })
    expect(result[1]).toEqual({
      title: '90分コース',
      duration: null,
      price: '¥12,000',
      durationMinutes: 90,
    })
  })

  it('parses multiple pricing items separated by ／', () => {
    const result = parsePricingText('60分 ¥8,000／90分 ¥12,000')
    expect(result).toHaveLength(2)
  })

  it('handles items without title', () => {
    const result = parsePricingText('60分 ¥8,000')
    expect(result[0].title).toBe('60分コース')
    expect(result[0].duration).toBeNull() // duration is null because title contains it
  })

  it('handles items without duration', () => {
    const result = parsePricingText('スペシャルコース ¥10,000')
    expect(result).toEqual([
      {
        title: 'スペシャルコース',
        duration: null,
        price: '¥10,000',
        durationMinutes: null,
      },
    ])
  })

  it('handles items without price', () => {
    const result = parsePricingText('アロマコース 60分')
    expect(result).toEqual([
      {
        title: 'アロマコース',
        duration: '60分',
        price: null,
        durationMinutes: 60,
      },
    ])
  })

  it('generates fallback title when no info available', () => {
    const result = parsePricingText('/ /')
    // Empty parts should be filtered out
    expect(result).toEqual([])
  })

  it('removes parentheses from title', () => {
    const result = parsePricingText('(アロマ) 60分 ¥8,000')
    expect(result[0].title).toBe('アロマ')
  })

  it('handles complex real-world pricing text', () => {
    const result = parsePricingText('ボディケア 60分 ¥6,000 / リフレ 30分 ¥3,500 / 全身 90分 ¥9,000')
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      title: 'ボディケア',
      duration: '60分',
      price: '¥6,000',
      durationMinutes: 60,
    })
    expect(result[1]).toEqual({
      title: 'リフレ',
      duration: '30分',
      price: '¥3,500',
      durationMinutes: 30,
    })
    expect(result[2]).toEqual({
      title: '全身',
      duration: '90分',
      price: '¥9,000',
      durationMinutes: 90,
    })
  })

  it('handles pricing with comma in price', () => {
    const result = parsePricingText('プレミアム 120分 ¥15,000')
    expect(result[0].price).toBe('¥15,000')
  })

  it('parses duration minutes correctly', () => {
    const result = parsePricingText('コース 120分 ¥10,000')
    expect(result[0].durationMinutes).toBe(120)
  })

  it('generates indexed fallback title when no title or duration', () => {
    // Price only - no title, no duration
    const result = parsePricingText('¥5,000 / ¥8,000')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      title: 'コース 1',
      duration: null,
      price: '¥5,000',
      durationMinutes: null,
    })
    expect(result[1]).toEqual({
      title: 'コース 2',
      duration: null,
      price: '¥8,000',
      durationMinutes: null,
    })
  })
})
