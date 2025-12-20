'use client'

import { useCallback, useEffect, useId, useRef } from 'react'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '確認',
  cancelLabel = 'キャンセル',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const previousActiveElement = useRef<Element | null>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      // Store the currently focused element to restore later
      previousActiveElement.current = document.activeElement
      dialog.showModal()
      // Focus the cancel button (safer default action)
      cancelButtonRef.current?.focus()
    } else {
      dialog.close()
      // Restore focus to the previously focused element
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus()
      }
    }
  }, [open])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onCancel()
      }
    },
    [onCancel]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    },
    [onCancel]
  )

  if (!open) return null

  const buttonBaseClass =
    'rounded px-4 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto rounded-lg border border-neutral-borderLight bg-white p-0 shadow-xl backdrop:bg-black/50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div className="min-w-[300px] max-w-md p-4" role="document">
        <h2 id={titleId} className="mb-2 text-lg font-semibold text-neutral-text">
          {title}
        </h2>
        <p id={descId} className="mb-4 text-sm text-neutral-textMuted">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className={`${buttonBaseClass} border border-neutral-borderLight bg-white hover:bg-neutral-50 focus-visible:outline-neutral-400`}
            aria-label={cancelLabel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`${buttonBaseClass} text-white ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-500'
                : 'bg-brand-primary hover:brightness-110 focus-visible:outline-brand-primary'
            }`}
            aria-label={confirmLabel}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
