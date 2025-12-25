'use client'

import { useEffect, useState, useCallback } from 'react'
import { registerServiceWorker, useInstallPWA, useOnlineStatus } from '@/lib/pwa'

/**
 * PWA Provider Component
 * Handles Service Worker registration and install prompts
 */
export default function PWAProvider() {
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const { isInstallable, isInstalled, isIOS, install } = useInstallPWA()
  const isOnline = useOnlineStatus()

  // Register Service Worker on mount
  useEffect(() => {
    registerServiceWorker()
  }, [])

  // Check if banner was previously dismissed
  useEffect(() => {
    const wasDismissed = localStorage.getItem('pwa-install-dismissed')
    if (wasDismissed) {
      const dismissedAt = parseInt(wasDismissed, 10)
      const daysSinceDismissed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        setDismissed(true)
      }
    }
  }, [])

  // Show install banner when installable
  useEffect(() => {
    if (isInstallable && !isInstalled && !dismissed) {
      // Delay showing banner to avoid interrupting initial page load
      const timer = setTimeout(() => {
        setShowInstallBanner(true)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isInstallable, isInstalled, dismissed])

  // Show iOS instructions when on iOS and not installed
  useEffect(() => {
    if (isIOS && !isInstalled && !dismissed) {
      const timer = setTimeout(() => {
        setShowIOSInstructions(true)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [isIOS, isInstalled, dismissed])

  const handleInstall = useCallback(async () => {
    const success = await install()
    if (success) {
      setShowInstallBanner(false)
    }
  }, [install])

  const handleDismiss = useCallback(() => {
    setShowInstallBanner(false)
    setShowIOSInstructions(false)
    setDismissed(true)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }, [])

  // Offline indicator
  if (!isOnline) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
        <div className="rounded-lg bg-amber-500 px-4 py-3 text-white shadow-lg">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
            </svg>
            <span className="text-sm font-medium">オフラインです</span>
          </div>
        </div>
      </div>
    )
  }

  // Install banner for Android/Desktop
  if (showInstallBanner) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
        <div className="rounded-xl bg-white px-4 py-4 shadow-xl ring-1 ring-black/5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-white">
              ✦
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-neutral-text">アプリをインストール</p>
              <p className="mt-1 text-sm text-neutral-textMuted">
                ホーム画面に追加して、より快適にご利用いただけます
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleInstall}
                  className="rounded-lg bg-gradient-to-r from-brand-primary to-brand-secondary px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
                >
                  インストール
                </button>
                <button
                  onClick={handleDismiss}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-textMuted hover:text-neutral-text transition-colors"
                >
                  後で
                </button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="shrink-0 text-neutral-textMuted hover:text-neutral-text transition-colors"
              aria-label="閉じる"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // iOS instructions
  if (showIOSInstructions) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
        <div className="rounded-xl bg-white px-4 py-4 shadow-xl ring-1 ring-black/5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-white">
              ✦
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-neutral-text">アプリをインストール</p>
              <p className="mt-1 text-sm text-neutral-textMuted">
                Safariの共有ボタン
                <svg className="inline-block mx-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                から「ホーム画面に追加」を選択してください
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="shrink-0 text-neutral-textMuted hover:text-neutral-text transition-colors"
              aria-label="閉じる"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
