import clsx, { type ClassValue } from 'clsx'

/**
 * Tailwind CSS クラス名を結合するユーティリティ
 *
 * clsx をラップし、型安全なクラス名結合を提供
 *
 * @example
 * cn('base-class', condition && 'conditional-class', { 'object-class': true })
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}
