'use client'
import React, { useCallback, useRef, useState } from 'react'

export type ToastMessage = {
  id: number
  type: 'success' | 'error'
  message: string
  actionLabel?: string
  onAction?: () => void | Promise<void>
}

type ToastOptions =
  | number
  | {
      ttl?: number
      actionLabel?: string
      onAction?: () => void | Promise<void>
    }

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const nextIdRef = useRef(1)

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (type: ToastMessage['type'], message: string, options?: ToastOptions) => {
      const opts = typeof options === 'number' ? { ttl: options } : (options ?? {})
      const ttl = opts.ttl ?? 4000
      setToasts((prev) => {
        const id = nextIdRef.current++
        const next = [
          ...prev,
          { id, type, message, actionLabel: opts.actionLabel, onAction: opts.onAction },
        ]
        if (ttl > 0) {
          window.setTimeout(() => remove(id), ttl)
        }
        return next
      })
    },
    [remove],
  )

  return {
    toasts,
    push,
    remove,
  }
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[]
  onDismiss: (id: number) => void
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`max-w-xs rounded-lg px-4 py-3 shadow-lg text-sm border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}
        >
          <div className="flex items-start gap-2">
            <span className="font-semibold text-xs uppercase tracking-wide">
              {toast.type === 'success' ? 'Success' : 'Error'}
            </span>
            <button
              className="ml-auto text-xs opacity-60 hover:opacity-100"
              onClick={() => onDismiss(toast.id)}
            >
              ×
            </button>
          </div>
          <p className="mt-1 leading-relaxed">{toast.message}</p>
          {toast.actionLabel ? (
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white hover:text-white"
              onClick={() => {
                void toast.onAction?.()
                onDismiss(toast.id)
              }}
            >
              {toast.actionLabel}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}
