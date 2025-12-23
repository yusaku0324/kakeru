import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/Badge'
import { Calendar, Clock, AlertCircle, Check } from 'lucide-react'
import { verifySlot, createConflictErrorMessage } from '@/lib/verify-slot'
import { formatDateISO, formatTimeHM, today as getToday } from '@/lib/jst'

type FormStep = {
  key: string
  label: string
  description: string
}

const FORM_STEPS: FormStep[] = [
  { key: 'datetime', label: '日時選択', description: '予約日と時間を選択' },
  { key: 'contact', label: '連絡先入力', description: '電話番号またはLINE ID' },
  { key: 'confirm', label: '確認・送信', description: '内容を確認して送信' },
]

interface ReservationPayload {
  shop_id: string
  therapist_id: string
  start_at: string
  end_at: string
  duration_minutes: number
  payment_method?: string | null
  contact_info?: { phone?: string; line_id?: string } | null
  notes?: string | null
  guest_token?: string | null
}

interface ReservationResponse {
  status?: string
  id?: string
  debug?: { rejected_reasons?: string[] }
}

interface PreSelectedSlot {
  starts_at: string
  ends_at: string
}

interface ReservationFormProps {
  shopId: string
  therapistId: string
  preSelectedSlot?: PreSelectedSlot | null
  onComplete: (reservationId: string) => void
}

const reasonMap: Record<string, string> = {
  no_shift: 'この時間帯は出勤予定がありません。',
  on_break: 'この時間帯は休憩中です。',
  overlap_existing_reservation: 'この時間は既に予約が入っています。',
  no_available_therapist: 'この条件に合うセラピストがいません。',
  deadline_over: '予約の締切時間を過ぎています。',
  internal_error: 'エラーが発生しました。時間をおいて再度お試しください。',
}

export default function ReservationForm({
  shopId,
  therapistId,
  preSelectedSlot,
  onComplete
}: ReservationFormProps) {
  // Initialize form values based on pre-selected slot (JST基準)
  const initDate = preSelectedSlot ? formatDateISO(new Date(preSelectedSlot.starts_at)) : ''
  const initStart = preSelectedSlot ? formatTimeHM(new Date(preSelectedSlot.starts_at)) : ''
  const initDuration = preSelectedSlot
    ? Math.round((new Date(preSelectedSlot.ends_at).getTime() - new Date(preSelectedSlot.starts_at).getTime()) / 60000)
    : 60

  const [date, setDate] = useState(initDate)
  const [start, setStart] = useState(initStart)
  const [duration, setDuration] = useState<number>(initDuration)
  const [phone, setPhone] = useState('')
  const [lineId, setLineId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guestToken, setGuestToken] = useState<string | null>(null)

  useEffect(() => {
    // Generate or retrieve guest token
    if (typeof window === 'undefined') return
    const existing = window.localStorage.getItem('guest_token')
    if (existing) {
      setGuestToken(existing)
      return
    }
    const token = crypto.randomUUID()
    window.localStorage.setItem('guest_token', token)
    setGuestToken(token)
  }, [])

  const computedEnd = useMemo(() => {
    if (!date || !start || !duration) return ''
    const [h, m] = start.split(':').map((v) => parseInt(v || '0', 10))
    if (Number.isNaN(h) || Number.isNaN(m)) return ''
    const startDate = new Date(date + 'T' + start + ':00')
    if (Number.isNaN(startDate.getTime())) return ''
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000)
    const hh = String(endDate.getHours()).padStart(2, '0')
    const mm = String(endDate.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }, [date, duration, start])

  const payload = useMemo<ReservationPayload | null>(() => {
    if (!date || !start || !computedEnd || !shopId || !duration) return null
    return {
      shop_id: shopId,
      therapist_id: therapistId,
      start_at: `${date}T${start}:00`,
      end_at: `${date}T${computedEnd}:00`,
      duration_minutes: duration,
      payment_method: 'cash',
      contact_info: phone || lineId ? { phone: phone || undefined, line_id: lineId || undefined } : null,
      notes: notes || null,
      guest_token: guestToken,
    }
  }, [computedEnd, date, duration, guestToken, lineId, notes, phone, shopId, start, therapistId])

  // Calculate step completion for progress indicator
  const isDateTimeComplete = Boolean(date && start && duration)
  const isContactComplete = Boolean(phone || lineId)
  const isReadyToSubmit = isDateTimeComplete && isContactComplete

  const getStepStatus = (stepKey: string): 'complete' | 'active' | 'pending' => {
    if (stepKey === 'datetime') {
      return isDateTimeComplete ? 'complete' : 'active'
    }
    if (stepKey === 'contact') {
      if (isContactComplete) return 'complete'
      return isDateTimeComplete ? 'active' : 'pending'
    }
    if (stepKey === 'confirm') {
      return isReadyToSubmit ? 'active' : 'pending'
    }
    return 'pending'
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!payload) {
      setError('必要な項目を入力してください')
      return
    }

    setLoading(true)
    try {
      // Step 1: Verify slot availability before submitting
      const verifyResult = await verifySlot(therapistId, payload.start_at)
      if (!verifyResult.isAvailable) {
        const reason = 'reason' in verifyResult ? verifyResult.reason : undefined
        setError(createConflictErrorMessage(reason))
        setLoading(false)
        return
      }

      // Step 2: Submit reservation
      const resp = await fetch('/api/guest/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await resp.json()) as ReservationResponse

      if (resp.ok && data.status === 'confirmed' && data.id) {
        onComplete(data.id)
      } else {
        // Handle rejection reasons
        const reasons = data.debug?.rejected_reasons || []
        if (reasons.length > 0) {
          const errorMessages = reasons.map(reason => reasonMap[reason] || reason).join('\n')
          setError(errorMessages)
        } else {
          setError('予約に失敗しました。時間をおいて再度お試しください。')
        }
      }
    } catch (err) {
      console.error('reservation failed', err)
      setError('予約に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Progress Indicator */}
      <nav aria-label="予約フォームの進捗" className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
        <ol className="flex items-center justify-between gap-2">
          {FORM_STEPS.map((step, index) => {
            const status = getStepStatus(step.key)
            const isComplete = status === 'complete'
            const isActive = status === 'active'
            return (
              <li key={step.key} className="relative flex flex-1 flex-col items-center">
                {/* Connector line */}
                {index > 0 && (
                  <div
                    className={clsx(
                      'absolute right-1/2 top-4 -z-10 h-0.5 w-full -translate-y-1/2',
                      isComplete || isActive ? 'bg-blue-500' : 'bg-gray-200'
                    )}
                    aria-hidden="true"
                  />
                )}
                {/* Step circle */}
                <div
                  className={clsx(
                    'relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-300',
                    isComplete && 'bg-emerald-500 text-white shadow-md shadow-emerald-200',
                    isActive && 'bg-blue-500 text-white shadow-md shadow-blue-200 ring-4 ring-blue-100',
                    !isComplete && !isActive && 'border-2 border-gray-200 bg-white text-gray-400'
                  )}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                {/* Step label */}
                <div className="mt-2 text-center">
                  <p
                    className={clsx(
                      'text-xs font-semibold',
                      isComplete && 'text-emerald-600',
                      isActive && 'text-blue-600',
                      !isComplete && !isActive && 'text-gray-400'
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="mt-0.5 hidden text-[10px] text-gray-500 sm:block">
                    {step.description}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </nav>

      {error && (
        <div role="alert" aria-live="assertive" className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">エラー</p>
              <p className="mt-1 text-sm text-red-700 whitespace-pre-line">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Date and Time Selection */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="date">
            <Calendar className="inline w-4 h-4 mr-1" />
            予約日
          </Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1"
            min={getToday()}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="start">
              <Clock className="inline w-4 h-4 mr-1" />
              開始時間
            </Label>
            <Input
              id="start"
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="duration">コース時間</Label>
            <select
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              required
            >
              <option value={60}>60分</option>
              <option value={90}>90分</option>
              <option value={120}>120分</option>
              <option value={150}>150分</option>
              <option value={180}>180分</option>
            </select>
          </div>

          <div>
            <Label>終了時間（自動計算）</Label>
            <Input
              type="time"
              value={computedEnd}
              readOnly
              className="mt-1 bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">連絡先情報</h3>
        <p className="text-sm text-gray-600">
          いずれか一つは必ずご入力ください。予約確認のご連絡を差し上げます。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phone">電話番号</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="090-1234-5678"
              className="mt-1"
              aria-describedby={!phone && !lineId ? 'contact-validation' : undefined}
              aria-invalid={!phone && !lineId ? true : undefined}
            />
          </div>

          <div>
            <Label htmlFor="lineId">LINE ID</Label>
            <Input
              id="lineId"
              type="text"
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              placeholder="your-line-id"
              className="mt-1"
              aria-describedby={!phone && !lineId ? 'contact-validation' : undefined}
              aria-invalid={!phone && !lineId ? true : undefined}
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes">備考・ご要望</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ご要望やアレルギーなどがございましたらご記入ください"
          rows={4}
          className="mt-1"
        />
      </div>

      {/* Payment Method */}
      <div>
        <Label>お支払い方法</Label>
        <div className="mt-2">
          <Badge variant="outline">現金のみ</Badge>
        </div>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={loading || !date || !start || (!phone && !lineId)}
        size="lg"
        className="w-full"
      >
        {loading ? '予約処理中...' : '予約を確定する'}
      </Button>

      {/* Validation Message */}
      {(!phone && !lineId) && (
        <p id="contact-validation" role="alert" className="text-sm text-red-600 text-center">
          電話番号またはLINE IDのいずれかを入力してください
        </p>
      )}
    </form>
  )
}
