"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { ToastContainer, useToast } from '@/components/useToast'

type TherapistFavoriteRecord = {
  therapistId: string
  shopId: string
  createdAt: string
}

type TogglePayload = {
  therapistId: string
  shopId: string
}

type TherapistFavoritesContextValue = {
  favorites: Map<string, TherapistFavoriteRecord>
  isAuthenticated: boolean | null
  loading: boolean
  isFavorite: (therapistId: string) => boolean
  isProcessing: (therapistId: string) => boolean
  toggleFavorite: (payload: TogglePayload) => Promise<void>
}

const TherapistFavoritesContext = createContext<TherapistFavoritesContextValue | undefined>(undefined)

function normalizeId(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed ? trimmed : null
}

export function TherapistFavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<Map<string, TherapistFavoriteRecord>>(new Map())
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const { toasts, push, remove } = useToast()
  const mutationVersionRef = useRef(0)
  const keyVersionRef = useRef(new Map<string, number>())

  useEffect(() => {
    let active = true
    const fetchVersion = mutationVersionRef.current

    async function loadFavorites() {
      setLoading(true)
      try {
        const res = await fetch('/api/favorites/therapists', {
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
          throw new Error(`failed_to_fetch_therapist_favorites_${res.status}`)
        }

        const data = (await res.json()) as Array<{
          therapist_id?: string
          shop_id?: string
          created_at?: string
        }>

        const next = new Map<string, TherapistFavoriteRecord>()
        for (const entry of data ?? []) {
          const therapistId = normalizeId(entry.therapist_id)
          const shopId = normalizeId(entry.shop_id)
          if (!therapistId || !shopId) continue
          next.set(therapistId, {
            therapistId,
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
    (therapistId: string) => {
      const normalized = normalizeId(therapistId)
      if (!normalized) return false
      return favorites.has(normalized)
    },
    [favorites]
  )

  const isProcessing = useCallback(
    (therapistId: string) => {
      const normalized = normalizeId(therapistId)
      if (!normalized) return false
      return pending.has(normalized)
    },
    [pending]
  )

  const toggleFavorite = useCallback(
    async ({ therapistId, shopId }: TogglePayload) => {
      const normalizedTherapistId = normalizeId(therapistId)
      const normalizedShopId = normalizeId(shopId)

      if (!normalizedTherapistId || !normalizedShopId) {
        push('error', 'このセラピストはお気に入り登録に対応していません。')
        return
      }

      if (isAuthenticated === false) {
        push('error', 'お気に入り機能を利用するにはログインが必要です。')
        return
      }

      setPending((prev) => {
        const next = new Set(prev)
        next.add(normalizedTherapistId)
        return next
      })

      const currentlyFavorite = favorites.has(normalizedTherapistId)

      try {
        if (currentlyFavorite) {
          const res = await fetch(`/api/favorites/therapists/${encodeURIComponent(normalizedTherapistId)}`, {
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
            throw new Error(`failed_to_remove_favorite_${res.status}`)
          }

          const nextVersion = mutationVersionRef.current + 1
          mutationVersionRef.current = nextVersion
          keyVersionRef.current.set(normalizedTherapistId, nextVersion)
          setFavorites((prev) => {
            const next = new Map(prev)
            next.delete(normalizedTherapistId)
            return next
          })
          push('success', 'お気に入りから削除しました。')
        } else {
          const res = await fetch('/api/favorites/therapists', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ therapist_id: normalizedTherapistId }),
          })

          if (res.status === 401) {
            setIsAuthenticated(false)
            setFavorites(new Map())
            push('error', 'お気に入り機能を利用するにはログインが必要です。')
            return
          }

          if (!res.ok) {
            throw new Error(`failed_to_add_favorite_${res.status}`)
          }

          const data = (await res.json()) as {
            therapist_id?: string
            shop_id?: string
            created_at?: string
          }

          const responseShopId = normalizeId(data?.shop_id) ?? normalizedShopId
          const nextVersion = mutationVersionRef.current + 1
          mutationVersionRef.current = nextVersion
          keyVersionRef.current.set(normalizedTherapistId, nextVersion)
          setFavorites((prev) => {
            const next = new Map(prev)
            next.set(normalizedTherapistId, {
              therapistId: normalizedTherapistId,
              shopId: responseShopId,
              createdAt: data?.created_at ?? new Date().toISOString(),
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
          next.delete(normalizedTherapistId)
          return next
        })
      }
    },
    [favorites, isAuthenticated, push]
  )

  const value = useMemo<TherapistFavoritesContextValue>(
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
    <TherapistFavoritesContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={remove} />
    </TherapistFavoritesContext.Provider>
  )
}

export function useTherapistFavorites(): TherapistFavoritesContextValue {
  const context = useContext(TherapistFavoritesContext)
  if (!context) {
    throw new Error('useTherapistFavorites must be used within a TherapistFavoritesProvider')
  }
  return context
}
