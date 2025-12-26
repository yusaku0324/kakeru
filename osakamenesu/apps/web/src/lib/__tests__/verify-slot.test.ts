import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verifySlot, createConflictErrorMessage } from '../verify-slot'

describe('createConflictErrorMessage', () => {
  it('returns message for already_reserved reason', () => {
    const message = createConflictErrorMessage('already_reserved')
    expect(message).toContain('他のお客様により予約されました')
  })

  it('returns message for past_slot reason', () => {
    const message = createConflictErrorMessage('past_slot')
    expect(message).toContain('既に過ぎています')
  })

  it('returns message for verification_failed reason', () => {
    const message = createConflictErrorMessage('verification_failed')
    expect(message).toContain('確認に失敗しました')
  })

  it('returns default message for unknown reason', () => {
    const message = createConflictErrorMessage('unknown_reason')
    expect(message).toContain('予約できません')
  })

  it('returns default message when reason is undefined', () => {
    const message = createConflictErrorMessage()
    expect(message).toContain('予約できません')
  })
})

describe('verifySlot', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns available status on successful response', async () => {
    const mockResponse = {
      is_available: true,
      status: 'open',
      verified_at: '2024-01-15T10:00:00Z',
    }
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const result = await verifySlot('therapist-123', '2024-01-15T10:00:00Z')

    expect(result.isAvailable).toBe(true)
    expect(result.status).toBe('open')
    if (result.isAvailable) {
      expect(result.verifiedAt).toBe('2024-01-15T10:00:00Z')
    }
  })

  it('returns unavailable status on 409 conflict response', async () => {
    const mockResponse = {
      detail: {
        status: 'blocked',
        conflicted_at: '2024-01-15T10:00:00Z',
        reason: 'already_reserved',
      },
    }
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve(mockResponse),
    })

    const result = await verifySlot('therapist-123', '2024-01-15T10:00:00Z')

    expect(result.isAvailable).toBe(false)
    expect(result.status).toBe('blocked')
    expect('reason' in result && result.reason).toBe('already_reserved')
  })

  it('returns unavailable with verification_failed on other errors', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    })

    const result = await verifySlot('therapist-123', '2024-01-15T10:00:00Z')

    expect(result.isAvailable).toBe(false)
    expect(result.status).toBe('blocked')
    expect('reason' in result && result.reason).toBe('verification_failed')
  })

  it('constructs correct URL with query params', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ is_available: true }),
    })

    await verifySlot('therapist-abc', '2024-01-20T15:00:00Z')

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/guest/therapists/therapist-abc/verify_slot?start_at=2024-01-20T15%3A00%3A00Z',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
    )
  })

  it('handles missing fields in successful response', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })

    const result = await verifySlot('therapist-123', '2024-01-15T10:00:00Z')

    expect(result.isAvailable).toBe(true)
    expect(result.status).toBe('open')
  })

  it('handles missing detail in 409 response', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({}),
    })

    const result = await verifySlot('therapist-123', '2024-01-15T10:00:00Z')

    expect(result.isAvailable).toBe(false)
    expect(result.status).toBe('blocked')
  })
})
