"use client"

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type ReservationPayload = {
  shop_id: string
  therapist_id: string
  start_at: string
  end_at: string
  contact_info?: { phone?: string; line_id?: string } | null
  notes?: string | null
}

type ReservationResponse = {
  status?: string
  id?: string
  debug?: { rejected_reasons?: string[] }
}

const reasonMap: Record<string, string> = {
  no_shift: 'この時間帯は出勤予定がありません。',
  on_break: 'この時間帯は休憩中です。',
  overlap_existing_reservation: 'この時間は既に予約が入っています。',
  no_available_therapist: 'この条件に合うセラピストがいません。',
  deadline_over: '予約の締切時間を過ぎています。',
  internal_error: 'エラーが発生しました。時間をおいて再度お試しください。',
}

export default function ReservePage({ params }: { params: { therapistId: string } }) {
  const therapistId = params.therapistId
  const sp = useSearchParams()
  const shopId = sp.get('shop_id') || ''
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [phone, setPhone] = useState('')
  const [lineId, setLineId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ReservationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const payload = useMemo<ReservationPayload | null>(() => {
    if (!date || !start || !end || !shopId) return null
    return {
      shop_id: shopId,
      therapist_id: therapistId,
      start_at: `${date}T${start}:00`,
      end_at: `${date}T${end}:00`,
      contact_info: phone || lineId ? { phone: phone || undefined, line_id: lineId || undefined } : null,
      notes: notes || null,
    }
  }, [date, end, lineId, notes, phone, shopId, start, therapistId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setResult(null)
    if (!payload) {
      setError('必要な項目を入力してください')
      return
    }
    setLoading(true)
    try {
      const resp = await fetch('/api/guest/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await resp.json()) as ReservationResponse
      setResult(data)
      if (!resp.ok) {
        setError('予約に失敗しました。時間をおいて再度お試しください。')
      }
    } catch (err) {
      console.error('reserve failed', err)
      setError('予約に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const rejectedReasons = result?.debug?.rejected_reasons || []

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 text-sm">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-text">予約フォーム</h1>
        <p className="text-neutral-textMuted">セラピストID: {therapistId}</p>
        <p className="text-neutral-textMuted">店舗ID: {shopId || '未指定'}</p>
      </div>

      {error ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{error}</div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-borderLight bg-white p-3">
        <label className="block">
          日付
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col">
            開始
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="rounded border border-neutral-borderLight px-2 py-1"
            />
          </label>
          <label className="flex flex-col">
            終了
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded border border-neutral-borderLight px-2 py-1"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col">
            電話番号
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded border border-neutral-borderLight px-2 py-1"
              placeholder="任意"
            />
          </label>
          <label className="flex flex-col">
            LINE ID
            <input
              type="text"
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              className="rounded border border-neutral-borderLight px-2 py-1"
              placeholder="任意"
            />
          </label>
        </div>
        <label className="block">
          メモ
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
            rows={3}
            placeholder="ご要望など (任意)"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-60"
        >
          {loading ? '送信中…' : '予約する'}
        </button>
      </form>

      {result ? (
        <section className="space-y-2 rounded border border-neutral-borderLight bg-white p-3">
          <h2 className="text-lg font-semibold">結果</h2>
          {result.status === 'confirmed' ? (
            <div className="space-y-1">
              <div className="text-green-700">予約が完了しました。</div>
              <div>ID: {result.id}</div>
              <div>
                日時: {date} {start} - {end}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-amber-800">予約を確定できませんでした。</div>
              {rejectedReasons.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4 text-neutral-text">
                  {rejectedReasons.map((reason) => (
                    <li key={reason}>{reasonMap[reason] || reason}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-neutral-textMuted">詳細不明のエラーが発生しました。</div>
              )}
            </div>
          )}
        </section>
      ) : null}
    </main>
  )
}
