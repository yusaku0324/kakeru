/**
 * Instinct OS Design Tokens
 *
 * 本能ベースのマッチングOS用デザイントークン定義
 * - 都市型ウェルネス / ライフスタイルメディアの雰囲気
 * - AIスロップUI禁止 / 風俗サイト風禁止
 *
 * @see docs/skills/frontend-design-instinct-os/SKILL.md
 */

// ============================================================================
// Spacing & Layout
// ============================================================================

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
} as const

export const radius = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  full: '9999px',
} as const

export const shadow = {
  /** 柔らかい影 - カード・ボタンなど */
  soft: '0 2px 8px rgba(28, 25, 23, 0.08)',
  /** 控えめな影 - ホバー・選択状態 */
  subtle: '0 4px 12px rgba(28, 25, 23, 0.12)',
  /** 内側の影 - インプット・押下状態 */
  inner: 'inset 0 1px 2px rgba(28, 25, 23, 0.06)',
} as const

// ============================================================================
// Colors
// ============================================================================

export const color = {
  base: {
    /** メイン背景 - warm white */
    bg: '#FAFAF9',
    /** サブ背景 - stone-100 */
    bgMuted: '#F5F5F4',
    /** サーフェス - 白 */
    surface: '#FFFFFF',
    /** サブサーフェス */
    surfaceMuted: '#FAFAF8',
  },
  text: {
    /** メインテキスト - stone-900 */
    textMain: '#1C1917',
    /** サブテキスト - stone-600 */
    textMuted: '#57534E',
    /** 薄いテキスト - stone-400 */
    textSoft: '#A8A29E',
  },
  accent: {
    /** プライマリアクセント - blue-500 */
    accent: '#3B82F6',
    /** 薄いアクセント - blue-100 */
    accentSoft: '#DBEAFE',
    /** 強いアクセント - blue-700 */
    accentStrong: '#1D4ED8',
  },
  border: {
    /** 薄いボーダー - stone-200 */
    borderSoft: '#E7E5E4',
    /** 強いボーダー - stone-300 */
    borderStrong: '#D6D3D1',
  },
} as const

// ============================================================================
// Instinct System
// ============================================================================

/**
 * 本能タイプ定義
 * Instinct OSの中核となる本能分類
 */
export type InstinctKind =
  | 'relax' // とにかく癒されたい
  | 'talk' // たくさん喋りたい
  | 'reset' // 静かにととのいたい
  | 'excitement' // 少しドキドキ・非日常
  | 'healing' // 心のケア・寄り添い
  | 'quiet' // 静かに過ごしたい

/**
 * 本能タイプ → 日本語ラベル
 */
export const instinctKindToLabel: Record<InstinctKind, string> = {
  relax: 'とにかく癒されたい',
  talk: 'たくさん喋りたい',
  reset: '静かにととのいたい',
  excitement: '少しドキドキ・非日常',
  healing: '心のケア・寄り添い',
  quiet: '静かに過ごしたい',
} as const

/**
 * 本能タイプ → 絵文字アイコン
 */
export const instinctKindToEmoji: Record<InstinctKind, string> = {
  relax: '\u{1F33F}', // 🌿
  talk: '\u{1F4AC}', // 💬
  reset: '\u{1F9D6}', // 🧖
  excitement: '\u{2728}', // ✨
  healing: '\u{1F91D}', // 🤝
  quiet: '\u{1F319}', // 🌙
} as const

/**
 * 本能タイプ → Tailwind クラス (active / inactive)
 *
 * active: 選択状態（濃いめBG + テキスト色 + subtle shadow）
 * inactive: 非選択状態（薄いBG + ボーダー + 薄いテキスト）
 */
export const instinctKindClasses: Record<
  InstinctKind,
  { active: string; inactive: string }
> = {
  relax: {
    active:
      'bg-emerald-100 text-emerald-700 border-emerald-300 shadow-sm',
    inactive:
      'bg-emerald-50/60 text-emerald-600/70 border-emerald-200/60 hover:bg-emerald-50 hover:border-emerald-300',
  },
  talk: {
    active:
      'bg-orange-100 text-orange-700 border-orange-300 shadow-sm',
    inactive:
      'bg-orange-50/60 text-orange-600/70 border-orange-200/60 hover:bg-orange-50 hover:border-orange-300',
  },
  reset: {
    active:
      'bg-cyan-100 text-cyan-700 border-cyan-300 shadow-sm',
    inactive:
      'bg-cyan-50/60 text-cyan-600/70 border-cyan-200/60 hover:bg-cyan-50 hover:border-cyan-300',
  },
  excitement: {
    active:
      'bg-rose-100 text-rose-700 border-rose-300 shadow-sm',
    inactive:
      'bg-rose-50/60 text-rose-600/70 border-rose-200/60 hover:bg-rose-50 hover:border-rose-300',
  },
  healing: {
    active:
      'bg-violet-100 text-violet-700 border-violet-300 shadow-sm',
    inactive:
      'bg-violet-50/60 text-violet-600/70 border-violet-200/60 hover:bg-violet-50 hover:border-violet-300',
  },
  quiet: {
    active:
      'bg-slate-200 text-slate-700 border-slate-400 shadow-sm',
    inactive:
      'bg-slate-100/60 text-slate-500/70 border-slate-200/60 hover:bg-slate-100 hover:border-slate-300',
  },
} as const

/**
 * 全Instinct種別の配列（イテレーション用）
 */
export const INSTINCT_KINDS: InstinctKind[] = [
  'relax',
  'talk',
  'reset',
  'excitement',
  'healing',
  'quiet',
] as const

// ============================================================================
// Theme Object (統合)
// ============================================================================

export const theme = {
  spacing,
  radius,
  shadow,
  color,
  instinct: {
    kinds: INSTINCT_KINDS,
    labels: instinctKindToLabel,
    emojis: instinctKindToEmoji,
    classes: instinctKindClasses,
  },
} as const

export type Theme = typeof theme
