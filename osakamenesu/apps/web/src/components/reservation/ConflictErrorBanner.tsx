'use client'

import { useEffect, useState } from 'react'

export type ConflictError = {
  message: string
  slotStart: string
  showUntil: number // Unix timestamp in ms
}

type ConflictErrorBannerProps = {
  error: ConflictError | null
  onDismiss: () => void
}

/**
 * Banner component that displays slot conflict errors.
 * Auto-dismisses after the showUntil time is reached.
 */
export function ConflictErrorBanner({ error, onDismiss }: ConflictErrorBannerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!error) {
      setVisible(false)
      return
    }

    // Show the banner
    setVisible(true)

    // Calculate remaining time until auto-dismiss
    const now = Date.now()
    const remaining = error.showUntil - now

    if (remaining <= 0) {
      setVisible(false)
      onDismiss()
      return
    }

    // Set up auto-dismiss timer
    const timer = setTimeout(() => {
      setVisible(false)
      onDismiss()
    }, remaining)

    return () => clearTimeout(timer)
  }, [error, onDismiss])

  if (!visible || !error) {
    return null
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="animate-in slide-in-from-top-2 fade-in flex items-start gap-3 rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-red-50/80 px-4 py-3 shadow-lg duration-300"
    >
      <div className="flex-shrink-0 pt-0.5">
        <svg
          className="h-5 w-5 text-red-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-red-800">{error.message}</p>
        <p className="mt-1 text-xs text-red-600/80">
          カレンダーを更新しました。別の時間をお選びください。
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 rounded-lg p-1 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
        aria-label="閉じる"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
