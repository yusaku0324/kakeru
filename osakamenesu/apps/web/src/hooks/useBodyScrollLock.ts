'use client'

import { useEffect, useRef } from 'react'

/**
 * Body scroll lock hook - prevents page scrolling when modal is open
 *
 * Fixes: Screen freeze issue when closing reservation overlay
 * The issue was that cleanup wasn't always running properly when
 * the component unmounts before the effect cleanup could run.
 */
export function useBodyScrollLock(active: boolean) {
  const originalOverflowRef = useRef<string>('')
  const isLockedRef = useRef(false)

  useEffect(() => {
    if (active && !isLockedRef.current) {
      // Lock: save current overflow and hide
      originalOverflowRef.current = document.body.style.overflow || ''
      document.body.style.overflow = 'hidden'
      isLockedRef.current = true
    } else if (!active && isLockedRef.current) {
      // Unlock: restore original overflow
      document.body.style.overflow = originalOverflowRef.current
      isLockedRef.current = false
    }

    // Cleanup function - always unlock on unmount
    return () => {
      if (isLockedRef.current) {
        document.body.style.overflow = originalOverflowRef.current
        isLockedRef.current = false
      }
    }
  }, [active])

  // Additional cleanup on component unmount (safety net)
  useEffect(() => {
    return () => {
      // Force unlock on unmount regardless of state
      if (document.body.style.overflow === 'hidden') {
        document.body.style.overflow = ''
      }
    }
  }, [])
}
