'use client'

import { forwardRef } from 'react'

import { cn } from '@/lib/utils'
import {
  type InstinctKind,
  instinctKindToLabel,
  instinctKindToEmoji,
  instinctKindClasses,
} from '@/tokens/theme'

// ============================================================================
// Types
// ============================================================================

export interface InstinctTagProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children'> {
  /** 本能タイプ */
  kind: InstinctKind
  /** カスタムラベル（省略時は instinctKindToLabel[kind] を使用） */
  label?: string
  /** カスタムアイコン（省略時は絵文字、null で非表示） */
  icon?: React.ReactNode | null
  /** 選択状態 */
  active?: boolean
  /** サイズバリアント */
  size?: 'sm' | 'md'
}

// ============================================================================
// Base Styles
// ============================================================================

const baseStyles = [
  'inline-flex items-center gap-1.5',
  'rounded-full border',
  'font-medium',
  'transition-all duration-200',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'select-none',
]

const sizeStyles = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
}

// ============================================================================
// Component
// ============================================================================

/**
 * InstinctTag - 本能タグコンポーネント
 *
 * Instinct OS の中核UIコンポーネント。
 * トグル可能なチップ型タグで、本能タイプに応じた色・アイコンを表示。
 *
 * @example
 * ```tsx
 * <InstinctTag kind="relax" active onClick={() => toggleInstinct('relax')} />
 * <InstinctTag kind="talk" label="おしゃべり" />
 * <InstinctTag kind="reset" icon={null} /> // アイコン非表示
 * ```
 */
export const InstinctTag = forwardRef<HTMLButtonElement, InstinctTagProps>(
  (
    {
      kind,
      label,
      icon,
      active = false,
      size = 'md',
      className,
      ...props
    },
    ref
  ) => {
    const displayLabel = label ?? instinctKindToLabel[kind]
    const displayIcon = icon === null ? null : (icon ?? instinctKindToEmoji[kind])
    const stateClasses = active
      ? instinctKindClasses[kind].active
      : instinctKindClasses[kind].inactive

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={active}
        data-instinct-kind={kind}
        data-active={active}
        className={cn(
          baseStyles,
          sizeStyles[size],
          stateClasses,
          // フォーカスリングの色を kind に合わせる
          kind === 'relax' && 'focus-visible:ring-emerald-400',
          kind === 'talk' && 'focus-visible:ring-orange-400',
          kind === 'reset' && 'focus-visible:ring-cyan-400',
          kind === 'excitement' && 'focus-visible:ring-rose-400',
          kind === 'healing' && 'focus-visible:ring-violet-400',
          kind === 'quiet' && 'focus-visible:ring-slate-400',
          className
        )}
        {...props}
      >
        {displayIcon !== null && (
          <span className="flex-shrink-0" aria-hidden="true">
            {displayIcon}
          </span>
        )}
        <span>{displayLabel}</span>
      </button>
    )
  }
)

InstinctTag.displayName = 'InstinctTag'

// ============================================================================
// Exports
// ============================================================================

export type { InstinctKind }
