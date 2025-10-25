"use client"

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useToast, ToastContainer } from './useToast'
import ReservationContactBar from './ReservationContactBar'

export type ReservationFormProps = {
  shopId: string
  defaultStart?: string
  tel?: string | null
  lineId?: string | null
  shopName?: string | null
  defaultDurationMinutes?: number | null
  staffId?: string | null
  allowDemoSubmission?: boolean
}

type FormState = {
  name: string
  phone: string
  email: string
  desiredStart: string
  durationMinutes: number
  notes: string
  marketingOptIn: boolean
}

const MINUTES_OPTIONS = [60, 90, 120, 150, 180]

function buildIsoLocal(date: Date) {
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}

function nextHourIsoLocal(minutesAhead = 120) {
  const now = new Date()
  now.setMinutes(now.getMinutes() + minutesAhead)
  now.setSeconds(0, 0)
  return buildIsoLocal(now)
}

export default function ReservationForm({ shopId, defaultStart, defaultDurationMinutes, tel, lineId, shopName, staffId, allowDemoSubmission = false }: ReservationFormProps) {
  const initialStart = defaultStart || nextHourIsoLocal(180)
  const initialDuration = defaultDurationMinutes && defaultDurationMinutes > 0 ? defaultDurationMinutes : 60
  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    email: '',
    desiredStart: initialStart,
    durationMinutes: initialDuration,
    notes: '',
    marketingOptIn: false,
  })
  const [isPending, startTransition] = useTransition()
  const { toasts, push, remove } = useToast()
  const [contactCount, setContactCount] = useState(0)
  const [lastSuccess, setLastSuccess] = useState<Date | null>(null)
  const [lastReservationId, setLastReservationId] = useState<string | null>(null)
  const [lastPayload, setLastPayload] = useState<{ desiredStart: string; duration: number; notes?: string } | null>(null)
  const hasContact = Boolean(tel || lineId)
  const minutesOptions = (() => {
    const options = [...MINUTES_OPTIONS]
    if (!options.includes(form.durationMinutes)) {
      options.push(form.durationMinutes)
      options.sort((a, b) => a - b)
    }
    return options
  })()
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const shopUuid = uuidPattern.test(shopId) ? shopId : null
  const isDemoEnvironment = !shopUuid
  const canSubmit = allowDemoSubmission || Boolean(shopUuid)
  const staffUuid = (() => {
    if (!staffId) return undefined
    return uuidPattern.test(staffId) ? staffId : undefined
  })()

  useEffect(() => {
    if (defaultStart) {
      setForm((prev) => ({ ...prev, desiredStart: defaultStart }))
    }
  }, [defaultStart])

  useEffect(() => {
    if (defaultDurationMinutes && defaultDurationMinutes > 0) {
      setForm((prev) => ({ ...prev, durationMinutes: defaultDurationMinutes }))
    }
  }, [defaultDurationMinutes])

  function handleChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function submit() {
    if (!canSubmit) {
      push('error', 'デモデータのため、この環境では予約送信できません。')
      return
    }

    const start = new Date(form.desiredStart)
    if (Number.isNaN(start.getTime())) {
      push('error', '来店日時を正しく入力してください。')
      return
    }
    const end = new Date(start.getTime() + form.durationMinutes * 60000)
    startTransition(async () => {
      try {
        const payload = {
          shop_id: shopUuid,
          staff_id: staffUuid,
          desired_start: new Date(start.getTime()).toISOString(),
          desired_end: new Date(end.getTime()).toISOString(),
          notes: form.notes || undefined,
          marketing_opt_in: form.marketingOptIn,
          customer: {
            name: form.name,
            phone: form.phone,
            email: form.email || undefined,
          },
          channel: 'web',
        }
        const resp = await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const text = await resp.text()
        let data: any = null
        if (text) {
          try {
            data = JSON.parse(text)
          } catch {
            data = { detail: text }
          }
        }
        if (!resp.ok) {
          const errorMessage = (() => {
            if (typeof data?.detail === 'string') return data.detail
            if (Array.isArray(data?.detail)) {
              return data.detail
                .map((item: any) => item?.msg)
                .filter(Boolean)
                .join('\n')
            }
            if (data?.detail?.msg) return data.detail.msg
            return '予約の送信に失敗しました。しばらくしてから再度お試しください。'
          })()
          push('error', errorMessage)
          return
        }
        push('success', '送信が完了しました。店舗からの折り返しをお待ちください。')
        setContactCount((c) => c + 1)
        setLastSuccess(new Date())
        setLastReservationId(data?.id ?? null)
        setLastPayload({ desiredStart: form.desiredStart, duration: form.durationMinutes, notes: form.notes || undefined })
        setForm(f => ({ ...f, notes: '' }))
      } catch (err) {
        push('error', 'ネットワークエラーが発生しました。再度お試しください。')
      }
    })
  }

  const disabled = isPending || !canSubmit

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        <div>
          <label className="text-sm font-medium text-slate-700">お名前 *</label>
          <input
            value={form.name}
            onChange={e => handleChange('name', e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="例: 山田 太郎"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">お電話番号 *</label>
          <input
            value={form.phone}
            onChange={e => handleChange('phone', e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="090..."
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">メールアドレス</label>
          <input
            value={form.email}
            onChange={e => handleChange('email', e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="example@mail.com"
            type="email"
          />
        </div>
        <div className="grid gap-2 md:grid-cols-[2fr_1fr]">
          <div>
            <label className="text-sm font-medium text-slate-700">希望日時 *</label>
            <input
              type="datetime-local"
              value={form.desiredStart}
              onChange={e => handleChange('desiredStart', e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">利用時間 *</label>
            <select
              value={form.durationMinutes}
              onChange={e => handleChange('durationMinutes', Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
            >
              {minutesOptions.map(mins => (
                <option key={mins} value={mins}>{mins}分</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">ご要望・指名など</label>
          <textarea
            value={form.notes}
            onChange={e => handleChange('notes', e.target.value)}
            className="w-full border rounded px-3 py-2"
            rows={3}
            placeholder="指名やオプションの希望などがあればご記入ください"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={form.marketingOptIn}
            onChange={e => handleChange('marketingOptIn', e.target.checked)}
          />
          お得な情報をメールで受け取る
        </label>
      </div>
      <div className="space-y-2">
        {contactCount > 0 && lastSuccess ? (
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-2">
            直近の送信: {lastSuccess.toLocaleString('ja-JP')}
            {lastReservationId ? (
              <> / <Link href={`/thank-you?reservation=${lastReservationId}&shop=${shopId}`} className="text-blue-600 hover:underline">サンクスページを見る</Link></>
            ) : null}
          </div>
        ) : (
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-2">店舗からの折り返しをお待ちください。同一内容の複数送信はお控えください。</div>
        )}
        {hasContact ? (
          <ReservationContactBar
            tel={tel}
            lineId={lineId}
            reservationId={lastReservationId}
            shopName={shopName}
            lastPayload={lastPayload}
          />
        ) : null}
        {!canSubmit ? (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            この店舗はデモデータのため、予約リクエストの送信は無効化されています。
          </div>
        ) : null}
      </div>
      <ToastContainer toasts={toasts} onDismiss={remove} />
      <button
        onClick={submit}
        disabled={disabled}
        className="w-full bg-blue-600 text-white py-2 rounded shadow disabled:opacity-50"
      >
        {isPending ? '送信中...' : canSubmit ? '予約リクエストを送信' : 'デモ環境では送信できません'}
      </button>
    </div>
  )
}
