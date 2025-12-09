"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'

import { type InstinctKind, INSTINCT_KINDS, instinctKindToLabel, instinctKindToEmoji } from '@/tokens/theme'

type MatchingCandidate = {
  id: string
  therapist_id: string
  therapist_name: string
  shop_id: string
  shop_name: string
  photo_url?: string | null
  score?: number | null
  availability?: { is_available: boolean | null; rejected_reasons?: string[] }
}

type MatchingResponse = {
  items: MatchingCandidate[]
  total: number
}

type Message = { type: 'error'; text: string }

// 本能タイプごとのグラデーション・アイコン背景
const instinctStyles: Record<InstinctKind, { gradient: string; iconBg: string; border: string; shadow: string }> = {
  relax: {
    gradient: 'from-emerald-50 to-emerald-100',
    iconBg: 'bg-emerald-200',
    border: 'border-emerald-300',
    shadow: 'shadow-emerald-200/50',
  },
  talk: {
    gradient: 'from-orange-50 to-orange-100',
    iconBg: 'bg-orange-200',
    border: 'border-orange-300',
    shadow: 'shadow-orange-200/50',
  },
  reset: {
    gradient: 'from-cyan-50 to-cyan-100',
    iconBg: 'bg-cyan-200',
    border: 'border-cyan-300',
    shadow: 'shadow-cyan-200/50',
  },
  excitement: {
    gradient: 'from-rose-50 to-rose-100',
    iconBg: 'bg-rose-200',
    border: 'border-rose-300',
    shadow: 'shadow-rose-200/50',
  },
  healing: {
    gradient: 'from-violet-50 to-violet-100',
    iconBg: 'bg-violet-200',
    border: 'border-violet-300',
    shadow: 'shadow-violet-200/50',
  },
  quiet: {
    gradient: 'from-slate-100 to-slate-200',
    iconBg: 'bg-slate-300',
    border: 'border-slate-400',
    shadow: 'shadow-slate-300/50',
  },
}

export default function GuestSearchPage() {
  const [selectedInstincts, setSelectedInstincts] = useState<InstinctKind[]>([])
  const [area, setArea] = useState('')
  const [date, setDate] = useState('')
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')
  const [sort, setSort] = useState<'recommended' | 'price' | 'new'>('recommended')
  const [result, setResult] = useState<MatchingResponse>({ items: [], total: 0 })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const toggleInstinct = (kind: InstinctKind) => {
    setSelectedInstincts((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]
    )
  }

  const params = useMemo(() => {
    const qp = new URLSearchParams()
    if (selectedInstincts.length > 0) {
      qp.set('instincts', selectedInstincts.join(','))
    }
    if (area) qp.set('area', area)
    if (date) qp.set('date', date)
    if (timeFrom) qp.set('time_from', timeFrom)
    if (timeTo) qp.set('time_to', timeTo)
    if (sort) qp.set('sort', sort)
    qp.set('entry_source', 'search_form')
    if (date && timeFrom && timeTo) {
      qp.set('phase', 'book')
    }
    return qp
  }, [selectedInstincts, area, date, timeFrom, timeTo, sort])

  const fetchMatching = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const resp = await fetch(`/api/guest/matching/search?${params.toString()}`, {
        cache: 'no-store',
      })
      if (!resp.ok) {
        setMessage({ type: 'error', text: `検索に失敗しました (${resp.status})` })
        setResult({ items: [], total: 0 })
        return
      }
      const data = (await resp.json()) as MatchingResponse
      if (sort === 'recommended') {
        const { rerankMatchingCandidates } = await import('@/features/matching/recommendedRanking')
        const reranked = rerankMatchingCandidates(
          { area, date, time_from: timeFrom || undefined, time_to: timeTo || undefined },
          Array.isArray(data.items) ? data.items : [],
        )

        const items = reranked.map((item) => ({
          id: item.therapist_id,
          therapist_id: item.therapist_id,
          therapist_name: item.therapist_name || '',
          shop_id: item.shop_id || '',
          shop_name: item.shop_name || '',
          photo_url: (item as Record<string, unknown>).photo_url as string | null | undefined,
          score: item.recommended_score,
          availability: item.availability,
        }))

        setResult({ items, total: items.length })
      } else {
        setResult(data)
      }
    } catch (e) {
      console.error('matching search failed', e)
      setMessage({ type: 'error', text: '検索中にエラーが発生しました' })
      setResult({ items: [], total: 0 })
    } finally {
      setLoading(false)
    }
  }, [area, date, params, sort, timeFrom, timeTo])

  useEffect(() => {
    if (!area || !date) return
    void fetchMatching()
  }, [area, date, fetchMatching])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    void fetchMatching()
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-stone-50">
      {/* ヒーローセクション */}
      <section className="relative overflow-hidden px-4 pb-8 pt-12">
        {/* 背景装飾 */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/4 top-0 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl" />
          <div className="absolute right-1/4 top-20 h-64 w-64 rounded-full bg-violet-200/30 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-emerald-200/20 blur-3xl" />
        </div>

        <div className="mx-auto max-w-4xl text-center">
          <h1 className="bg-gradient-to-r from-stone-800 via-stone-700 to-stone-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl">
            今日の気分は？
          </h1>
          <p className="mt-3 text-base text-stone-500 md:text-lg">
            あなたの「今」にぴったりの体験を見つけましょう
          </p>
        </div>

        {/* 本能カードグリッド */}
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-3">
          {INSTINCT_KINDS.map((kind) => {
            const isSelected = selectedInstincts.includes(kind)
            const styles = instinctStyles[kind]
            return (
              <button
                key={kind}
                type="button"
                onClick={() => toggleInstinct(kind)}
                className={`
                  group relative overflow-hidden rounded-2xl border-2 p-5 text-left
                  transition-all duration-300 ease-out
                  ${isSelected
                    ? `bg-gradient-to-br ${styles.gradient} ${styles.border} shadow-lg ${styles.shadow} scale-[1.02]`
                    : 'border-stone-200 bg-white/80 shadow-sm hover:border-stone-300 hover:shadow-md hover:scale-[1.01]'
                  }
                `}
              >
                {/* 選択インジケーター */}
                <div className={`
                  absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full
                  transition-all duration-300
                  ${isSelected ? 'bg-blue-600 scale-100' : 'bg-stone-200 scale-90 opacity-50'}
                `}>
                  {isSelected && (
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* アイコン */}
                <div className={`
                  mb-3 flex h-14 w-14 items-center justify-center rounded-xl text-3xl
                  transition-transform duration-300 group-hover:scale-110
                  ${isSelected ? styles.iconBg : 'bg-stone-100'}
                `}>
                  {instinctKindToEmoji[kind]}
                </div>

                {/* ラベル */}
                <h3 className={`
                  text-sm font-semibold leading-snug transition-colors duration-300
                  ${isSelected ? 'text-stone-800' : 'text-stone-600'}
                `}>
                  {instinctKindToLabel[kind]}
                </h3>
              </button>
            )
          })}
        </div>

        {/* 選択中バッジ */}
        {selectedInstincts.length > 0 && (
          <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-2">
            <span className="text-sm text-stone-500">選択中：</span>
            {selectedInstincts.map((kind) => (
              <span
                key={kind}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium
                  bg-gradient-to-r ${instinctStyles[kind].gradient} ${instinctStyles[kind].border} border
                `}
              >
                {instinctKindToEmoji[kind]} {instinctKindToLabel[kind]}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleInstinct(kind)
                  }}
                  className="ml-1 rounded-full p-0.5 hover:bg-black/10"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 検索コントロール */}
      <section className="sticky top-0 z-20 border-y border-stone-200 bg-white/95 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 md:flex-row md:items-center">
          {/* 検索ボタン */}
          <button
            type="button"
            onClick={() => void fetchMatching()}
            disabled={loading}
            className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-4 text-center text-base font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-700 hover:to-blue-600 hover:shadow-xl hover:shadow-blue-500/40 disabled:from-stone-400 disabled:to-stone-300 disabled:shadow-none"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                検索中...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                この気分で探す
              </span>
            )}
          </button>

          {/* フィルタートグル */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-stone-200 bg-white px-6 py-4 text-sm font-medium text-stone-700 transition-all hover:border-stone-300 hover:bg-stone-50 md:flex-shrink-0"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            詳細条件
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* 詳細フィルター */}
        {showFilters && (
          <form onSubmit={handleSubmit} className="mx-auto mt-4 max-w-4xl">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <label className="flex flex-col">
                <span className="mb-1.5 text-xs font-semibold text-stone-500">エリア</span>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="rounded-lg border-2 border-stone-200 px-4 py-2.5 text-sm transition-colors focus:border-blue-500 focus:outline-none"
                  placeholder="例: 梅田"
                />
              </label>
              <label className="flex flex-col">
                <span className="mb-1.5 text-xs font-semibold text-stone-500">日付</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-lg border-2 border-stone-200 px-4 py-2.5 text-sm transition-colors focus:border-blue-500 focus:outline-none"
                />
              </label>
              <label className="flex flex-col">
                <span className="mb-1.5 text-xs font-semibold text-stone-500">開始時間</span>
                <input
                  type="time"
                  value={timeFrom}
                  onChange={(e) => setTimeFrom(e.target.value)}
                  className="rounded-lg border-2 border-stone-200 px-4 py-2.5 text-sm transition-colors focus:border-blue-500 focus:outline-none"
                />
              </label>
              <label className="flex flex-col">
                <span className="mb-1.5 text-xs font-semibold text-stone-500">終了時間</span>
                <input
                  type="time"
                  value={timeTo}
                  onChange={(e) => setTimeTo(e.target.value)}
                  className="rounded-lg border-2 border-stone-200 px-4 py-2.5 text-sm transition-colors focus:border-blue-500 focus:outline-none"
                />
              </label>
              <label className="flex flex-col">
                <span className="mb-1.5 text-xs font-semibold text-stone-500">並び順</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                  className="rounded-lg border-2 border-stone-200 px-4 py-2.5 text-sm transition-colors focus:border-blue-500 focus:outline-none"
                >
                  <option value="recommended">おすすめ</option>
                  <option value="price">価格</option>
                  <option value="new">新着</option>
                </select>
              </label>
            </div>
          </form>
        )}
      </section>

      {/* エラーメッセージ */}
      {message && (
        <div className="mx-auto max-w-4xl px-4 pt-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {message.text}
          </div>
        </div>
      )}

      {/* 検索結果 */}
      <section className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-stone-800">
            検索結果
            {result.total > 0 && (
              <span className="ml-2 text-base font-normal text-stone-500">
                ({result.total}件)
              </span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <p className="mt-4 text-sm text-stone-500">セラピストを検索中...</p>
          </div>
        ) : result.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50 py-20">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-3xl">
              🔍
            </div>
            <p className="text-base font-medium text-stone-600">該当するセラピストが見つかりませんでした</p>
            <p className="mt-1 text-sm text-stone-400">条件を変えてもう一度お試しください</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {result.items.map((item, index) => (
              <article
                key={item.id}
                className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all duration-300 hover:border-stone-300 hover:shadow-lg"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex">
                  {/* 写真 */}
                  <div className="relative h-36 w-32 flex-shrink-0 overflow-hidden bg-gradient-to-br from-stone-100 to-stone-200">
                    {item.photo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.photo_url}
                        alt={item.therapist_name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/80 text-3xl shadow-inner">
                          👤
                        </div>
                      </div>
                    )}
                    {/* スコアバッジ */}
                    {typeof item.score === 'number' && (
                      <div className="absolute bottom-2 right-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-2.5 py-1 text-xs font-bold text-white shadow-lg">
                        {Math.round(item.score * 100)}%
                      </div>
                    )}
                  </div>

                  {/* 情報 */}
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <h3 className="text-lg font-bold text-stone-800">{item.therapist_name}</h3>
                      <p className="mt-0.5 text-sm text-stone-500">{item.shop_name}</p>
                      {item.availability && (
                        <div className="mt-3">
                          {item.availability.is_available === true ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              空きあり
                            </span>
                          ) : item.availability.is_available === false ? (
                            <span className="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
                              この時間は予約不可
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                              確認中
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <a
                        className="flex-1 rounded-lg border-2 border-stone-200 py-2 text-center text-sm font-semibold text-stone-700 transition-all hover:border-stone-300 hover:bg-stone-50"
                        href={`/guest/therapists/${item.therapist_id}?shop_id=${item.shop_id}&name=${encodeURIComponent(item.therapist_name)}&shop_name=${encodeURIComponent(item.shop_name)}`}
                      >
                        詳細を見る
                      </a>
                      <a
                        className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all hover:from-blue-700 hover:to-blue-600 hover:shadow-md"
                        href={`/guest/therapists/${item.therapist_id}/reserve?shop_id=${item.shop_id}`}
                      >
                        予約する
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
