import { describe, it, expect } from 'vitest'

import {
  RETRY_MESSAGE,
  RELOAD_MESSAGE,
  RESERVATION_ERRORS,
  SLOT_ERRORS,
  SHIFT_ERRORS,
  SHOP_ERRORS,
  THERAPIST_ERRORS,
  STAFF_ERRORS,
  NOTIFICATION_ERRORS,
  REVIEW_ERRORS,
  CONFLICT_ERRORS,
  createSlotConflictMessage,
  extractErrorMessage,
} from '../error-messages'

describe('error-messages', () => {
  describe('common messages', () => {
    it('defines RETRY_MESSAGE', () => {
      expect(RETRY_MESSAGE).toBe('時間をおいて再度お試しください。')
    })

    it('defines RELOAD_MESSAGE', () => {
      expect(RELOAD_MESSAGE).toBe('ページを更新して再度お試しください。')
    })
  })

  describe('RESERVATION_ERRORS', () => {
    it('defines all required error messages', () => {
      expect(RESERVATION_ERRORS.LIST_FETCH_FAILED).toContain('予約リスト')
      expect(RESERVATION_ERRORS.FETCH_FAILED).toContain('予約')
      expect(RESERVATION_ERRORS.UPDATE_FAILED).toContain('更新')
      expect(RESERVATION_ERRORS.SUBMIT_FAILED).toContain('送信')
      expect(RESERVATION_ERRORS.CREATE_FAILED).toContain('予約')
      expect(RESERVATION_ERRORS.LOAD_MORE_FAILED).toContain('追加')
      expect(RESERVATION_ERRORS.LOAD_PREVIOUS_FAILED).toContain('最新')
    })

    it('includes retry message in appropriate errors', () => {
      expect(RESERVATION_ERRORS.LIST_FETCH_FAILED).toContain(RETRY_MESSAGE)
      expect(RESERVATION_ERRORS.UPDATE_FAILED).toContain(RETRY_MESSAGE)
      expect(RESERVATION_ERRORS.CREATE_FAILED).toContain(RETRY_MESSAGE)
    })
  })

  describe('SLOT_ERRORS', () => {
    it('defines all required error messages', () => {
      expect(SLOT_ERRORS.AVAILABILITY_FETCH_FAILED).toContain('空き状況')
      expect(SLOT_ERRORS.SLOT_FETCH_FAILED).toContain('枠')
      expect(SLOT_ERRORS.CONFLICT_ALREADY_RESERVED).toContain('他のお客様')
      expect(SLOT_ERRORS.CONFLICT_PAST_SLOT).toContain('過ぎています')
      expect(SLOT_ERRORS.CONFLICT_VERIFICATION_FAILED).toContain('確認に失敗')
      expect(SLOT_ERRORS.CONFLICT_DEFAULT).toContain('予約できません')
    })
  })

  describe('SHIFT_ERRORS', () => {
    it('defines all required error messages', () => {
      expect(SHIFT_ERRORS.FETCH_FAILED).toContain('シフト')
      expect(SHIFT_ERRORS.CREATE_FAILED).toContain('作成')
      expect(SHIFT_ERRORS.UPDATE_FAILED).toContain('更新')
      expect(SHIFT_ERRORS.DELETE_FAILED).toContain('削除')
      expect(SHIFT_ERRORS.CONFLICT).toContain('重複')
    })
  })

  describe('SHOP_ERRORS', () => {
    it('defines all required error messages', () => {
      expect(SHOP_ERRORS.FETCH_FAILED).toContain('店舗情報')
      expect(SHOP_ERRORS.LIST_FETCH_FAILED).toContain('店舗一覧')
      expect(SHOP_ERRORS.DETAIL_FETCH_FAILED).toContain('店舗詳細')
      expect(SHOP_ERRORS.UPDATE_FAILED).toContain('更新')
    })
  })

  describe('THERAPIST_ERRORS', () => {
    it('defines all required error messages', () => {
      expect(THERAPIST_ERRORS.FETCH_FAILED).toContain('セラピスト情報')
      expect(THERAPIST_ERRORS.LIST_FETCH_FAILED).toContain('セラピスト')
      expect(THERAPIST_ERRORS.UPDATE_FAILED).toContain('更新')
    })
  })

  describe('STAFF_ERRORS', () => {
    it('defines all required error messages', () => {
      expect(STAFF_ERRORS.FETCH_FAILED).toContain('スタッフ')
      expect(STAFF_ERRORS.UPDATE_FAILED).toContain('更新')
      expect(STAFF_ERRORS.ADD_FORBIDDEN).toContain('権限')
    })
  })

  describe('NOTIFICATION_ERRORS', () => {
    it('defines all required error messages', () => {
      expect(NOTIFICATION_ERRORS.FETCH_FAILED).toContain('通知設定')
      expect(NOTIFICATION_ERRORS.UPDATE_FAILED).toContain('更新')
      expect(NOTIFICATION_ERRORS.REGISTER_FAILED).toContain('登録')
      expect(NOTIFICATION_ERRORS.REREGISTER_FAILED).toContain('再登録')
    })
  })

  describe('REVIEW_ERRORS', () => {
    it('defines all required error messages', () => {
      expect(REVIEW_ERRORS.FETCH_FAILED).toContain('口コミ')
      expect(REVIEW_ERRORS.STATS_FETCH_FAILED).toContain('統計')
      expect(REVIEW_ERRORS.STATUS_UPDATE_FAILED).toContain('ステータス')
      expect(REVIEW_ERRORS.UPDATE_STATUS_FAILED).toContain('ステータス')
    })
  })

  describe('CONFLICT_ERRORS', () => {
    it('defines all required error messages', () => {
      expect(CONFLICT_ERRORS.OTHER_USER_UPDATED).toContain('他のユーザー')
      expect(CONFLICT_ERRORS.RESERVATION_TIME_CONFLICT).toContain('重複')
    })
  })

  describe('createSlotConflictMessage', () => {
    it('returns message for already_reserved reason', () => {
      const message = createSlotConflictMessage('already_reserved')
      expect(message).toBe(SLOT_ERRORS.CONFLICT_ALREADY_RESERVED)
    })

    it('returns message for past_slot reason', () => {
      const message = createSlotConflictMessage('past_slot')
      expect(message).toBe(SLOT_ERRORS.CONFLICT_PAST_SLOT)
    })

    it('returns message for verification_failed reason', () => {
      const message = createSlotConflictMessage('verification_failed')
      expect(message).toBe(SLOT_ERRORS.CONFLICT_VERIFICATION_FAILED)
    })

    it('returns default message for unknown reason', () => {
      const message = createSlotConflictMessage('unknown')
      expect(message).toBe(SLOT_ERRORS.CONFLICT_DEFAULT)
    })

    it('returns default message when reason is undefined', () => {
      const message = createSlotConflictMessage()
      expect(message).toBe(SLOT_ERRORS.CONFLICT_DEFAULT)
    })
  })

  describe('extractErrorMessage', () => {
    it('extracts message from Error instance', () => {
      const error = new Error('Test error message')
      expect(extractErrorMessage(error, 'default')).toBe('Test error message')
    })

    it('extracts message property from object', () => {
      const error = { message: 'Object message' }
      expect(extractErrorMessage(error, 'default')).toBe('Object message')
    })

    it('extracts detail property from object', () => {
      const error = { detail: 'Detail message' }
      expect(extractErrorMessage(error, 'default')).toBe('Detail message')
    })

    it('prefers message over detail', () => {
      const error = { message: 'Message', detail: 'Detail' }
      expect(extractErrorMessage(error, 'default')).toBe('Message')
    })

    it('returns default message for null', () => {
      expect(extractErrorMessage(null, 'default')).toBe('default')
    })

    it('returns default message for undefined', () => {
      expect(extractErrorMessage(undefined, 'default')).toBe('default')
    })

    it('returns default message for string', () => {
      expect(extractErrorMessage('string error', 'default')).toBe('default')
    })

    it('returns default message for number', () => {
      expect(extractErrorMessage(123, 'default')).toBe('default')
    })

    it('returns default message for empty object', () => {
      expect(extractErrorMessage({}, 'default')).toBe('default')
    })
  })
})
