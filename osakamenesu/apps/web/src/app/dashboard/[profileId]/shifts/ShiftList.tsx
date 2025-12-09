'use client'

import { useState, useEffect, useCallback } from 'react'
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

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    available: '出勤可',
    booked: '予約済',
    break: '休憩中',
    unavailable: '出勤不可',
  }
  return labels[status] || status
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    available: 'bg-green-100 text-green-800',
    booked: 'bg-blue-100 text-blue-800',
    break: 'bg-yellow-100 text-yellow-800',
    unavailable: 'bg-gray-100 text-gray-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
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

    const startAt = `${formData.date}T${formData.startTime}:00`
    const endAt = `${formData.date}T${formData.endTime}:00`

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
    if (!confirm('このシフトを削除しますか？')) return

    const result = await deleteDashboardShift(profileId, shiftId)
    if (result.status === 'success') {
      await loadData()
    } else {
      setError('シフトの削除に失敗しました')
    }
  }

  function getTherapistName(therapistId: string): string {
    const therapist = therapists.find((t) => t.id === therapistId)
    return therapist?.name || '不明'
  }

  if (loading && shifts.length === 0) {
    return (
      <div className="py-8 text-center text-neutral-textMuted">
        読み込み中...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-text">シフト管理</h2>
        <button
          onClick={openCreateForm}
          className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primaryHover"
        >
          シフトを追加
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-neutral-borderLight bg-neutral-surface p-4">
        <div>
          <label className="block text-xs font-medium text-neutral-textMuted mb-1">
            セラピスト
          </label>
          <select
            value={filterTherapist}
            onChange={(e) => setFilterTherapist(e.target.value)}
            className="rounded border border-neutral-borderLight px-3 py-1.5 text-sm"
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
          <label className="block text-xs font-medium text-neutral-textMuted mb-1">
            開始日
          </label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="rounded border border-neutral-borderLight px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-textMuted mb-1">
            終了日
          </label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="rounded border border-neutral-borderLight px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {shifts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
          <p className="text-neutral-textMuted">シフトはまだ登録されていません</p>
          <button
            onClick={openCreateForm}
            className="mt-4 text-sm text-brand-primary underline"
          >
            シフトを追加する
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-borderLight">
          <table className="min-w-full divide-y divide-neutral-borderLight">
            <thead className="bg-neutral-surface">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-textMuted">
                  日付
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-textMuted">
                  セラピスト
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-textMuted">
                  時間
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-textMuted">
                  状態
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-textMuted">
                  メモ
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-textMuted">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-borderLight bg-white">
              {shifts.map((shift) => (
                <tr key={shift.id} className="hover:bg-neutral-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-text">
                    {formatDate(shift.date)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-text">
                    {getTherapistName(shift.therapist_id)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-text">
                    {formatTime(shift.start_at)} - {formatTime(shift.end_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(shift.availability_status)}`}
                    >
                      {getStatusLabel(shift.availability_status)}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-sm text-neutral-textMuted">
                    {shift.notes || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <button
                      onClick={() => openEditForm(shift)}
                      className="mr-2 text-brand-primary hover:underline"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(shift.id)}
                      className="text-red-600 hover:underline"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-neutral-text">
              {editingShift ? 'シフトを編集' : 'シフトを追加'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingShift && (
                <div>
                  <label className="block text-sm font-medium text-neutral-text mb-1">
                    セラピスト
                  </label>
                  <select
                    value={formData.therapistId}
                    onChange={(e) => handleFormChange('therapistId', e.target.value)}
                    required
                    className="w-full rounded border border-neutral-borderLight px-3 py-2"
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
                <label className="block text-sm font-medium text-neutral-text mb-1">
                  日付
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleFormChange('date', e.target.value)}
                  required
                  disabled={!!editingShift}
                  className="w-full rounded border border-neutral-borderLight px-3 py-2 disabled:bg-neutral-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-text mb-1">
                    開始時刻
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleFormChange('startTime', e.target.value)}
                    required
                    className="w-full rounded border border-neutral-borderLight px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-text mb-1">
                    終了時刻
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => handleFormChange('endTime', e.target.value)}
                    required
                    className="w-full rounded border border-neutral-borderLight px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-text mb-1">
                  状態
                </label>
                <select
                  value={formData.availabilityStatus}
                  onChange={(e) => handleFormChange('availabilityStatus', e.target.value)}
                  className="w-full rounded border border-neutral-borderLight px-3 py-2"
                >
                  <option value="available">出勤可</option>
                  <option value="booked">予約済</option>
                  <option value="break">休憩中</option>
                  <option value="unavailable">出勤不可</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-text mb-1">
                  メモ
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  rows={2}
                  className="w-full rounded border border-neutral-borderLight px-3 py-2"
                  placeholder="任意のメモ"
                />
              </div>
              {error && (
                <div className="text-sm text-red-600">{error}</div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded px-4 py-2 text-sm text-neutral-textMuted hover:bg-neutral-100"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primaryHover disabled:opacity-50"
                >
                  {saving ? '保存中...' : editingShift ? '更新' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
