"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'

import { rerankMatchingCandidates } from '@/features/matching/recommendedRanking'

type MatchingCandidate = {
  id: string
  therapist_id: string
  therapist_name: string
  shop_id: string
  shop_name: string
  score?: number | null
  availability?: { is_available: boolean | null; rejected_reasons?: string[] }
}

type MatchingResponse = {
  items: MatchingCandidate[]
  total: number
}

type Message = { type: 'error'; text: string }

export default function GuestSearchPage() {
  const [area, setArea] = useState('')
  const [date, setDate] = useState('')
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')
  const [sort, setSort] = useState<'recommended' | 'price' | 'new'>('recommended')
  const [result, setResult] = useState<MatchingResponse>({ items: [], total: 0 })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  const params = useMemo(() => {
    const qp = new URLSearchParams()
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
  }, [area, date, timeFrom, timeTo, sort])

  // params で area/date/time/sort をまとめているため依存は params と元値に限定
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
    // 初期ロードは空入力なら何もしない
    if (!area || !date) return
    void fetchMatching()
  }, [area, date, fetchMatching])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    void fetchMatching()
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-text">ゲスト向け検索</h1>
        <p className="text-sm text-neutral-textMuted">条件を入力しておすすめのセラピストを探します</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-borderLight bg-white p-3 text-sm">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col">
            エリア
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="rounded border border-neutral-borderLight px-2 py-1"
              placeholder="例: 梅田"
            />
          </label>
          <label className="flex flex-col">
            日付
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded border border-neutral-borderLight px-2 py-1"
            />
          </label>
          <label className="flex flex-col">
            開始
            <input
              type="time"
              value={timeFrom}
              onChange={(e) => setTimeFrom(e.target.value)}
              className="rounded border border-neutral-borderLight px-2 py-1"
            />
          </label>
          <label className="flex flex-col">
            終了
            <input
              type="time"
              value={timeTo}
              onChange={(e) => setTimeTo(e.target.value)}
              className="rounded border border-neutral-borderLight px-2 py-1"
            />
          </label>
          <label className="flex flex-col">
            並び順
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="rounded border border-neutral-borderLight px-2 py-1"
            >
              <option value="recommended">おすすめ</option>
              <option value="price">価格</option>
              <option value="new">新着</option>
            </select>
          </label>
        </div>
        <button
          type="submit"
          className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105"
        >
          この条件で検索
        </button>
      </form>

      {message ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {message.text}
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-neutral-text">検索結果 ({result.total})</h2>
        {loading ? (
          <div className="text-sm text-neutral-textMuted">読み込み中…</div>
        ) : result.items.length === 0 ? (
          <div className="text-sm text-neutral-textMuted">該当するセラピストが見つかりませんでした。</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {result.items.map((item) => (
              <article key={item.id} className="space-y-2 rounded border border-neutral-borderLight bg-white p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-semibold text-neutral-text">{item.therapist_name}</div>
                    <div className="text-xs text-neutral-textMuted">{item.shop_name}</div>
                  </div>
                  {typeof item.score === 'number' ? (
                    <div className="text-right text-xs text-neutral-textMuted">
                      スコア
                      <div className="text-lg font-semibold text-brand-primary">{Math.round(item.score * 100)}%</div>
                    </div>
                  ) : null}
                </div>
                {item.availability ? (
                  <div className="text-xs">
                    {item.availability.is_available === true ? (
                      <span className="rounded bg-green-50 px-2 py-1 text-green-700">空きあり</span>
                    ) : item.availability.is_available === false ? (
                      <span className="rounded bg-neutral-100 px-2 py-1 text-neutral-textMuted">この時間は予約不可</span>
                    ) : (
                      <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">空き状況確認中</span>
                    )}
                  </div>
                ) : null}
                <div className="flex justify-end">
                  <a
                    className="rounded border border-neutral-borderLight px-3 py-2 text-xs font-semibold text-brand-primary hover:brightness-105"
                    href={`/guest/therapists/${item.therapist_id}?shop_id=${item.shop_id}&name=${encodeURIComponent(item.therapist_name)}&shop_name=${encodeURIComponent(item.shop_name)}`}
                  >
                    詳細を見る
                  </a>
                  <a
                    className="ml-2 rounded bg-brand-primary px-3 py-2 text-xs font-semibold text-white hover:brightness-105"
                    href={`/guest/therapists/${item.therapist_id}/reserve?shop_id=${item.shop_id}`}
                  >
                    この人で予約
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
