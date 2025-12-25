import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/lib/pwa'

export function OfflineIndicator() {
  const isOnline = useOnlineStatus()

  if (isOnline) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white px-4 py-2 z-50 shadow-md">
      <div className="container mx-auto flex items-center justify-center space-x-2 text-sm">
        <WifiOff className="h-4 w-4" />
        <span>オフラインです - 一部の機能が制限されています</span>
      </div>
    </div>
  )
}