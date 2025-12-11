'use client'

import { useState, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import type {
  DashboardShift,
  DashboardShiftCreatePayload,
  DashboardShiftUpdatePayload,
  FetchShiftsOptions,
} from '@/lib/dashboard-shifts'
import {
  fetchDashboardShifts,
  createDashboardShift,
  updateDashboardShift,
  deleteDashboardShift,
} from '@/lib/dashboard-shifts'
import type { DashboardTherapistSummary } from '@/lib/dashboard-therapists'
import { fetchDashboardTherapists } from '@/lib/dashboard-therapists'
import SafeImage from '@/components/SafeImage'

type Props = {
  profileId: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  })
}

function formatTime(datetimeStr: string): string {
  const d = new Date(datetimeStr)
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; bgColor: string }> = {
  available: {
    label: '出勤可',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 border-emerald-200',
    icon: '✅',
  },
  booked: {
    label: '予約済',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: '📅',
  },
  break: {
    label: '休憩中',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
    icon: '☕',
  },
  unavailable: {
    label: '出勤不可',
    color: 'text-neutral-600',
    bgColor: 'bg-neutral-50 border-neutral-200',
    icon: '⛔',
  },
}

type ShiftFormData = {
  therapistId: string
  date: string
  startTime: string
  endTime: string
  availabilityStatus: string
  notes: string
}

const initialFormData: ShiftFormData = {
  therapistId: '',
  date: '',
  startTime: '10:00',
  endTime: '22:00',
  availabilityStatus: 'available',
  notes: '',
}

// Loading Skeleton
function ShiftCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-full bg-neutral-200" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-24 rounded bg-neutral-200" />
          <div className="h-3 w-32 rounded bg-neutral-200" />
        </div>
        <div className="h-6 w-16 rounded-full bg-neutral-200" />
      </div>
    </div>
  )
}

// Shift Card Component
function ShiftCard({
  shift,
  therapist,
  onEdit,
  onDelete,
}: {
  shift: DashboardShift
  therapist?: DashboardTherapistSummary
  onEdit: () => void
  onDelete: () => void
}) {
  const status = STATUS_CONFIG[shift.availability_status] || STATUS_CONFIG.unavailable
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm('このシフトを削除しますか？')) return
    setIsDeleting(true)
    await onDelete()
    setIsDeleting(false)
  }

  return (
    <div
      className={clsx(
        'group relative overflow-hidden rounded-2xl border bg-white p-5 transition-all hover:shadow-lg',
        status.bgColor
      )}
    >
      {/* Date indicator */}
      <div className="absolute right-4 top-4 text-right">
        <div className="text-2xl font-bold text-neutral-800">
          {new Date(shift.date).getDate()}
        </div>
        <div className="text-xs font-medium text-neutral-500">
          {new Date(shift.date).toLocaleDateString('ja-JP', { month: 'short', weekday: 'short' })}
        </div>
      </div>

      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative">
          {therapist?.photo_urls?.[0] ? (
            <SafeImage
              src={therapist.photo_urls[0]}
              alt={therapist.name}
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-white"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 text-lg">
              👤
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 text-base">{status.icon}</span>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-neutral-900">
            {therapist?.name || '不明なセラピスト'}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-sm text-neutral-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">
              {formatTime(shift.start_at)} - {formatTime(shift.end_at)}
            </span>
          </div>
          {shift.notes && (
            <p className="mt-2 line-clamp-2 text-sm text-neutral-500">
              {shift.notes}
            </p>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="mt-4 flex items-center justify-between">
        <span
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
            status.color,
            'bg-white/50'
          )}
        >
          <span>{status.icon}</span>
          {status.label}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
          >
            編集
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
          >
            {isDeleting ? '削除中...' : '削除'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Modal Form Component
function ShiftModal({
  isOpen,
  onClose,
  editingShift,
  therapists,
  formData,
  onFormChange,
  onSubmit,
  saving,
  error,
}: {
  isOpen: boolean
  onClose: () => void
  editingShift: DashboardShift | null
  therapists: DashboardTherapistSummary[]
  formData: ShiftFormData
  onFormChange: (field: keyof ShiftFormData, value: string) => void
  onSubmit: (e: React.FormEvent) => void
  saving: boolean
  error: string | null
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md animate-in zoom-in-95 fade-in duration-200 rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-neutral-900">
            {editingShift ? 'シフトを編集' : '新しいシフトを追加'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="p-6">
          <div className="space-y-5">
            {!editingShift && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  セラピスト
                </label>
                <select
                  value={formData.therapistId}
                  onChange={(e) => onFormChange('therapistId', e.target.value)}
                  required
                  className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                >
                  <option value="">選択してください</option>
                  {therapists.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                日付
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => onFormChange('date', e.target.value)}
                required
                disabled={!!editingShift}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:bg-neutral-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  開始時刻
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => onFormChange('startTime', e.target.value)}
                  required
                  className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  終了時刻
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => onFormChange('endTime', e.target.value)}
                  required
                  className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                状態
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onFormChange('availabilityStatus', key)}
                    className={clsx(
                      'flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-medium transition-all',
                      formData.availabilityStatus === key
                        ? 'border-brand-primary bg-brand-primary/5 text-brand-primary'
                        : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    )}
                  >
                    <span>{config.icon}</span>
                    <span>{config.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                メモ
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => onFormChange('notes', e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="任意のメモ"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className={clsx(
                'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all',
                'bg-gradient-to-r from-brand-primary to-brand-secondary',
                'hover:shadow-lg hover:shadow-brand-primary/25',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  保存中...
                </>
              ) : editingShift ? (
                '更新'
              ) : (
                '作成'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ShiftList({ profileId }: Props) {
  const [shifts, setShifts] = useState<DashboardShift[]>([])
  const [therapists, setTherapists] = useState<DashboardTherapistSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingShift, setEditingShift] = useState<DashboardShift | null>(null)
  const [formData, setFormData] = useState<ShiftFormData>(initialFormData)
  const [saving, setSaving] = useState(false)
  const [filterTherapist, setFilterTherapist] = useState<string>('')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const filterOptions: FetchShiftsOptions = {}
    if (filterTherapist) filterOptions.therapistId = filterTherapist
    if (filterDateFrom) filterOptions.dateFrom = filterDateFrom
    if (filterDateTo) filterOptions.dateTo = filterDateTo

    const [shiftsResult, therapistsResult] = await Promise.all([
      fetchDashboardShifts(profileId, filterOptions),
      fetchDashboardTherapists(profileId),
    ])

    if (shiftsResult.status === 'success') {
      setShifts(shiftsResult.data)
    } else {
      setError('シフト情報の取得に失敗しました')
    }

    if (therapistsResult.status === 'success') {
      setTherapists(therapistsResult.data)
    }

    setLoading(false)
  }, [profileId, filterTherapist, filterDateFrom, filterDateTo])

  useEffect(() => {
    loadData()
  }, [loadData])

  function handleFormChange(field: keyof ShiftFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function openCreateForm() {
    setEditingShift(null)
    setFormData(initialFormData)
    setShowForm(true)
  }

  function openEditForm(shift: DashboardShift) {
    setEditingShift(shift)
    const startDate = new Date(shift.start_at)
    const endDate = new Date(shift.end_at)
    setFormData({
      therapistId: shift.therapist_id,
      date: shift.date,
      startTime: startDate.toTimeString().slice(0, 5),
      endTime: endDate.toTimeString().slice(0, 5),
      availabilityStatus: shift.availability_status,
      notes: shift.notes || '',
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingShift(null)
    setFormData(initialFormData)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // 日本時間として明示的に指定（+09:00）
    const startAt = `${formData.date}T${formData.startTime}:00+09:00`
    const endAt = `${formData.date}T${formData.endTime}:00+09:00`

    if (editingShift) {
      const payload: DashboardShiftUpdatePayload = {
        start_at: startAt,
        end_at: endAt,
        availability_status: formData.availabilityStatus,
        notes: formData.notes || null,
      }
      const result = await updateDashboardShift(profileId, editingShift.id, payload)
      if (result.status === 'success') {
        closeForm()
        await loadData()
      } else if (result.status === 'conflict') {
        setError('シフトが重複しています')
      } else {
        setError('シフトの更新に失敗しました')
      }
    } else {
      const payload: DashboardShiftCreatePayload = {
        therapist_id: formData.therapistId,
        date: formData.date,
        start_at: startAt,
        end_at: endAt,
        availability_status: formData.availabilityStatus,
        notes: formData.notes || undefined,
      }
      const result = await createDashboardShift(profileId, payload)
      if (result.status === 'success') {
        closeForm()
        await loadData()
      } else if (result.status === 'conflict') {
        setError('シフトが重複しています')
      } else {
        setError('シフトの作成に失敗しました')
      }
    }

    setSaving(false)
  }

  async function handleDelete(shiftId: string) {
    const result = await deleteDashboardShift(profileId, shiftId)
    if (result.status === 'success') {
      await loadData()
    } else {
      setError('シフトの削除に失敗しました')
    }
  }

  const therapistMap = new Map(therapists.map((t) => [t.id, t]))

  // Group shifts by date
  const shiftsByDate = shifts.reduce((acc, shift) => {
    const date = shift.date
    if (!acc[date]) acc[date] = []
    acc[date].push(shift)
    return acc
  }, {} as Record<string, DashboardShift[]>)

  const sortedDates = Object.keys(shiftsByDate).sort()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">シフト管理</h2>
          <p className="text-sm text-neutral-500">セラピストのシフトを管理します</p>
        </div>
        <button
          onClick={openCreateForm}
          className={clsx(
            'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all',
            'bg-gradient-to-r from-brand-primary to-brand-secondary',
            'hover:shadow-lg hover:shadow-brand-primary/25'
          )}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          シフトを追加
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const count = shifts.filter((s) => s.availability_status === key).length
          return (
            <div
              key={key}
              className={clsx(
                'rounded-2xl border p-4 transition-all hover:shadow-md',
                config.bgColor
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{config.icon}</span>
                <div>
                  <div className="text-2xl font-bold text-neutral-900">{count}</div>
                  <div className={clsx('text-sm font-medium', config.color)}>{config.label}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <svg className="h-5 w-5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-red-700">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white px-6 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            フィルター
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4 p-4">
          <div className="min-w-[180px]">
            <label className="mb-1.5 block text-xs font-medium text-neutral-600">
              セラピスト
            </label>
            <select
              value={filterTherapist}
              onChange={(e) => setFilterTherapist(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="">すべて</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600">
              開始日
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600">
              終了日
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
          {(filterTherapist || filterDateFrom || filterDateTo) && (
            <button
              onClick={() => {
                setFilterTherapist('')
                setFilterDateFrom('')
                setFilterDateTo('')
              }}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
            >
              クリア
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading && shifts.length === 0 ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <ShiftCardSkeleton key={i} />
          ))}
        </div>
      ) : shifts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-200">
            <svg className="h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-neutral-700">シフトがありません</h3>
          <p className="mt-1 text-sm text-neutral-500">
            新しいシフトを追加して、セラピストの勤務予定を管理しましょう
          </p>
          <button
            onClick={openCreateForm}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-primaryHover"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            シフトを追加する
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-lg bg-neutral-100 px-3 py-1 text-sm font-semibold text-neutral-700">
                  {formatDate(date)}
                </div>
                <div className="text-xs text-neutral-500">
                  {shiftsByDate[date].length}件
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shiftsByDate[date].map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    therapist={therapistMap.get(shift.therapist_id)}
                    onEdit={() => openEditForm(shift)}
                    onDelete={() => handleDelete(shift.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <ShiftModal
        isOpen={showForm}
        onClose={closeForm}
        editingShift={editingShift}
        therapists={therapists}
        formData={formData}
        onFormChange={handleFormChange}
        onSubmit={handleSubmit}
        saving={saving}
        error={error}
      />
    </div>
  )
}
