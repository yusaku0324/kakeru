import { useState, useEffect } from 'react'
import { X, Download, Smartphone } from 'lucide-react'
import { useInstallPWA } from '@/lib/pwa'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function InstallPrompt() {
  const { isInstallable, isInstalled, isIOS, install } = useInstallPWA()
  const [showPrompt, setShowPrompt] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if user has previously dismissed the prompt
    const hasDissmissed = localStorage.getItem('pwa-install-dismissed')
    if (hasDissmissed) {
      setDismissed(true)
    }

    // Show prompt after 30 seconds if installable
    const timer = setTimeout(() => {
      if (isInstallable && !hasDissmissed && !isInstalled) {
        setShowPrompt(true)
      }
    }, 30000)

    return () => clearTimeout(timer)
  }, [isInstallable, isInstalled])

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true)
      return
    }

    const success = await install()
    if (success) {
      setShowPrompt(false)
      // Track installation
      if (window.gtag) {
        window.gtag('event', 'pwa_installed', {
          event_category: 'engagement',
        })
      }
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    setDismissed(true)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  // Don't show if already installed or dismissed
  if (isInstalled || dismissed || (!isInstallable && !isIOS)) {
    return null
  }

  return (
    <>
      {/* Install Banner */}
      {showPrompt && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50 animate-in slide-in-from-bottom-5">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-pink-600" />
              </div>
            </div>

            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                アプリをインストール
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                ホーム画面に追加して、アプリのように使えます。オフラインでも一部機能が利用可能です。
              </p>

              <div className="mt-3 flex space-x-3">
                <Button onClick={handleInstall} size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  インストール
                </Button>
                <Button
                  onClick={handleDismiss}
                  variant="outline"
                  size="sm"
                >
                  後で
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* iOS Installation Guide */}
      <Dialog open={showIOSGuide} onOpenChange={setShowIOSGuide}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>iOSでのインストール方法</DialogTitle>
            <DialogDescription>
              以下の手順でホーム画面に追加できます
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center text-sm font-semibold text-pink-600">
                1
              </div>
              <p className="text-sm text-gray-600">
                Safariの下部にある共有ボタン
                <span className="inline-block mx-1">
                  <svg className="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="8" y="10" width="8" height="10" rx="1" />
                    <path d="M12 2v8m0 0l3-3m-3 3l-3-3" />
                  </svg>
                </span>
                をタップ
              </p>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center text-sm font-semibold text-pink-600">
                2
              </div>
              <p className="text-sm text-gray-600">
                「ホーム画面に追加」をタップ
              </p>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center text-sm font-semibold text-pink-600">
                3
              </div>
              <p className="text-sm text-gray-600">
                右上の「追加」をタップして完了
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              ※ iOSではSafariブラウザからのみインストール可能です
            </p>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={() => setShowIOSGuide(false)}>
              閉じる
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}