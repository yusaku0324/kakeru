"use client"

import React, { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ToastContainer, useToast } from '@/components/useToast'

type ReviewAspectKey = 'therapist_service' | 'staff_response' | 'room_cleanliness'

type ReviewAspect = {
  score: number
  note?: string | null
}

type ReviewAspects = Partial<Record<ReviewAspectKey, ReviewAspect>>

type HighlightedReview = {
  review_id?: string | null
  title: string
  body: string
  score: number
  visited_at?: string | null
  author_alias?: string | null
  aspects?: ReviewAspects | null
}

type ReviewSummary = {
  average_score?: number | null
  review_count?: number | null
  highlighted?: HighlightedReview[] | null
  aspect_averages?: Partial<Record<ReviewAspectKey, number>> | null
  aspect_counts?: Partial<Record<ReviewAspectKey, number>> | null
}

type ReviewItem = {
  id: string
  profile_id: string
  status: 'pending' | 'published' | 'rejected'
  score: number
  title?: string | null
  body: string
  author_alias?: string | null
  visited_at?: string | null
  created_at: string
  updated_at: string
  aspects?: ReviewAspects | null
}

type ReviewListResponse = {
  total: number
  items: ReviewItem[]
  aspect_averages?: Partial<Record<ReviewAspectKey, number>>
  aspect_counts?: Partial<Record<ReviewAspectKey, number>>
}

type ReviewDisplay = {
  key: string
  title?: string | null
  body: string
  score: number
  author?: string | null
  visitedAt?: string | null
  status?: 'pending' | 'published' | 'rejected' | 'highlight'
  submittedAt?: string | null
  aspects?: ReviewAspects | null
}

type ShopReviewsProps = {
  shopId: string
  summary?: ReviewSummary | null
  forceRemoteFetch?: boolean
}

type ReviewFormState = {
  score: number
  title: string
  body: string
  authorAlias: string
  visitedAt: string
  aspects: Record<ReviewAspectKey, { score: number | null; note: string }>
}

const ASPECT_LABELS: Record<ReviewAspectKey, { label: string; help: string }> = {
  therapist_service: {
    label: 'セラピストの接客',
    help: '施術の丁寧さや気配りなど',
  },
  staff_response: {
    label: 'スタッフ・受付の対応',
    help: '予約〜受付の説明や案内の印象',
  },
  room_cleanliness: {
    label: 'ルームの清潔さ',
    help: 'シャワーや備品の整頓・衛生面',
  },
}

const STAR_SYMBOL_FULL = '★'
const STAR_SYMBOL_EMPTY = '☆'
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toDisplayKey(prefix: string, unique?: string | null, fallback?: number) {
  if (unique && unique.length > 0) return `${prefix}-${unique}`
  return `${prefix}-fallback-${fallback ?? Date.now()}`
}

function formatVisitedLabel(input?: string | null) {
  if (!input) return null
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return input
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(date)
}

function starLabel(score: number) {
  const safe = Math.min(5, Math.max(0, Math.round(score)))
  return `${STAR_SYMBOL_FULL.repeat(safe)}${STAR_SYMBOL_EMPTY.repeat(5 - safe)}`
}

function normaliseAspectEntries(aspects?: ReviewAspects | null) {
  if (!aspects) return []
  return (Object.keys(aspects) as ReviewAspectKey[])
    .filter((key) => aspects[key]?.score)
    .map((key) => ({
      key,
      score: aspects[key]?.score ?? 0,
      note: aspects[key]?.note ?? null,
    }))
}

function transformReviewItem(item: ReviewItem): ReviewDisplay {
  return {
    key: toDisplayKey('item', item.id),
    title: item.title,
    body: item.body,
    score: item.score,
    author: item.author_alias ?? null,
    visitedAt: item.visited_at ?? null,
    status: item.status,
    submittedAt: item.created_at,
    aspects: item.aspects ?? null,
  }
}

function transformHighlight(item: HighlightedReview, index: number): ReviewDisplay {
  return {
    key: toDisplayKey('highlight', item.review_id ?? undefined, index),
    title: item.title,
    body: item.body,
    score: item.score,
    author: item.author_alias ?? null,
    visitedAt: item.visited_at ?? null,
    status: 'highlight',
    aspects: item.aspects ?? null,
  }
}

function buildInitialForm(): ReviewFormState {
  return {
    score: 5,
    title: '',
    body: '',
    authorAlias: '',
    visitedAt: '',
    aspects: {
      therapist_service: { score: null, note: '' },
      staff_response: { score: null, note: '' },
      room_cleanliness: { score: null, note: '' },
    },
  }
}

export default function ShopReviews({ shopId, summary, forceRemoteFetch = false }: ShopReviewsProps) {
  const { toasts, push, remove } = useToast()
  const [reviews, setReviews] = useState<ReviewDisplay[]>([])
  const [total, setTotal] = useState<number>(summary?.review_count ?? 0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<ReviewFormState>(() => buildInitialForm())
  const [aspectAverages, setAspectAverages] = useState<Partial<Record<ReviewAspectKey, number>>>(
    summary?.aspect_averages ?? {},
  )
  const [aspectCounts, setAspectCounts] = useState<Partial<Record<ReviewAspectKey, number>>>(
    summary?.aspect_counts ?? {},
  )

  const isDemoEnvironment = useMemo(() => !uuidPattern.test(shopId) && !forceRemoteFetch, [shopId, forceRemoteFetch])

  const highlightedReviews = useMemo(() => {
    const items = summary?.highlighted ?? []
    return items.map((item, index) => transformHighlight(item, index))
  }, [summary])

  useEffect(() => {
    setReviews(highlightedReviews)
  }, [highlightedReviews])

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
      } catch (error) {
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

  async function fetchReviews(targetShopId: string, targetPage: number): Promise<ReviewListResponse | null> {
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
    } catch (error) {
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
        const message = (() => {
          if (data && typeof (data as any)?.detail === 'string') return (data as any).detail as string
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
    } catch (error) {
      push('error', 'ネットワークエラーが発生しました。時間を置いて再度お試しください。')
    } finally {
      setIsSubmitting(false)
    }
  }

  const aspectEntries = useMemo(() => {
    return (Object.keys(ASPECT_LABELS) as ReviewAspectKey[])
      .map((key) => ({
        key,
        label: ASPECT_LABELS[key].label,
        help: ASPECT_LABELS[key].help,
        average: aspectAverages?.[key] ?? null,
        count: aspectCounts?.[key] ?? null,
      }))
      .filter((item) => item.average != null || item.count != null)
  }, [aspectAverages, aspectCounts])

  return (
    <div className="space-y-8">
      {aspectEntries.length ? (
        <div className="grid gap-3 md:grid-cols-3">
          {aspectEntries.map((item) => (
            <Card key={item.key} className="space-y-2 p-4" data-testid="review-aspect-card">
              <div className="text-sm font-semibold text-neutral-text">{item.label}</div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-semibold text-brand-primaryDark">
                  {item.average != null ? item.average.toFixed(1) : '-'}
                </div>
                {item.average != null ? <span className="text-sm text-neutral-textMuted">{starLabel(item.average)}</span> : null}
              </div>
              <div className="text-xs text-neutral-textMuted">
                {item.count ? `${item.count}件の評価` : 'まだ評価がありません'}
              </div>
              <p className="text-xs text-neutral-textMuted">{item.help}</p>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="space-y-4">
        {reviews.length ? (
          reviews.map((review) => {
            const aspects = normaliseAspectEntries(review.aspects)
            const visited = formatVisitedLabel(review.visitedAt)
            return (
              <Card key={review.key} className="space-y-3 p-4" data-testid="review-item">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="success">{review.score}★</Badge>
                      {review.title ? <span className="text-sm font-semibold text-neutral-text">{review.title}</span> : null}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-textMuted whitespace-pre-line">{review.body}</p>
                  </div>
                  <div className="text-right text-xs text-neutral-textMuted">
                    {review.author || visited ? (
                      <div className="space-y-1">
                        {review.author ? <div>{review.author}</div> : null}
                        {visited ? <div>来店日: {visited}</div> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                {aspects.length ? (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {aspects.map((aspect) => (
                      <span
                        key={`${review.key}-${aspect.key}`}
                        className="inline-flex items-center gap-1 rounded-badge bg-brand-primary/10 px-2 py-1 text-brand-primaryDark"
                      >
                        <span>{ASPECT_LABELS[aspect.key].label}</span>
                        <span className="font-semibold">{aspect.score}★</span>
                        {aspect.note ? <span className="text-neutral-textMuted">({aspect.note})</span> : null}
                      </span>
                    ))}
                  </div>
                ) : null}
                {review.status === 'pending' ? (
                  <p className="text-xs text-amber-600">
                    店舗での確認後に掲載されます。反映まで少し時間がかかる場合があります。
                  </p>
                ) : null}
              </Card>
            )
          })
        ) : isLoading ? (
          <Card className="p-4 text-sm text-neutral-textMuted">口コミを読み込み中です…</Card>
        ) : (
          <Card className="p-4 text-sm text-neutral-textMuted">まだ口コミはありません。最初のレビューを投稿してみませんか？</Card>
        )}

        {hasMore ? (
          <button
            type="button"
            className="w-full rounded-badge border border-brand-primary/30 bg-white px-4 py-2 text-sm font-semibold text-brand-primaryDark hover:bg-brand-primary/5 disabled:opacity-60"
            onClick={loadMore}
            disabled={isLoading}
          >
            {isLoading ? '読み込み中…' : 'さらに口コミを読み込む'}
          </button>
        ) : null}
      </div>

      <form onSubmit={submitReview} className="space-y-4 rounded-card border border-neutral-borderLight bg-neutral-surfaceAlt p-4">
        <div>
          <div className="text-sm font-semibold text-neutral-text">口コミを投稿する</div>
          <p className="mt-1 text-xs text-neutral-textMuted">
            店舗スタッフが内容を確認し、問題がなければ掲載されます。個人情報や誹謗中傷は掲載できません。
          </p>
          {isDemoEnvironment ? (
            <p className="mt-2 text-xs text-brand-primaryDark">
              サンプル表示中のため投稿機能はご利用いただけません。
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-neutral-text">
            <span className="font-semibold">総合評価 *</span>
            <select
              value={form.score}
              onChange={(event) => handleFieldChange('score', Number(event.target.value))}
              className="w-full rounded border border-neutral-borderLight px-3 py-2"
              required
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} - {starLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-neutral-text">
            <span className="font-semibold">タイトル</span>
            <input
              value={form.title}
              onChange={(event) => handleFieldChange('title', event.target.value)}
              placeholder="接客が丁寧でした など"
              className="w-full rounded border border-neutral-borderLight px-3 py-2"
              maxLength={160}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-neutral-text">
            <span className="font-semibold">ニックネーム</span>
            <input
              value={form.authorAlias}
              onChange={(event) => handleFieldChange('authorAlias', event.target.value)}
              placeholder="匿名希望でもOK"
              className="w-full rounded border border-neutral-borderLight px-3 py-2"
              maxLength={80}
            />
          </label>

          <label className="space-y-1 text-sm text-neutral-text">
            <span className="font-semibold">来店日</span>
            <input
              type="date"
              value={form.visitedAt}
              onChange={(event) => handleFieldChange('visitedAt', event.target.value)}
              className="w-full rounded border border-neutral-borderLight px-3 py-2"
            />
          </label>
        </div>

        <label className="space-y-1 text-sm text-neutral-text">
          <span className="font-semibold">口コミ本文 *</span>
          <textarea
            value={form.body}
            onChange={(event) => handleFieldChange('body', event.target.value)}
            className="min-h-[140px] w-full rounded border border-neutral-borderLight px-3 py-2"
            placeholder="利用したコースや接客の印象などを教えてください。"
            maxLength={4000}
            required
          />
        </label>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-neutral-text">項目別の評価（任意）</div>
          <div className="grid gap-3 md:grid-cols-3">
            {(Object.keys(ASPECT_LABELS) as ReviewAspectKey[]).map((key) => (
              <div key={key} className="space-y-2 rounded-card border border-neutral-borderLight bg-white p-3">
                <div className="space-y-1 text-sm">
                  <div className="font-semibold text-neutral-text">{ASPECT_LABELS[key].label}</div>
                  <div className="text-xs text-neutral-textMuted">{ASPECT_LABELS[key].help}</div>
                </div>
                <select
                  value={form.aspects[key].score ?? ''}
                  onChange={(event) => {
                    const value = event.target.value === '' ? null : Number(event.target.value)
                    handleAspectScoreChange(key, value)
                  }}
                  className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
                >
                  <option value="">未選択</option>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value}★
                    </option>
                  ))}
                </select>
                <input
                  value={form.aspects[key].note}
                  onChange={(event) => handleAspectNoteChange(key, event.target.value)}
                  placeholder="気になった点など（任意）"
                  className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
                  maxLength={240}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-textMuted">
            利用規約に沿って掲載させていただきます。投稿内容により掲載までお時間をいただく場合があります。
          </p>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-badge bg-brand-primary px-5 py-2 text-sm font-semibold text-white hover:bg-brand-primaryDark disabled:opacity-60"
            disabled={isSubmitting || isDemoEnvironment}
          >
            {isSubmitting ? '送信中…' : '口コミを投稿する'}
          </button>
        </div>
      </form>

      <ToastContainer toasts={toasts} onDismiss={remove} />
    </div>
  )
}
