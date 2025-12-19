'use client'

/**
 * Slot verification API client
 *
 * Calls the verify_slot endpoint to check if a slot is still available
 * before submitting a reservation.
 */

export type SlotVerificationResult =
  | {
      isAvailable: true
      status: 'open'
      verifiedAt: string
    }
  | {
      isAvailable: false
      status: 'blocked' | 'tentative'
      conflictedAt: string
      reason?: string
    }

export type SlotConflictError = {
  message: string
  slotStart: string
  currentStatus: string
  conflictedAt: string
}

/**
 * Verify if a slot is still available for booking.
 *
 * @param therapistId - The therapist UUID
 * @param startAt - The slot start time in ISO format
 * @returns Verification result indicating availability
 */
export async function verifySlot(
  therapistId: string,
  startAt: string,
): Promise<SlotVerificationResult> {
  const params = new URLSearchParams({ start_at: startAt })
  const url = `/api/guest/therapists/${therapistId}/verify_slot?${params.toString()}`

  const resp = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  if (resp.ok) {
    const data = await resp.json()
    return {
      isAvailable: data.is_available ?? true,
      status: data.status ?? 'open',
      verifiedAt: data.verified_at ?? new Date().toISOString(),
    }
  }

  if (resp.status === 409) {
    const data = await resp.json()
    const detail = data.detail ?? {}
    return {
      isAvailable: false,
      status: detail.status ?? 'blocked',
      conflictedAt: detail.conflicted_at ?? new Date().toISOString(),
      reason: detail.reason ?? 'already_reserved',
    }
  }

  // For other errors, treat as unavailable
  return {
    isAvailable: false,
    status: 'blocked',
    conflictedAt: new Date().toISOString(),
    reason: 'verification_failed',
  }
}

/**
 * Create a user-friendly error message for slot conflicts.
 */
export function createConflictErrorMessage(reason?: string): string {
  switch (reason) {
    case 'already_reserved':
      return '申し訳ございません。選択された時間は他のお客様により予約されました。別の時間をお選びください。'
    case 'past_slot':
      return '選択された時間は既に過ぎています。別の時間をお選びください。'
    case 'verification_failed':
      return '空き状況の確認に失敗しました。ページを更新して再度お試しください。'
    default:
      return '選択された時間は予約できません。別の時間をお選びください。'
  }
}
