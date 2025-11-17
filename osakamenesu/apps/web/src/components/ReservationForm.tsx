'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'

import { formatDatetimeLocal, toZonedDayjs } from '@/lib/timezone'

import ReservationContactBar from './ReservationContactBar'
import { ToastContainer, useToast } from './useToast'

type ReservationFormProps = {
  shopId: string
  defaultStart?: string
  tel?: string | null
  lineId?: string | null
  shopName?: string | null
  defaultDurationMinutes?: number | null
  staffId?: string | null
  allowDemoSubmission?: boolean
  selectedSlots?: Array<{
    startAt: string
    endAt: string
    date: string
    status: 'open' | 'tentative'
  }>
  courseOptions?: Array<{
    id: string
    label: string
    durationMinutes?: number | null
    priceLabel?: string | null
  }>
}

type FormState = {
  name: string
  phone: string
  email: string
  desiredStart: string
  durationMinutes: number
  notes: string
  marketingOptIn: boolean
  courseId: string | null
}

type StoredProfile = {
  name: string
  phone: string
  email?: string
}

type FormErrors = Partial<Record<'name' | 'phone' | 'email' | 'desiredStart', string>>

const PROFILE_STORAGE_KEY = 'reservation.profile.v1'
const MINUTES_OPTIONS = [60, 90, 120, 150, 180]

function nextHourIsoLocal(minutesAhead = 120) {
  const candidate = toZonedDayjs().add(minutesAhead, 'minute').second(0).millisecond(0)
  const formatted = formatDatetimeLocal(candidate)
  return formatted || ''
}

function loadStoredProfile(): StoredProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.name !== 'string' || typeof parsed.phone !== 'string') return null
    return {
      name: parsed.name,
      phone: parsed.phone,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
    }
  } catch {
    return null
  }
}

function saveProfile(profile: StoredProfile) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // ignore localStorage failures
  }
}

function clearStoredProfile() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PROFILE_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export default function ReservationForm({
  shopId,
  defaultStart,
  defaultDurationMinutes,
  tel,
  lineId,
  shopName,
  staffId,
  allowDemoSubmission = false,
  selectedSlots,
  courseOptions = [],
}: ReservationFormProps) {
  const initialStart = defaultStart || nextHourIsoLocal(180)
  const initialDuration =
    defaultDurationMinutes && defaultDurationMinutes > 0 ? defaultDurationMinutes : 60

  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    email: '',
    desiredStart: initialStart,
    durationMinutes: courseOptions[0]?.durationMinutes ?? initialDuration,
    notes: '',
    marketingOptIn: false,
    courseId: courseOptions[0]?.id ?? null,
  })
  const [rememberProfile, setRememberProfile] = useState(false)
  const [profileNotice, setProfileNotice] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  const [isPending, startTransition] = useTransition()
  const { toasts, push, remove } = useToast()

  const [contactCount, setContactCount] = useState(0)
  const [lastSuccess, setLastSuccess] = useState<Date | null>(null)
  const [lastReservationId, setLastReservationId] = useState<string | null>(null)
  const [lastPayload, setLastPayload] = useState<{
    desiredStart: string
    duration?: number
    notes?: string
    courseLabel?: string | null
    coursePrice?: string | null
  } | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const shopUuid = uuidPattern.test(shopId) ? shopId : null
  const staffUuid = staffId && uuidPattern.test(staffId) ? staffId : undefined
  const isDemoEnvironment = !shopUuid
  const canSubmit = allowDemoSubmission || Boolean(shopUuid)
  const hasContactChannels = Boolean(tel || lineId)
  const errorKeys: Array<keyof FormErrors> = ['name', 'phone', 'email', 'desiredStart']

  const minutesOptions = useMemo(() => {
    const options = [...MINUTES_OPTIONS]
    if (!options.includes(form.durationMinutes)) {
      options.push(form.durationMinutes)
      options.sort((a, b) => a - b)
    }
    return options
  }, [form.durationMinutes])

  useEffect(() => {
    const stored = loadStoredProfile()
    if (stored) {
      setForm((prev) => ({
        ...prev,
        name: stored.name,
        phone: stored.phone,
        email: stored.email ?? '',
      }))
      setRememberProfile(true)
      setProfileNotice('保存済みの連絡先情報を読み込みました。')
    }
  }, [])

  useEffect(() => {
    if (!profileNotice) return
    const timer = setTimeout(() => setProfileNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [profileNotice])

  useEffect(() => {
    if (selectedSlots && selectedSlots.length) {
      const primary = selectedSlots[0].startAt
      setForm((prev) => (prev.desiredStart === primary ? prev : { ...prev, desiredStart: primary }))
      setErrors((prev) => {
        if (!prev.desiredStart) return prev
        const next = { ...prev }
        delete next.desiredStart
        return next
      })
    } else if (defaultStart) {
      setForm((prev) =>
        prev.desiredStart === defaultStart ? prev : { ...prev, desiredStart: defaultStart },
      )
      setErrors((prev) => {
        if (!prev.desiredStart) return prev
        const next = { ...prev }
        delete next.desiredStart
        return next
      })
    }
  }, [selectedSlots, defaultStart])

  useEffect(() => {
    if (courseOptions.length) return
    if (defaultDurationMinutes && defaultDurationMinutes > 0) {
      setForm((prev) => ({ ...prev, durationMinutes: defaultDurationMinutes }))
    }
  }, [courseOptions.length, defaultDurationMinutes])

  useEffect(() => {
    if (!courseOptions.length) return
    setForm((prev) => {
      if (prev.courseId && courseOptions.some((course) => course.id === prev.courseId)) {
        const matched = courseOptions.find((course) => course.id === prev.courseId)
        const nextDuration = matched?.durationMinutes ?? prev.durationMinutes
        return nextDuration === prev.durationMinutes
          ? prev
          : { ...prev, durationMinutes: nextDuration }
      }
      const first = courseOptions[0]
      return {
        ...prev,
        courseId: first.id,
        durationMinutes: first.durationMinutes ?? prev.durationMinutes,
      }
    })
  }, [courseOptions])

  useEffect(() => {
    if (!rememberProfile) {
      clearStoredProfile()
      return
    }
    if (!form.name.trim() || !form.phone.trim()) return
    saveProfile({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
    })
  }, [rememberProfile, form.name, form.phone, form.email])

  function handleChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    const errorKey = key as keyof FormErrors
    if (errorKeys.includes(errorKey)) {
      setErrors((prev) => {
        if (!prev[errorKey]) return prev
        const next = { ...prev }
        delete next[errorKey]
        return next
      })
    }
  }

  function toggleRemember(checked: boolean) {
    setRememberProfile(checked)
    if (!checked) {
      clearStoredProfile()
    } else if (form.name.trim() && form.phone.trim()) {
      saveProfile({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
      })
    }
  }

  const selectedCourse = useMemo(
    () => courseOptions.find((course) => course.id === form.courseId) ?? null,
    [courseOptions, form.courseId],
  )

  function handleCourseSelect(courseId: string) {
    setForm((prev) => {
      if (prev.courseId === courseId) return prev
      const course = courseOptions.find((item) => item.id === courseId)
      return {
        ...prev,
        courseId,
        durationMinutes: course?.durationMinutes ?? prev.durationMinutes,
      }
    })
  }

  async function submit() {
    if (!canSubmit) {
      push('error', 'デモデータのため、この環境では予約送信できません。')
      return
    }

    const primaryStartIso =
      (selectedSlots && selectedSlots.length ? selectedSlots[0].startAt : null) ??
      form.desiredStart ??
      defaultStart ??
      nextHourIsoLocal(180)

    const normalizedName = form.name.trim()
    const normalizedPhone = form.phone.trim()
    const normalizedEmail = form.email.trim()
    const start = primaryStartIso ? new Date(primaryStartIso) : new Date('invalid')

    const nextErrors: FormErrors = {}
    if (!normalizedName) {
      nextErrors.name = 'お名前を入力してください。'
    } else if (normalizedName.length > 80) {
      nextErrors.name = 'お名前は80文字以内で入力してください。'
    }

    const phoneDigits = normalizedPhone.replace(/\D+/g, '')
    if (!normalizedPhone) {
      nextErrors.phone = 'お電話番号を入力してください。'
    } else if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      nextErrors.phone = 'お電話番号は10〜13桁の数字で入力してください。'
    }

    if (normalizedEmail) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailPattern.test(normalizedEmail)) {
        nextErrors.email = 'メールアドレスの形式が正しくありません。'
      }
    }

    if (!primaryStartIso || Number.isNaN(start.getTime())) {
      nextErrors.desiredStart = '候補時間を選択してください。'
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      push('error', '入力内容をご確認ください。')
      return
    }

    const durationMinutes =
      selectedCourse?.durationMinutes ?? (form.durationMinutes > 0 ? form.durationMinutes : 60)
    const end = new Date(start.getTime() + durationMinutes * 60000)
    const startIso = new Date(start.getTime()).toISOString()
    const endIso = new Date(end.getTime()).toISOString()
    const courseLabel = selectedCourse?.label ?? null
    const coursePrice = selectedCourse?.priceLabel ?? null
    const courseLine = courseLabel
      ? `${courseLabel}${coursePrice ? `（${coursePrice}）` : ''}`
      : null
    const preferredSlotSummary =
      Array.isArray(selectedSlots) && selectedSlots.length
        ? selectedSlots
            .map((slot, index) => {
              const slotStart = new Date(slot.startAt)
              const slotEnd = new Date(slot.endAt)
              const dateLabel = slotStart.toLocaleDateString('ja-JP', {
                month: 'numeric',
                day: 'numeric',
                weekday: 'short',
              })
              const startTime = slotStart.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })
              const endTime = slotEnd.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })
              const statusLabel =
                slot.status === 'open'
                  ? '◎ 予約可'
                  : slot.status === 'tentative'
                    ? '△ 要確認'
                    : '× 予約不可'
              return `第${index + 1}候補: ${dateLabel} ${startTime}〜${endTime} (${statusLabel})`
            })
            .join('\n')
        : null
    const noteParts = [
      courseLine ? `希望コース: ${courseLine}` : null,
      preferredSlotSummary ? `希望日時候補:\n${preferredSlotSummary}` : null,
      form.notes.trim() ? form.notes.trim() : null,
    ].filter(Boolean)
    const mergedNotes = noteParts.join('\n')

    setErrors({})

    startTransition(async () => {
      try {
        const preferredSlots = Array.isArray(selectedSlots)
          ? selectedSlots.map((slot) => ({
              desired_start: new Date(slot.startAt).toISOString(),
              desired_end: new Date(slot.endAt).toISOString(),
              status: slot.status,
            }))
          : null

        const payload = {
          shop_id: shopUuid,
          staff_id: staffUuid,
          desired_start: startIso,
          desired_end: endIso,
          notes: mergedNotes || undefined,
          marketing_opt_in: form.marketingOptIn,
          customer: {
            name: normalizedName,
            phone: normalizedPhone,
            email: normalizedEmail || undefined,
          },
          channel: 'web',
          preferred_slots: preferredSlots && preferredSlots.length ? preferredSlots : undefined,
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
        setLastPayload({
          desiredStart: startIso,
          duration: durationMinutes,
          notes: mergedNotes || undefined,
          courseLabel,
          coursePrice,
        })
        setForm((prev) => ({ ...prev, desiredStart: startIso, notes: '' }))
        setErrors({})

        if (rememberProfile) {
          saveProfile({
            name: normalizedName,
            phone: normalizedPhone,
            email: normalizedEmail || undefined,
          })
        }
      } catch (err) {
        push('error', 'ネットワークエラーが発生しました。再度お試しください。')
      }
    })
  }

  const disabled = isPending || !canSubmit
  const inputBaseClass =
    'w-full rounded-full bg-white/85 px-4 py-3 text-sm text-neutral-text shadow-sm transition focus:outline-none'
  const inputClass = (hasError: boolean) =>
    `${inputBaseClass} ${
      hasError
        ? 'border border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200/70'
        : 'border border-white/60 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30'
    }`

  const summaryText = useMemo(() => {
    if (!lastPayload && !lastReservationId) return null
    const parts: string[] = []
    if (shopName) parts.push(`${shopName}`)
    if (lastPayload?.desiredStart) {
      try {
        const date = new Date(lastPayload.desiredStart)
        if (!Number.isNaN(date.getTime())) {
          parts.push(`希望日時: ${date.toLocaleString('ja-JP')}`)
        }
      } catch {}
    }
    if (lastPayload?.courseLabel) {
      const courseLine = `${lastPayload.courseLabel}${
        lastPayload.coursePrice ? `（${lastPayload.coursePrice}）` : ''
      }`
      parts.push(`希望コース: ${courseLine}`)
    }
    if (lastPayload?.duration) {
      parts.push(`目安時間: ${lastPayload.duration}分`)
    }
    if (lastPayload?.notes) {
      const cleaned =
        lastPayload.courseLabel && lastPayload.notes.startsWith('希望コース:')
          ? lastPayload.notes.replace(/^希望コース:.*\n?/, '').trim()
          : lastPayload.notes
      if (cleaned) {
        parts.push(`メモ: ${cleaned}`)
      }
    }
    if (lastReservationId) {
      parts.push(`予約ID: ${lastReservationId}`)
    }
    return parts.join('\n')
  }, [lastPayload, lastReservationId, shopName])

  async function copySummary() {
    if (!summaryText) return
    try {
      await navigator.clipboard.writeText(summaryText)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      push('error', 'クリップボードへのコピーに失敗しました。')
    }
  }

  return (
    <div className="space-y-6">
      {Array.isArray(selectedSlots) && selectedSlots.length ? (
        <div className="rounded-[20px] border border-brand-primary/30 bg-brand-primary/5 px-4 py-3 text-sm text-brand-primary">
          <div className="text-xs font-semibold">
            フォーム送信時に以下の候補枠を店舗へ共有します
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {selectedSlots.map((slot, index) => {
              const start = new Date(slot.startAt)
              const end = new Date(slot.endAt)
              return (
                <li key={slot.startAt}>
                  {index + 1}.{' '}
                  {start.toLocaleDateString('ja-JP', {
                    month: 'numeric',
                    day: 'numeric',
                    weekday: 'short',
                  })}{' '}
                  {start.toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                  〜
                  {end.toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                  （{slot.status === 'open' ? '即予約可' : '要確認'}）
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {errors.desiredStart ? (
        <div className="rounded-[18px] border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-600">
          {errors.desiredStart}
        </div>
      ) : null}

      {profileNotice ? (
        <div className="rounded-[18px] border border-brand-primary/40 bg-brand-primary/10 px-4 py-2 text-xs text-brand-primary">
          {profileNotice}
        </div>
      ) : null}

      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-neutral-text">お名前 *</span>
            <input
              id="reservation-name"
              value={form.name}
              onChange={(event) => handleChange('name', event.target.value)}
              className={inputClass(Boolean(errors.name))}
              placeholder="例: 山田 太郎"
              required
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'reservation-name-error' : undefined}
            />
            {errors.name ? (
              <p id="reservation-name-error" className="text-xs text-red-500">
                {errors.name}
              </p>
            ) : null}
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-neutral-text">お電話番号 *</span>
            <input
              id="reservation-phone"
              value={form.phone}
              onChange={(event) => handleChange('phone', event.target.value)}
              className={inputClass(Boolean(errors.phone))}
              placeholder="090-1234-5678"
              required
              autoComplete="tel"
              inputMode="tel"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'reservation-phone-error' : undefined}
            />
            {errors.phone ? (
              <p id="reservation-phone-error" className="text-xs text-red-500">
                {errors.phone}
              </p>
            ) : null}
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-neutral-text">メールアドレス</span>
          <input
            id="reservation-email"
            value={form.email}
            onChange={(event) => handleChange('email', event.target.value)}
            className={inputClass(Boolean(errors.email))}
            placeholder="example@mail.com"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'reservation-email-error' : undefined}
          />
          {errors.email ? (
            <p id="reservation-email-error" className="text-xs text-red-500">
              {errors.email}
            </p>
          ) : null}
        </label>

        {courseOptions.length ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-neutral-text">コースを選択 *</span>
              <span className="text-xs text-neutral-textMuted">料金は税込表示です</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {courseOptions.map((course) => {
                const isSelected = form.courseId === course.id
                const durationLabel = course.durationMinutes ? `${course.durationMinutes}分` : null
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => handleCourseSelect(course.id)}
                    aria-pressed={isSelected}
                    className={`w-full rounded-[28px] border px-4 py-4 text-left transition ${
                      isSelected
                        ? 'border-brand-primary bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-[0_18px_50px_rgba(37,99,235,0.32)]'
                        : 'border-white/70 bg-white/90 text-neutral-text shadow-[0_12px_35px_rgba(21,93,252,0.12)] hover:border-brand-primary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{course.label}</span>
                      {course.priceLabel ? (
                        <span
                          className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-brand-primary'}`}
                        >
                          {course.priceLabel}
                        </span>
                      ) : null}
                    </div>
                    {durationLabel ? (
                      <div
                        className={`mt-2 text-xs ${isSelected ? 'text-white/80' : 'text-neutral-textMuted'}`}
                      >
                        所要目安 {durationLabel}
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <label className="space-y-2">
            <span className="text-sm font-semibold text-neutral-text">利用時間 *</span>
            <select
              value={form.durationMinutes}
              onChange={(event) => handleChange('durationMinutes', Number(event.target.value))}
              className="w-full rounded-[24px] border border-white/60 bg-white/85 px-4 py-3 text-sm text-neutral-text shadow-sm transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            >
              {minutesOptions.map((mins) => (
                <option key={mins} value={mins}>
                  {mins}分
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-neutral-text">ご要望・指名など</span>
            <span className="text-xs text-neutral-textMuted">任意</span>
          </div>
          <textarea
            value={form.notes}
            onChange={(event) => handleChange('notes', event.target.value)}
            className="w-full rounded-[24px] border border-white/60 bg-white/85 px-4 py-3 text-sm text-neutral-text shadow-sm transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            rows={3}
            placeholder="指名やオプションの希望などがあればご記入ください"
          />
        </label>

        <div className="flex flex-col gap-3 text-xs text-neutral-text">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={rememberProfile}
              onChange={(event) => toggleRemember(event.target.checked)}
              className="h-4 w-4 accent-brand-primary"
            />
            次回のために連絡先情報を保存する
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.marketingOptIn}
              onChange={(event) => handleChange('marketingOptIn', event.target.checked)}
              className="h-4 w-4 accent-brand-primary"
            />
            お得な情報をメールで受け取る（任意）
          </label>
        </div>
      </div>

      <div className="space-y-3 text-xs text-neutral-textMuted">
        {contactCount > 0 && lastSuccess ? (
          <div className="rounded-[20px] border border-white/60 bg-white/85 px-4 py-3 text-neutral-text">
            直近の送信: {lastSuccess.toLocaleString('ja-JP')}
            {lastReservationId ? (
              <>
                {' / '}
                <Link
                  href={`/thank-you?reservation=${lastReservationId}&shop=${shopId}`}
                  className="text-brand-primary hover:underline"
                >
                  サンクスページを見る
                </Link>
              </>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[20px] border border-white/60 bg-white/85 px-4 py-3 text-neutral-text">
            店舗からの折り返しをお待ちください。同一内容の複数送信はお控えください。
          </div>
        )}

        {summaryText ? (
          <div className="space-y-2 rounded-[24px] border border-white/60 bg-white/90 px-4 py-3 text-neutral-text shadow-sm shadow-brand-primary/10">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-neutral-text">送信内容メモ</span>
              <button
                type="button"
                onClick={copySummary}
                className="inline-flex items-center gap-1 rounded-full border border-brand-primary/30 px-3 py-1 text-[11px] font-semibold text-brand-primary transition hover:border-brand-primary hover:bg-brand-primary/10"
              >
                {copyState === 'copied' ? 'コピーしました' : 'コピーする'}
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-xs leading-relaxed text-neutral-textMuted">
              {summaryText}
            </pre>
          </div>
        ) : null}

        {hasContactChannels ? (
          <ReservationContactBar
            tel={tel}
            lineId={lineId}
            reservationId={lastReservationId}
            shopName={shopName}
            lastPayload={lastPayload}
          />
        ) : null}

        {!canSubmit ? (
          <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-red-600">
            この店舗はデモデータのため、予約リクエストの送信は無効化されています。
          </div>
        ) : null}
      </div>

      <ToastContainer toasts={toasts} onDismiss={remove} />

      <button
        type="button"
        onClick={submit}
        disabled={disabled}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-primary/30 transition hover:from-brand-primary/90 hover:to-brand-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden>📮</span>
        {isPending ? '送信中…' : canSubmit ? '予約リクエストを送信' : 'デモ環境では送信できません'}
      </button>
    </div>
  )
}
