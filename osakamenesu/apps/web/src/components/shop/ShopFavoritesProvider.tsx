"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { ToastContainer, useToast } from '@/components/useToast'

type ShopFavoriteRecord = {
  shopId: string
  createdAt: string
}

type ShopFavoritesContextValue = {
  favorites: Map<string, ShopFavoriteRecord>
  isAuthenticated: boolean | null
  loading: boolean
  isFavorite: (shopId: string) => boolean
  isProcessing: (shopId: string) => boolean
  toggleFavorite: (shopId: string) => Promise<void>
}

const ShopFavoritesContext = createContext<ShopFavoritesContextValue | undefined>(undefined)

function normalizeId(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed ? trimmed : null
}

export function ShopFavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<Map<string, ShopFavoriteRecord>>(new Map())
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const mutationVersionRef = useRef(0)
  const keyVersionRef = useRef(new Map<string, number>())
  const { toasts, push, remove } = useToast()

  useEffect(() => {
    let active = true
    const fetchVersion = mutationVersionRef.current

    async function loadFavorites() {
      setLoading(true)
      try {
        const res = await fetch('/api/favorites', {
          credentials: 'include',
        })

        if (!active) return

        if (res.status === 401) {
          setIsAuthenticated(false)
          setFavorites(new Map())
          keyVersionRef.current.clear()
          setLoading(false)
          return
        }

        if (!res.ok) {
          throw new Error(`failed_to_fetch_shop_favorites_${res.status}`)
        }

        const data = (await res.json()) as Array<{
          shop_id?: string
          created_at?: string
        }>

        const next = new Map<string, ShopFavoriteRecord>()
        for (const entry of data ?? []) {
          const shopId = normalizeId(entry.shop_id)
          if (!shopId) continue
          next.set(shopId, {
            shopId,
            createdAt: entry.created_at ?? new Date().toISOString(),
          })
        }

        setFavorites((prev) => {
          if (!active) return prev

          if (mutationVersionRef.current === fetchVersion) {
            keyVersionRef.current.clear()
            next.forEach((record, key) => {
              keyVersionRef.current.set(key, fetchVersion)
            })
            return next
          }

          const merged = new Map(prev)
          const serverKeys = new Set(next.keys())

          next.forEach((record, key) => {
            const version = keyVersionRef.current.get(key) ?? 0
            if (version <= fetchVersion) {
              merged.set(key, record)
              keyVersionRef.current.set(key, fetchVersion)
            }
          })

          for (const key of Array.from(merged.keys())) {
            if (!serverKeys.has(key)) {
              const version = keyVersionRef.current.get(key) ?? 0
              if (version <= fetchVersion) {
                merged.delete(key)
                keyVersionRef.current.delete(key)
              }
            }
          }

          return merged
        })
        setIsAuthenticated(true)
      } catch (error) {
        if (!active) return
        setIsAuthenticated((prev) => (prev === null ? null : prev))
        push('error', 'お気に入りの読み込みに失敗しました。時間をおいて再度お試しください。')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadFavorites()
    return () => {
      active = false
    }
  }, [push])

  const isFavorite = useCallback(
    (shopId: string) => {
      const normalized = normalizeId(shopId)
      if (!normalized) return false
      return favorites.has(normalized)
    },
    [favorites]
  )

  const isProcessing = useCallback(
    (shopId: string) => {
      const normalized = normalizeId(shopId)
      if (!normalized) return false
      return pending.has(normalized)
    },
    [pending]
  )

  const toggleFavorite = useCallback(
    async (shopId: string) => {
      const normalizedShopId = normalizeId(shopId)

      if (!normalizedShopId) {
        push('error', 'この店舗はお気に入り登録に対応していません。')
        return
      }

      if (isAuthenticated === false) {
        push('error', 'お気に入り機能を利用するにはログインが必要です。')
        return
      }

      setPending((prev) => {
        const next = new Set(prev)
        next.add(normalizedShopId)
        return next
      })

      const currentlyFavorite = favorites.has(normalizedShopId)

      try {
        if (currentlyFavorite) {
          const res = await fetch(`/api/favorites/${encodeURIComponent(normalizedShopId)}`, {
            method: 'DELETE',
            credentials: 'include',
          })

          if (res.status === 401) {
            setIsAuthenticated(false)
            setFavorites(new Map())
            push('error', 'お気に入りを削除するにはログインしてください。')
            return
          }

          if (!res.ok && res.status !== 404) {
            throw new Error(`failed_to_remove_shop_favorite_${res.status}`)
          }

          const nextVersion = mutationVersionRef.current + 1
          mutationVersionRef.current = nextVersion
          keyVersionRef.current.set(normalizedShopId, nextVersion)
          setFavorites((prev) => {
            const next = new Map(prev)
            next.delete(normalizedShopId)
            return next
          })
          push('success', 'お気に入りから削除しました。')
        } else {
          const res = await fetch('/api/favorites', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ shop_id: normalizedShopId }),
          })

          if (res.status === 401) {
            setIsAuthenticated(false)
            setFavorites(new Map())
            push('error', 'お気に入り機能を利用するにはログインが必要です。')
            return
          }

          if (!res.ok) {
            throw new Error(`failed_to_add_shop_favorite_${res.status}`)
          }

          const data = (await res.json()) as {
            shop_id?: string
            created_at?: string
          }

          const responseShopId = normalizeId(data?.shop_id) ?? normalizedShopId
          const createdAt = data?.created_at ?? new Date().toISOString()
          const nextVersion = mutationVersionRef.current + 1
          mutationVersionRef.current = nextVersion
          keyVersionRef.current.set(responseShopId, nextVersion)
          setFavorites((prev) => {
            const next = new Map(prev)
            next.set(responseShopId, {
              shopId: responseShopId,
              createdAt,
            })
            return next
          })
          setIsAuthenticated(true)
          push('success', 'お気に入りに追加しました。')
        }
      } catch (error) {
        const message = currentlyFavorite ? 'お気に入りの削除に失敗しました。' : 'お気に入りの追加に失敗しました。'
        push('error', message)
      } finally {
        setPending((prev) => {
          const next = new Set(prev)
          next.delete(normalizedShopId)
          return next
        })
      }
    },
    [favorites, isAuthenticated, push]
  )

  const value = useMemo<ShopFavoritesContextValue>(
    () => ({
      favorites,
      isAuthenticated,
      loading,
      isFavorite,
      isProcessing,
      toggleFavorite,
    }),
    [favorites, isAuthenticated, isFavorite, isProcessing, loading, toggleFavorite]
  )

  return (
    <ShopFavoritesContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={remove} />
    </ShopFavoritesContext.Provider>
  )
}

export function useShopFavorites(): ShopFavoritesContextValue {
  const context = useContext(ShopFavoritesContext)
  if (!context) {
    throw new Error('useShopFavorites must be used within a ShopFavoritesProvider')
  }
  return context
}
