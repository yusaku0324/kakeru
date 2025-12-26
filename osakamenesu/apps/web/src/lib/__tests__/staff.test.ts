import { describe, it, expect } from 'vitest'
import {
  slugifyStaffIdentifier,
  buildStaffIdentifier,
  staffMatchesIdentifier,
  type StaffIdentifierSource,
} from '../staff'

describe('slugifyStaffIdentifier', () => {
  it('returns empty string for null', () => {
    expect(slugifyStaffIdentifier(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(slugifyStaffIdentifier(undefined)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(slugifyStaffIdentifier('')).toBe('')
  })

  it('converts to lowercase', () => {
    expect(slugifyStaffIdentifier('JOHN')).toBe('john')
  })

  it('replaces spaces with hyphens', () => {
    expect(slugifyStaffIdentifier('John Doe')).toBe('john-doe')
  })

  it('collapses multiple hyphens', () => {
    expect(slugifyStaffIdentifier('John   Doe')).toBe('john-doe')
  })

  it('removes leading and trailing hyphens', () => {
    expect(slugifyStaffIdentifier(' John ')).toBe('john')
  })

  it('handles Japanese characters', () => {
    expect(slugifyStaffIdentifier('田中')).toBe('田中')
  })

  it('handles mixed Japanese and English', () => {
    expect(slugifyStaffIdentifier('田中 Taro')).toBe('田中-taro')
  })

  it('decodes URL encoded strings', () => {
    expect(slugifyStaffIdentifier('%E7%94%B0%E4%B8%AD')).toBe('田中')
  })

  it('handles special characters', () => {
    expect(slugifyStaffIdentifier('John@Doe!')).toBe('john-doe')
  })

  it('normalizes full-width characters (NFKC)', () => {
    expect(slugifyStaffIdentifier('Ｊｏｈｎ')).toBe('john')
  })
})

describe('buildStaffIdentifier', () => {
  it('uses id when available', () => {
    const staff: StaffIdentifierSource = {
      id: 'staff-123',
      alias: 'alias',
      name: 'Name',
    }
    expect(buildStaffIdentifier(staff)).toBe('staff-123')
  })

  it('uses alias when id is not available', () => {
    const staff: StaffIdentifierSource = {
      id: null,
      alias: 'my-alias',
      name: 'Name',
    }
    expect(buildStaffIdentifier(staff)).toBe('my-alias')
  })

  it('uses name when id and alias are not available', () => {
    const staff: StaffIdentifierSource = {
      id: null,
      alias: null,
      name: 'John Doe',
    }
    expect(buildStaffIdentifier(staff)).toBe('john-doe')
  })

  it('uses fallback when all fields are empty', () => {
    const staff: StaffIdentifierSource = {
      id: null,
      alias: null,
      name: null,
    }
    expect(buildStaffIdentifier(staff, 'fallback-value')).toBe('fallback-value')
  })

  it('uses staff- prefix for numeric fallback', () => {
    const staff: StaffIdentifierSource = {
      id: null,
      alias: null,
      name: null,
    }
    expect(buildStaffIdentifier(staff, '123')).toBe('123')
  })

  it('returns staff as ultimate fallback', () => {
    const staff: StaffIdentifierSource = {
      id: null,
      alias: null,
      name: null,
    }
    expect(buildStaffIdentifier(staff)).toBe('staff')
  })

  it('skips empty id and uses next candidate', () => {
    const staff: StaffIdentifierSource = {
      id: '',
      alias: 'valid-alias',
      name: 'Name',
    }
    expect(buildStaffIdentifier(staff)).toBe('valid-alias')
  })
})

describe('staffMatchesIdentifier', () => {
  it('matches by id', () => {
    const staff: StaffIdentifierSource = {
      id: 'staff-123',
      alias: 'alias',
      name: 'Name',
    }
    expect(staffMatchesIdentifier(staff, 'staff-123')).toBe(true)
  })

  it('matches by alias', () => {
    const staff: StaffIdentifierSource = {
      id: 'staff-123',
      alias: 'my-alias',
      name: 'Name',
    }
    expect(staffMatchesIdentifier(staff, 'my-alias')).toBe(true)
  })

  it('matches by name', () => {
    const staff: StaffIdentifierSource = {
      id: 'staff-123',
      alias: 'alias',
      name: 'John Doe',
    }
    expect(staffMatchesIdentifier(staff, 'john-doe')).toBe(true)
  })

  it('does not match non-existent identifier', () => {
    const staff: StaffIdentifierSource = {
      id: 'staff-123',
      alias: 'alias',
      name: 'Name',
    }
    expect(staffMatchesIdentifier(staff, 'unknown')).toBe(false)
  })

  it('returns false for empty target', () => {
    const staff: StaffIdentifierSource = {
      id: 'staff-123',
      alias: 'alias',
      name: 'Name',
    }
    expect(staffMatchesIdentifier(staff, '')).toBe(false)
  })

  it('matches case-insensitively', () => {
    const staff: StaffIdentifierSource = {
      id: 'Staff-123',
      alias: null,
      name: null,
    }
    expect(staffMatchesIdentifier(staff, 'STAFF-123')).toBe(true)
  })

  it('handles URL-encoded targets', () => {
    const staff: StaffIdentifierSource = {
      id: null,
      alias: null,
      name: '田中',
    }
    expect(staffMatchesIdentifier(staff, '%E7%94%B0%E4%B8%AD')).toBe(true)
  })
})
