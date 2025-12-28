/**
 * 共通エラーメッセージ定義
 *
 * UI全体で一貫したエラーメッセージを提供するための共通モジュール。
 * エラーメッセージを一箇所で管理することで:
 * - 一貫したユーザー体験を提供
 * - メッセージの更新が容易
 * - 重複コードの削減
 */

// ============================================================================
// 共通エラーメッセージ
// ============================================================================

/**
 * 汎用のリトライ促進メッセージ
 */
export const RETRY_MESSAGE = '時間をおいて再度お試しください。'

/**
 * ページリロード促進メッセージ
 */
export const RELOAD_MESSAGE = 'ページを更新して再度お試しください。'

// ============================================================================
// 予約関連エラーメッセージ
// ============================================================================

export const RESERVATION_ERRORS = {
  /** 予約リスト取得失敗 */
  LIST_FETCH_FAILED: `予約リストの取得に失敗しました。${RETRY_MESSAGE}`,
  /** 予約取得失敗 */
  FETCH_FAILED: `予約の取得に失敗しました`,
  /** 予約更新失敗 */
  UPDATE_FAILED: `予約の更新に失敗しました。${RETRY_MESSAGE}`,
  /** 予約送信失敗 */
  SUBMIT_FAILED: `予約の送信に失敗しました。しばらくしてから再度お試しください。`,
  /** 予約作成失敗 */
  CREATE_FAILED: `予約に失敗しました。${RETRY_MESSAGE}`,
  /** 追加予約取得失敗 */
  LOAD_MORE_FAILED: `追加の予約取得に失敗しました。${RETRY_MESSAGE}`,
  /** 最新予約取得失敗 */
  LOAD_PREVIOUS_FAILED: `最新の予約取得に失敗しました。${RETRY_MESSAGE}`,
} as const

// ============================================================================
// スロット・空き状況関連エラーメッセージ
// ============================================================================

export const SLOT_ERRORS = {
  /** 空き状況取得失敗 */
  AVAILABILITY_FETCH_FAILED: `空き状況の取得に失敗しました。${RETRY_MESSAGE}`,
  /** 枠取得失敗 */
  SLOT_FETCH_FAILED: `枠の取得に失敗しました。${RETRY_MESSAGE}`,
  /** 空き枠取得失敗 */
  EMPTY_SLOT_FETCH_FAILED: '空き枠の取得に失敗しました',
  /** スロット競合 - 他の予約あり */
  CONFLICT_ALREADY_RESERVED:
    '申し訳ございません。選択された時間は他のお客様により予約されました。別の時間をお選びください。',
  /** スロット競合 - 過去の時間 */
  CONFLICT_PAST_SLOT: '選択された時間は既に過ぎています。別の時間をお選びください。',
  /** スロット競合 - 検証失敗 */
  CONFLICT_VERIFICATION_FAILED: `空き状況の確認に失敗しました。${RELOAD_MESSAGE}`,
  /** スロット競合 - デフォルト */
  CONFLICT_DEFAULT: '選択された時間は予約できません。別の時間をお選びください。',
} as const

// ============================================================================
// シフト関連エラーメッセージ
// ============================================================================

export const SHIFT_ERRORS = {
  /** シフト情報取得失敗 */
  FETCH_FAILED: 'シフト情報の取得に失敗しました',
  /** シフト作成失敗 */
  CREATE_FAILED: 'シフトの作成に失敗しました',
  /** シフト更新失敗 */
  UPDATE_FAILED: 'シフトの更新に失敗しました',
  /** シフト削除失敗 */
  DELETE_FAILED: 'シフトの削除に失敗しました',
  /** シフト重複 */
  CONFLICT: 'シフトが重複しています',
} as const

// ============================================================================
// 店舗関連エラーメッセージ
// ============================================================================

export const SHOP_ERRORS = {
  /** 店舗情報取得失敗 */
  FETCH_FAILED: '店舗情報の取得に失敗しました',
  /** 店舗一覧取得失敗 */
  LIST_FETCH_FAILED: '店舗一覧の取得に失敗しました',
  /** 店舗詳細取得失敗 */
  DETAIL_FETCH_FAILED: '店舗詳細の取得に失敗しました',
  /** 店舗更新失敗 */
  UPDATE_FAILED: '店舗情報の更新に失敗しました',
} as const

// ============================================================================
// セラピスト関連エラーメッセージ
// ============================================================================

export const THERAPIST_ERRORS = {
  /** セラピスト情報取得失敗 */
  FETCH_FAILED: 'セラピスト情報の取得に失敗しました',
  /** セラピスト一覧取得失敗 */
  LIST_FETCH_FAILED: 'セラピストの取得に失敗しました',
  /** セラピスト更新失敗 */
  UPDATE_FAILED: 'セラピストの更新に失敗しました',
} as const

// ============================================================================
// スタッフ関連エラーメッセージ
// ============================================================================

export const STAFF_ERRORS = {
  /** スタッフ情報取得失敗 */
  FETCH_FAILED: 'スタッフ情報の取得に失敗しました',
  /** スタッフ更新失敗 */
  UPDATE_FAILED: 'スタッフ情報の更新に失敗しました',
  /** スタッフ追加権限なし */
  ADD_FORBIDDEN: 'スタッフを追加する権限がありません（オーナーのみ可能）',
} as const

// ============================================================================
// 通知関連エラーメッセージ
// ============================================================================

export const NOTIFICATION_ERRORS = {
  /** 通知設定取得失敗 */
  FETCH_FAILED: '通知設定の取得に失敗しました',
  /** 通知設定更新失敗 */
  UPDATE_FAILED: '通知設定の更新に失敗しました',
  /** 通知登録失敗 */
  REGISTER_FAILED: '通知の登録に失敗しました。再送信をお試しください。',
  /** 通知再登録失敗 */
  REREGISTER_FAILED: `通知の再登録に失敗しました。${RETRY_MESSAGE}`,
} as const

// ============================================================================
// 口コミ関連エラーメッセージ
// ============================================================================

export const REVIEW_ERRORS = {
  /** 口コミ取得失敗 */
  FETCH_FAILED: '口コミの取得に失敗しました',
  /** 口コミ統計取得失敗 */
  STATS_FETCH_FAILED: '口コミ統計の取得に失敗しました',
  /** 口コミステータス更新失敗 */
  STATUS_UPDATE_FAILED: '口コミのステータス更新に失敗しました',
  /** ステータス更新失敗 (汎用) */
  UPDATE_STATUS_FAILED: 'ステータスの更新に失敗しました',
} as const

// ============================================================================
// 競合エラーメッセージ
// ============================================================================

export const CONFLICT_ERRORS = {
  /** 他ユーザーによる更新競合 */
  OTHER_USER_UPDATED: '他のユーザーによって更新されました。再読み込みしてください。',
  /** 予約時間競合 */
  RESERVATION_TIME_CONFLICT: '他の予約と時間が重複しています。スケジュールをご確認ください。',
} as const

// ============================================================================
// ヘルパー関数
// ============================================================================

/**
 * スロット競合のエラーメッセージを生成する
 */
export function createSlotConflictMessage(reason?: string): string {
  switch (reason) {
    case 'already_reserved':
      return SLOT_ERRORS.CONFLICT_ALREADY_RESERVED
    case 'past_slot':
      return SLOT_ERRORS.CONFLICT_PAST_SLOT
    case 'verification_failed':
      return SLOT_ERRORS.CONFLICT_VERIFICATION_FAILED
    default:
      return SLOT_ERRORS.CONFLICT_DEFAULT
  }
}

/**
 * APIエラーレスポンスの detail フィールドの型定義
 */
export type ApiErrorDetail =
  | string
  | Array<{ msg?: string; message?: string; loc?: string[] }>
  | { msg?: string; message?: string }

/**
 * APIエラーレスポンスの型定義
 */
export type ApiErrorResponse = {
  detail?: ApiErrorDetail
  message?: string
  error?: string
  debug?: { rejected_reasons?: string[] }
}

/**
 * APIエラーの detail フィールドからメッセージを抽出する
 *
 * FastAPI のバリデーションエラーなど、様々な形式に対応:
 * - 文字列: そのまま返す
 * - 配列: 各要素の msg を結合
 * - オブジェクト: msg または message を返す
 */
export function extractDetailMessage(detail: ApiErrorDetail | undefined): string | null {
  if (!detail) return null

  // 文字列の場合
  if (typeof detail === 'string') {
    return detail
  }

  // 配列の場合（FastAPI バリデーションエラー形式）
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => item?.msg || item?.message)
      .filter((msg): msg is string => typeof msg === 'string')
    return messages.length > 0 ? messages.join('\n') : null
  }

  // オブジェクトの場合
  if (typeof detail === 'object' && detail !== null) {
    return detail.msg || detail.message || null
  }

  return null
}

/**
 * APIエラーレスポンスからエラーメッセージを抽出する
 *
 * 優先順位:
 * 1. detail フィールド（様々な形式に対応）
 * 2. message フィールド
 * 3. error フィールド
 * 4. Error インスタンスの message
 * 5. デフォルトメッセージ
 */
export function extractErrorMessage(
  error: unknown,
  defaultMessage: string,
): string {
  // Error インスタンスの場合
  if (error instanceof Error) {
    return error.message
  }

  // オブジェクトの場合
  if (typeof error === 'object' && error !== null) {
    const obj = error as ApiErrorResponse

    // detail フィールドを最優先
    const detailMessage = extractDetailMessage(obj.detail)
    if (detailMessage) return detailMessage

    // その他のフィールド
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.error === 'string') return obj.error
  }

  return defaultMessage
}

/**
 * 予約拒否理由のメッセージマッピング
 * バックエンドから返される拒否理由をユーザー向けメッセージに変換
 */
export const REJECTION_REASON_MESSAGES: Record<string, string> = {
  // スロット競合関連
  slot_conflict: SLOT_ERRORS.CONFLICT_ALREADY_RESERVED,
  overlap_existing_reservation: 'その時間帯は既に予約が入っています',
  past_slot: SLOT_ERRORS.CONFLICT_PAST_SLOT,

  // 可用性関連
  no_availability: '選択された時間は予約を受け付けていません。',
  no_available_therapist: '選択した時間帯に対応可能なセラピストがいません',
  therapist_unavailable: 'セラピストがその時間は対応できません',
  staff_unavailable: '担当スタッフが対応できません。別の時間をお選びください。',

  // 営業・施設関連
  shop_closed: '選択された時間は営業時間外です。',
  outside_business_hours: '営業時間外です',
  room_full: '満室のため予約できません',
  shop_not_found: 'この店舗は現在予約を受け付けていません。',

  // 予約ルール関連
  deadline_over: '予約締め切り時間を過ぎています（1時間以上前にご予約ください）',

  // システムエラー
  internal_error: `システムエラーが発生しました。${RETRY_MESSAGE}`,
} as const

/**
 * デフォルトの拒否メッセージ
 */
export const DEFAULT_REJECTION_MESSAGE = '予約を受け付けられませんでした。別の時間帯をお試しください。'

/**
 * 予約拒否理由からユーザー向けメッセージを生成する
 */
export function createRejectionMessage(reasons: string[] | undefined): string {
  if (!reasons || reasons.length === 0) {
    return RESERVATION_ERRORS.CREATE_FAILED
  }

  const messages = reasons
    .map((reason) => REJECTION_REASON_MESSAGES[reason])
    .filter((msg): msg is string => !!msg)

  return messages.length > 0 ? messages[0] : RESERVATION_ERRORS.CREATE_FAILED
}

/**
 * 複数の拒否理由をまとめてメッセージに変換する
 * 改行区切りで複数のメッセージを返す
 */
export function formatRejectionReasons(reasons: string[] | undefined): string {
  if (!reasons || reasons.length === 0) {
    return DEFAULT_REJECTION_MESSAGE
  }

  const messages = reasons
    .map((reason) => REJECTION_REASON_MESSAGES[reason] ?? reason)
    .filter(Boolean)

  return messages.length > 0 ? messages.join('\n') : DEFAULT_REJECTION_MESSAGE
}
