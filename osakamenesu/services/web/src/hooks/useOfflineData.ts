/**
 * Hook for offline-capable data fetching
 */

import { useEffect, useState } from 'react'
import useSWR, { SWRConfiguration, SWRResponse } from 'swr'
import { useOnlineStatus } from '@/lib/pwa'
import {
  cacheShopData,
  cacheTherapistData,
  getCachedShops,
  getCachedTherapists,
} from '@/lib/offline/sync'

interface UseOfflineDataOptions extends SWRConfiguration {
  fallbackData?: any
  cacheKey?: string
  cacheDuration?: number
}

/**
 * SWR fetcher with offline support
 */
const offlineFetcher = async (url: string) => {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  } catch (error) {
    // If offline, return null to trigger fallback
    if (!navigator.onLine) {
      return null
    }
    throw error
  }
}

/**
 * Hook for fetching data with offline support
 */
export function useOfflineData<T = any>(
  key: string | null,
  options?: UseOfflineDataOptions
): SWRResponse<T> & { isOffline: boolean } {
  const isOnline = useOnlineStatus()
  const [offlineData, setOfflineData] = useState<T | null>(null)

  const swrResult = useSWR<T>(key, offlineFetcher, {
    ...options,
    revalidateOnFocus: isOnline,
    revalidateOnReconnect: true,
    shouldRetryOnError: isOnline,
  })

  // Load offline data when offline
  useEffect(() => {
    if (!isOnline && key) {
      loadOfflineData(key).then(setOfflineData)
    }
  }, [isOnline, key])

  // Cache data when online
  useEffect(() => {
    if (isOnline && swrResult.data && key) {
      cacheDataForOffline(key, swrResult.data)
    }
  }, [isOnline, swrResult.data, key])

  return {
    ...swrResult,
    data: !isOnline && offlineData ? offlineData : swrResult.data,
    isOffline: !isOnline,
  }
}

/**
 * Hook for shops with offline support
 */
export function useOfflineShops(area?: string) {
  const { data, error, isLoading, mutate, isOffline } = useOfflineData(
    area ? `/api/v1/shops?area=${area}` : '/api/v1/shops'
  )

  useEffect(() => {
    // Cache shops data when loaded
    if (data?.shops && !isOffline) {
      cacheShopData(
        data.shops.map((shop: any) => ({
          id: shop.id,
          name: shop.name,
          area: shop.area,
          imageUrl: shop.imageUrl,
          rating: shop.rating,
          reviewCount: shop.reviewCount,
        }))
      )
    }
  }, [data, isOffline])

  // Load from cache when offline
  useEffect(() => {
    if (isOffline && !data) {
      getCachedShops(area).then(shops => {
        if (shops.length > 0) {
          mutate({ shops }, false)
        }
      })
    }
  }, [isOffline, data, area, mutate])

  return {
    shops: data?.shops || [],
    isLoading,
    isError: error,
    isOffline,
    mutate,
  }
}

/**
 * Hook for therapists with offline support
 */
export function useOfflineTherapists(shopId: string) {
  const { data, error, isLoading, mutate, isOffline } = useOfflineData(
    shopId ? `/api/v1/shops/${shopId}/therapists` : null
  )

  useEffect(() => {
    // Cache therapists data when loaded
    if (data?.therapists && !isOffline) {
      cacheTherapistData(
        data.therapists.map((therapist: any) => ({
          id: therapist.id,
          shopId: shopId,
          name: therapist.name,
          imageUrl: therapist.imageUrl,
          rating: therapist.rating,
          isAvailable: therapist.isAvailable,
        }))
      )
    }
  }, [data, isOffline, shopId])

  // Load from cache when offline
  useEffect(() => {
    if (isOffline && !data && shopId) {
      getCachedTherapists(shopId).then(therapists => {
        if (therapists.length > 0) {
          mutate({ therapists }, false)
        }
      })
    }
  }, [isOffline, data, shopId, mutate])

  return {
    therapists: data?.therapists || [],
    isLoading,
    isError: error,
    isOffline,
    mutate,
  }
}

// Helper functions

async function loadOfflineData(key: string): Promise<any> {
  // Load from IndexedDB based on key pattern
  if (key.includes('/shops')) {
    const area = new URLSearchParams(key.split('?')[1]).get('area')
    const shops = await getCachedShops(area || undefined)
    return { shops }
  }

  if (key.includes('/therapists')) {
    const shopId = key.match(/shops\/([^/]+)\/therapists/)?.[1]
    if (shopId) {
      const therapists = await getCachedTherapists(shopId)
      return { therapists }
    }
  }

  return null
}

async function cacheDataForOffline(key: string, data: any): Promise<void> {
  // Cache based on key pattern
  if (key.includes('/shops') && data?.shops) {
    await cacheShopData(
      data.shops.map((shop: any) => ({
        id: shop.id,
        name: shop.name,
        area: shop.area,
        imageUrl: shop.imageUrl,
        rating: shop.rating,
        reviewCount: shop.reviewCount,
      }))
    )
  }

  if (key.includes('/therapists') && data?.therapists) {
    const shopId = key.match(/shops\/([^/]+)\/therapists/)?.[1]
    if (shopId) {
      await cacheTherapistData(
        data.therapists.map((therapist: any) => ({
          id: therapist.id,
          shopId: shopId,
          name: therapist.name,
          imageUrl: therapist.imageUrl,
          rating: therapist.rating,
          isAvailable: therapist.isAvailable,
        }))
      )
    }
  }
}