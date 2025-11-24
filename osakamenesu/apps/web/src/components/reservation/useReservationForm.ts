'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'

import { formatDatetimeLocal, toZonedDayjs } from '@/lib/timezone'

import { useToast } from '../useToast'

type StoredProfile = {
  name: string
  phone: string
  email?: string
}

export type ReservationSelectedSlot = {
  startAt: string
  endAt: string
  date: string
  status: 'open' | 'tentative'
}

export type ReservationCourseOption = {
  id: string
  label: string
  durationMinutes?: number | null
  priceLabel?: string | null
}

export type ReservationFormState = {
  name: string
  phone: string
  email: string
  desiredStart: string
  durationMinutes: number
  notes: string
  marketingOptIn: boolean
  courseId: string | null
}

export type ReservationFormErrors = Partial<
  Record<'name' | 'phone' | 'email' | 'desiredStart', string>
>

export type ReservationSummaryPayload = {
  desiredStart: string
  duration?: number
  notes?: string
  courseLabel?: string | null
  coursePrice?: string | null
}

export type UseReservationFormProps = {
  shopId: string
  defaultStart?: string
  tel?: string | null
  lineId?: string | null
  shopName?: string | null
  defaultDurationMinutes?: number | null
  staffId?: string | null
  allowDemoSubmission?: boolean
  selectedSlots?: ReservationSelectedSlot[]
  courseOptions?: ReservationCourseOption[]
}

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

export function useReservationForm({
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
}: UseReservationFormProps) {
  const initialStart = defaultStart || nextHourIsoLocal(180)
  const initialDuration =
    defaultDurationMinutes && defaultDurationMinutes > 0 ? defaultDurationMinutes : 60

  const [form, setForm] = useState<ReservationFormState>({
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

  const [contactCount, setContactCount] = useState(0)
  const [lastSuccess, setLastSuccess] = useState<Date | null>(null)
  const [lastReservationId, setLastReservationId] = useState<string | null>(null)
  const [lastPayload, setLastPayload] = useState<ReservationSummaryPayload | null>(null)
  const [errors, setErrors] = useState<ReservationFormErrors>({})

  const [isPending, startTransition] = useTransition()
  const { toasts, push, remove } = useToast()

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const shopUuid = uuidPattern.test(shopId) ? shopId : null
  const staffUuid = staffId && uuidPattern.test(staffId) ? staffId : undefined
  const isDemoEnvironment = !shopUuid
  const canSubmit = allowDemoSubmission || Boolean(shopUuid)
  const hasContactChannels = Boolean(tel || lineId)
  const errorKeys: Array<keyof ReservationFormErrors> = ['name', 'phone', 'email', 'desiredStart']

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

  function handleChange<K extends keyof ReservationFormState>(key: K, value: ReservationFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    const errorKey = key as keyof ReservationFormErrors
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

    const nextErrors: ReservationFormErrors = {}
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
    if (!summaryText) return false
    try {
      await navigator.clipboard.writeText(summaryText)
      return true
    } catch {
      push('error', 'クリップボードへのコピーに失敗しました。')
      return false
    }
  }

  const disabled = isPending || !canSubmit

  return {
    form,
    errors,
    rememberProfile,
    profileNotice,
    contactCount,
    lastSuccess,
    lastReservationId,
    lastPayload,
    summaryText,
    isPending,
    canSubmit,
    disabled,
    minutesOptions,
    selectedCourse,
    hasContactChannels,
    toasts,
    removeToast: remove,
    actions: {
      handleChange,
      toggleRemember,
      handleCourseSelect,
      submit,
      copySummary,
    },
  }
}

export type ReservationFormHookReturn = ReturnType<typeof useReservationForm>
