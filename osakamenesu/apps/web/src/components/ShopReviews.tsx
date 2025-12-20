'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ToastContainer, useToast } from '@/components/useToast'

import { ReviewAspectCards } from '@/components/reviews/ReviewAspectCards'
import { ReviewsList } from '@/components/reviews/ReviewsList'
import { ReviewForm } from '@/components/reviews/ReviewForm'
import {
  UUID_PATTERN,
  transformReviewItem,
  transformHighlight,
  buildInitialForm,
} from '@/components/reviews/shopReviewsUtils'
import type {
  ReviewAspectKey,
  ReviewSummary,
  ReviewItem,
  ReviewListResponse,
  ReviewDisplay,
  ReviewFormState,
  AuthState,
} from '@/components/reviews/shopReviewsTypes'

type ShopReviewsProps = {
  shopId: string
  summary?: ReviewSummary | null
  forceRemoteFetch?: boolean
}

async function fetchReviews(
  targetShopId: string,
  targetPage: number,
): Promise<ReviewListResponse | null> {
  const resp = await fetch(`/api/v1/shops/${targetShopId}/reviews?page=${targetPage}`)
  if (resp.status === 404) {
    return {
      total: 0,
      items: [],
      aspect_averages: {},
      aspect_counts: {},
    }
  }
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || 'failed to fetch reviews')
  }
  const data = (await resp.json()) as ReviewListResponse
  return data
}

export default function ShopReviews({
  shopId,
  summary,
  forceRemoteFetch = false,
}: ShopReviewsProps) {
  const { toasts, push, remove } = useToast()
  const [reviews, setReviews] = useState<ReviewDisplay[]>([])
  const [total, setTotal] = useState<number>(summary?.review_count ?? 0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [form, setForm] = useState<ReviewFormState>(() => buildInitialForm())
  const [aspectAverages, setAspectAverages] = useState<Partial<Record<ReviewAspectKey, number>>>(
    summary?.aspect_averages ?? {},
  )
  const [aspectCounts, setAspectCounts] = useState<Partial<Record<ReviewAspectKey, number>>>(
    summary?.aspect_counts ?? {},
  )

  const isDemoEnvironment = useMemo(
    () => !UUID_PATTERN.test(shopId) && !forceRemoteFetch,
    [shopId, forceRemoteFetch],
  )

  const highlightedReviews = useMemo(() => {
    const items = summary?.highlighted ?? []
    return items.map((item, index) => transformHighlight(item, index))
  }, [summary])

  useEffect(() => {
    setReviews(highlightedReviews)
  }, [highlightedReviews])

  useEffect(() => {
    let cancelled = false

    async function checkAuth() {
      if (isDemoEnvironment) {
        setAuthState('guest')
        return
      }

      try {
        const res = await fetch('/api/auth/me/site', {
          credentials: 'include',
          cache: 'no-store',
        })

        if (cancelled) return

        if (res.ok) {
          setAuthState('authenticated')
        } else if (res.status === 401) {
          setAuthState('guest')
        } else {
          setAuthState('guest')
        }
      } catch {
        if (!cancelled) {
          setAuthState('guest')
        }
      }
    }

    checkAuth()
    return () => {
      cancelled = true
    }
  }, [isDemoEnvironment])

  useEffect(() => {
    if (isDemoEnvironment) {
      setHasMore(false)
      return
    }
    let cancelled = false
    async function loadFirstPage() {
      setIsLoading(true)
      try {
        const data = await fetchReviews(shopId, 1)
        if (cancelled) return
        if (data) {
          const mapped = data.items.map((item) => transformReviewItem(item))
          setReviews(mapped.length ? mapped : highlightedReviews)
          setTotal(data.total)
          setPage(1)
          setHasMore(data.total > mapped.length)
          if (data.aspect_averages !== undefined) {
            setAspectAverages(data.aspect_averages)
          }
          if (data.aspect_counts !== undefined) {
            setAspectCounts(data.aspect_counts)
          }
        }
      } catch {
        if (!cancelled) {
          push('error', '口コミの読み込みに失敗しました。時間を置いて再度お試しください。')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }
    loadFirstPage()
    return () => {
      cancelled = true
    }
  }, [shopId, isDemoEnvironment, highlightedReviews, push])

  async function loadMore() {
    if (isLoading || isDemoEnvironment) return
    const nextPage = page + 1
    setIsLoading(true)
    try {
      const data = await fetchReviews(shopId, nextPage)
      if (!data) return
      const mapped = data.items.map((item) => transformReviewItem(item))
      setReviews((prev) => {
        const next = [...prev, ...mapped]
        setHasMore(data.total > next.length)
        return next
      })
      setPage(nextPage)
      setTotal(data.total)
      setAspectAverages((current) => data.aspect_averages ?? current)
      setAspectCounts((current) => data.aspect_counts ?? current)
    } catch {
      push('error', '口コミの読み込みに失敗しました。時間を置いて再度お試しください。')
    } finally {
      setIsLoading(false)
    }
  }

  function handleFieldChange<K extends keyof ReviewFormState>(key: K, value: ReviewFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleAspectScoreChange(key: ReviewAspectKey, value: number | null) {
    setForm((prev) => ({
      ...prev,
      aspects: {
        ...prev.aspects,
        [key]: {
          score: value,
          note: prev.aspects[key].note,
        },
      },
    }))
  }

  function handleAspectNoteChange(key: ReviewAspectKey, value: string) {
    setForm((prev) => ({
      ...prev,
      aspects: {
        ...prev.aspects,
        [key]: {
          score: prev.aspects[key].score,
          note: value,
        },
      },
    }))
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    if (isDemoEnvironment) {
      push('error', 'デモ表示中のため、この環境では口コミ投稿をご利用いただけません。')
      return
    }
    if (authState === 'checking') {
      push('error', '認証確認中です。数秒後にもう一度お試しください。')
      return
    }
    if (authState !== 'authenticated') {
      push('error', '口コミ投稿にはログインが必要です。ログインページからログインしてください。')
      return
    }
    const trimmedBody = form.body.trim()
    if (!trimmedBody) {
      push('error', '口コミ本文を入力してください。')
      return
    }
    const score = Number(form.score)
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      push('error', '総合評価は1〜5の範囲で選択してください。')
      return
    }

    const payload: Record<string, unknown> = {
      score,
      body: trimmedBody,
    }
    if (form.title.trim()) payload.title = form.title.trim()
    if (form.authorAlias.trim()) payload.author_alias = form.authorAlias.trim()
    if (form.visitedAt) payload.visited_at = form.visitedAt

    const aspectsPayload: Record<string, { score: number; note?: string }> = {}
    for (const key of Object.keys(form.aspects) as ReviewAspectKey[]) {
      const entry = form.aspects[key]
      if (!entry || entry.score == null) continue
      const scoreValue = Number(entry.score)
      if (!Number.isInteger(scoreValue) || scoreValue < 1 || scoreValue > 5) continue
      const note = entry.note.trim()
      aspectsPayload[key] = note ? { score: scoreValue, note } : { score: scoreValue }
    }
    if (Object.keys(aspectsPayload).length) {
      payload.aspects = aspectsPayload
    }

    setIsSubmitting(true)
    try {
      const resp = await fetch(`/api/v1/shops/${shopId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })
      const text = await resp.text()
      let data: ReviewItem | null = null
      if (text) {
        try {
          data = JSON.parse(text) as ReviewItem
        } catch {
          // ignore parse error and handle below
        }
      }
      if (!resp.ok) {
        if (resp.status === 401) {
          setAuthState('guest')
          push('error', 'ログインが必要です。ログイン後にもう一度お試しください。')
          return
        }
        const message = (() => {
          const dataWithDetail = data as { detail?: string } | null
          if (dataWithDetail && typeof dataWithDetail.detail === 'string')
            return dataWithDetail.detail
          if (!text) return '口コミの送信に失敗しました。再度お試しください。'
          return text
        })()
        push('error', message)
        return
      }

      push('success', '口コミを送信しました。掲載までしばらくお待ちください。')
      if (data) {
        const displayItem = transformReviewItem(data)
        setReviews((prev) => [displayItem, ...prev])
        setTotal((prev) => prev + 1)
      }
      setForm(buildInitialForm())
    } catch {
      push('error', 'ネットワークエラーが発生しました。時間を置いて再度お試しください。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <ReviewAspectCards aspectAverages={aspectAverages} aspectCounts={aspectCounts} />

      <ReviewsList
        reviews={reviews}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />

      <ReviewForm
        form={form}
        onFieldChange={handleFieldChange}
        onAspectScoreChange={handleAspectScoreChange}
        onAspectNoteChange={handleAspectNoteChange}
        onSubmit={submitReview}
        isSubmitting={isSubmitting}
        isDemoEnvironment={isDemoEnvironment}
        authState={authState}
      />

      <ToastContainer toasts={toasts} onDismiss={remove} />
    </div>
  )
}
