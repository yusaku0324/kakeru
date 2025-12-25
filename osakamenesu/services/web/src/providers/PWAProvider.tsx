'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/pwa'
import { syncManager } from '@/lib/offline/sync'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator'

interface PWAProviderProps {
  children: React.ReactNode
}

export function PWAProvider({ children }: PWAProviderProps) {
  useEffect(() => {
    // Register service worker
    registerServiceWorker()

    // Start offline sync
    syncManager.startPeriodicSync()

    // Cleanup
    return () => {
      syncManager.stopPeriodicSync()
    }
  }, [])

  return (
    <>
      {children}
      <OfflineIndicator />
      <InstallPrompt />
    </>
  )
}