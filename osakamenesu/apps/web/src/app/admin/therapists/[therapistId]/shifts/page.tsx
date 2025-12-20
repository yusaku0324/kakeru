"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type TherapistShift = {
  id: string
  therapist_id: string
  shop_id: string
  date: string
  start_at: string
  end_at: string
  availability_status: 'available' | 'busy' | 'off'
  break_slots?: { start_at: string; end_at: string }[] | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

type FetchResult = {
  items?: TherapistShift[]
}

type Message = { type: 'success' | 'error'; text: string }

const STATUS_OPTIONS: TherapistShift['availability_status'][] = ['available', 'busy', 'off']

// ステータスの日本語ラベルとスタイル
const STATUS_LABELS: Record<TherapistShift['availability_status'], { label: string; className: string }> = {
  available: { label: '出勤可能', className: 'bg-green-100 text-green-700' },
  busy: { label: '接客中', className: 'bg-amber-100 text-amber-700' },
  off: { label: '休み', className: 'bg-neutral-100 text-neutral-600' },
}

function formatTime(value: string) {
  try {
    return new Date(value).toISOString().slice(11, 16)
  } catch {
    return ''
  }
}

function buildDateTime(date: string, time: string) {
  return `${date}T${time}:00` // assume local ISO
}

export default function AdminTherapistShiftsPage() {
  const params = useParams<{ therapistId: string }>()
  const therapistId = params.therapistId
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [shifts, setShifts] = useState<TherapistShift[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  const [form, setForm] = useState({
    start: '10:00',
    end: '18:00',
    status: 'available' as TherapistShift['availability_status'],
    notes: '',
  })

  const fetchUrl = useMemo(() => {
    const q = new URLSearchParams({ therapist_id: therapistId, date })
    return `/api/admin/therapist_shifts?${q.toString()}`
  }, [therapistId, date])

  const loadShifts = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch(fetchUrl, { cache: 'no-store' })
      if (resp.ok) {
        const data = (await resp.json()) as FetchResult
        setShifts(data.items ?? [])
      } else {
        setMessage({ type: 'error', text: `シフト取得に失敗しました (${resp.status})` })
        setShifts([])
      }
    } catch (error) {
      console.error('loadShifts error', error)
      setMessage({ type: 'error', text: 'シフトの取得中にエラーが発生しました' })
      setShifts([])
    } finally {
      setLoading(false)
    }
  }, [fetchUrl])

  useEffect(() => {
    void loadShifts()
  }, [loadShifts])

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      setMessage(null)
      const payload = {
        therapist_id: therapistId,
        date,
        start_at: buildDateTime(date, form.start),
        end_at: buildDateTime(date, form.end),
        availability_status: form.status,
        notes: form.notes || null,
      }
      const resp = await fetch('/api/admin/therapist_shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (resp.ok) {
        setMessage({ type: 'success', text: 'シフトを登録しました' })
        setForm((prev) => ({ ...prev, notes: '' }))
        await loadShifts()
        return
      }
      const errText = resp.status === 409
        ? 'この時間帯は既にシフトが登録されています'
        : resp.status === 400 || resp.status === 422
          ? '開始・終了時刻や入力内容を確認してください'
          : `登録に失敗しました (${resp.status})`
      setMessage({ type: 'error', text: errText })
    },
    [therapistId, date, form, loadShifts],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = window.confirm('このシフトを削除しますか？')
      if (!confirmed) return

      setMessage(null)
      const resp = await fetch(`/api/admin/therapist_shifts/${id}`, { method: 'DELETE' })
      if (resp.ok || resp.status === 204) {
        setMessage({ type: 'success', text: '削除しました' })
        await loadShifts()
      } else {
        setMessage({ type: 'error', text: `削除に失敗しました (${resp.status})` })
      }
    },
    [loadShifts],
  )

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-text">シフト管理</h1>
        <p className="text-sm text-neutral-textMuted">セラピストID: {therapistId}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded border border-neutral-borderLight bg-white px-3 py-2">
        <label className="text-sm text-neutral-text">
          日付
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ml-2 rounded border border-neutral-borderLight px-2 py-1 text-sm"
          />
        </label>
      </div>

      {message ? (
        <div
          className={`rounded border px-3 py-2 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <section className="space-y-2 rounded border border-neutral-borderLight bg-white p-3">
        <h2 className="text-lg font-semibold">シフト一覧</h2>
        {loading ? (
          <div className="text-sm text-neutral-textMuted">読み込み中…</div>
        ) : shifts.length === 0 ? (
          <div className="text-sm text-neutral-textMuted">この日に登録されたシフトはありません。</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-borderLight text-left text-neutral-textMuted">
              <tr>
                <th className="py-1">開始</th>
                <th className="py-1">終了</th>
                <th className="py-1">ステータス</th>
                <th className="py-1">メモ</th>
                <th className="py-1 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id} className="border-b border-neutral-borderLight last:border-0">
                  <td className="py-1 align-top">{formatTime(s.start_at)}</td>
                  <td className="py-1 align-top">{formatTime(s.end_at)}</td>
                  <td className="py-1 align-top">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_LABELS[s.availability_status].className}`}>
                      {STATUS_LABELS[s.availability_status].label}
                    </span>
                  </td>
                  <td className="py-1 align-top text-neutral-textMuted">{s.notes || ''}</td>
                  <td className="py-1 text-right">
                    <button
                      onClick={() => void handleDelete(s.id)}
                      className="rounded border border-neutral-borderLight px-2 py-1 text-xs text-red-600"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="space-y-2 rounded border border-neutral-borderLight bg-white p-3">
        <h2 className="text-lg font-semibold">シフト追加</h2>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2">
              開始
              <input
                type="time"
                value={form.start}
                onChange={(e) => setForm((p) => ({ ...p, start: e.target.value }))}
                className="rounded border border-neutral-borderLight px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2">
              終了
              <input
                type="time"
                value={form.end}
                onChange={(e) => setForm((p) => ({ ...p, end: e.target.value }))}
                className="rounded border border-neutral-borderLight px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2">
              ステータス
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((p) => ({ ...p, status: e.target.value as TherapistShift['availability_status'] }))
                }
                className="rounded border border-neutral-borderLight px-2 py-1"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {STATUS_LABELS[opt].label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            メモ
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1 text-sm"
              rows={3}
            />
          </label>
          <div>
            <button
              type="submit"
              className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105"
            >
              追加する
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
