'use client'

import { useEffect } from 'react'
import { initWebVitals } from '@/lib/performance/web-vitals'
import { initializePerformanceOptimizations } from '@/lib/performance/dynamic-imports'
import { adaptiveFontLoading } from '@/lib/performance/font-optimization'

export default function PerformanceInitializer() {
  useEffect(() => {
    // Initialize Web Vitals monitoring
    initWebVitals().catch(console.error)

    // Initialize dynamic imports and preloading
    initializePerformanceOptimizations()

    // Initialize adaptive font loading
    adaptiveFontLoading().catch(console.error)

    // Cleanup on unmount
    return () => {
      // Cleanup is handled internally by each module
    }
  }, [])

  // This component doesn't render anything
  return null
}