'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X, SlidersHorizontal } from 'lucide-react'
import clsx from 'clsx'

type Props = {
  isOpen: boolean
  onClose: () => void
  onApply: () => void
  resultCount?: number
  resultUnit?: string
  activeFilterCount?: number
  children: ReactNode
}

export function MobileFilterDrawer({
  isOpen,
  onClose,
  onApply,
  resultCount,
  resultUnit = '件',
  activeFilterCount = 0,
  children,
}: Props) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const numberFormatter = new Intl.NumberFormat('ja-JP')

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Focus trap
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      const focusableElements = drawerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0] as HTMLElement
      firstElement?.focus()
    }
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        className={clsx(
          'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="検索フィルター"
        className={clsx(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out md:hidden',
          isOpen ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        {/* Handle bar */}
        <div className="flex justify-center pb-2 pt-3">
          <div className="h-1 w-10 rounded-full bg-neutral-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-brand-primary" />
            <h2 className="text-base font-bold text-neutral-text">絞り込み</h2>
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="フィルターを閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-100 bg-white px-4 py-3 pb-safe">
          <div className="flex items-center gap-3">
            {typeof resultCount === 'number' && (
              <span className="flex-shrink-0 text-sm font-medium text-neutral-600">
                {numberFormatter.format(resultCount)}
                {resultUnit}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                onApply()
                onClose()
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary py-3.5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(37,99,235,0.3)] transition-all duration-150 active:scale-[0.98]"
            >
              この条件で検索する
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default MobileFilterDrawer
