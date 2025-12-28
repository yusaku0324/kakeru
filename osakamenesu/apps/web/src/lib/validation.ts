/**
 * 共通バリデーション・フォーマットユーティリティ
 */

// --------------------
// UUID
// --------------------
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 文字列が有効なUUID形式かどうかを判定
 */
export function isValidUUID(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

// --------------------
// 電話番号
// --------------------

/**
 * 電話番号を日本のモバイル形式 (090-1234-5678) にフォーマット
 */
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
}

/**
 * 電話番号から数字のみを抽出
 */
export function extractPhoneDigits(phone: string): string {
  return phone.replace(/\D+/g, '')
}

export type PhoneValidationResult =
  | { valid: true }
  | { valid: false; error: 'empty' | 'too_short' | 'too_long' }

/**
 * 電話番号をバリデーション（10〜13桁）
 */
export function validatePhone(phone: string): PhoneValidationResult {
  const trimmed = phone.trim()
  if (!trimmed) {
    return { valid: false, error: 'empty' }
  }
  const digits = extractPhoneDigits(trimmed)
  if (digits.length < 10) {
    return { valid: false, error: 'too_short' }
  }
  if (digits.length > 13) {
    return { valid: false, error: 'too_long' }
  }
  return { valid: true }
}

// --------------------
// 名前
// --------------------

export type NameValidationResult =
  | { valid: true }
  | { valid: false; error: 'empty' | 'too_long' }

/**
 * 名前をバリデーション（1〜80文字）
 */
export function validateName(name: string, maxLength = 80): NameValidationResult {
  const trimmed = name.trim()
  if (!trimmed) {
    return { valid: false, error: 'empty' }
  }
  if (trimmed.length > maxLength) {
    return { valid: false, error: 'too_long' }
  }
  return { valid: true }
}

// --------------------
// メールアドレス
// --------------------

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type EmailValidationResult =
  | { valid: true }
  | { valid: false; error: 'invalid_format' }

/**
 * メールアドレスをバリデーション（空文字は有効とみなす）
 */
export function validateEmail(email: string): EmailValidationResult {
  const trimmed = email.trim()
  if (!trimmed) {
    return { valid: true } // 空はOK（任意項目）
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return { valid: false, error: 'invalid_format' }
  }
  return { valid: true }
}

/**
 * メールアドレスが必須の場合のバリデーション
 */
export function validateEmailRequired(
  email: string,
): EmailValidationResult | { valid: false; error: 'empty' } {
  const trimmed = email.trim()
  if (!trimmed) {
    return { valid: false, error: 'empty' }
  }
  return validateEmail(email)
}
