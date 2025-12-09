'use client'

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'

import SafeImage from '@/components/SafeImage'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { TagInput } from '@/components/ui/TagInput'
import { PhotoGrid } from '@/components/ui/PhotoGrid'
import {
  type DashboardTherapistSummary,
  type DashboardTherapistDetail,
  type DashboardTherapistListResult,
  type DashboardTherapistMutationResult,
  type DashboardTherapistDeleteResult,
  createDashboardTherapist,
  deleteDashboardTherapist,
  fetchDashboardTherapist,
  reorderDashboardTherapists,
  summarizeTherapist,
  updateDashboardTherapist,
  uploadDashboardTherapistPhoto,
} from '@/lib/dashboard-therapists'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

type ToastFn = (type: 'success' | 'error', message: string) => void

type Props = {
  profileId: string
  initialItems: DashboardTherapistSummary[]
  initialError?: string | null
  onToast: ToastFn
}

type TherapistFormMode = 'create' | 'edit'

type TherapistFormValues = {
  name: string
  alias: string
  headline: string
  biography: string
  specialties: string[]
  qualifications: string[]
  experienceYears: string
  photoUrls: string[]
  status: DashboardTherapistSummary['status']
  isBookingEnabled: boolean
}

type TherapistFormState = {
  mode: TherapistFormMode
  therapistId?: string
  updatedAt?: string
  values: TherapistFormValues
}

const STATUS_CONFIG: Record<DashboardTherapistSummary['status'], { label: string; color: string; icon: string }> = {
  draft: { label: '下書き', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: '📝' },
  published: { label: '公開中', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: '✓' },
  archived: { label: 'アーカイブ', color: 'bg-neutral-100 text-neutral-600 border-neutral-200', icon: '📦' },
}

const SPECIALTY_SUGGESTIONS = [
  'オイルマッサージ', 'ディープリンパ', 'ヘッドスパ', 'アロマ',
  '指圧', 'タイ古式', 'リフレクソロジー', 'フェイシャル',
  'ストレッチ', 'ホットストーン', '足つぼ', 'ボディケア'
]

const QUALIFICATION_SUGGESTIONS = [
  '日本メンズエステ協会認定', 'アロマセラピスト', 'リンパドレナージュ資格',
  'エステティシャン', '整体師', 'セラピスト養成講座修了', 'マッサージ師免許'
]

const DEFAULT_FORM_VALUES: TherapistFormValues = {
  name: '',
  alias: '',
  headline: '',
  biography: '',
  specialties: [],
  qualifications: [],
  experienceYears: '',
  photoUrls: [],
  status: 'draft',
  isBookingEnabled: true,
}

const WIZARD_STEPS = [
  { id: 'basic', label: '基本情報', icon: '👤' },
  { id: 'details', label: '詳細', icon: '📋' },
  { id: 'photos', label: '写真', icon: '📷' },
  { id: 'preview', label: 'プレビュー', icon: '👁' },
] as const

type WizardStep = typeof WIZARD_STEPS[number]['id']

function sortTherapists(items: DashboardTherapistSummary[]): DashboardTherapistSummary[] {
  return [...items].sort((a, b) => {
    if (a.display_order === b.display_order) {
      return a.updated_at.localeCompare(b.updated_at)
    }
    return a.display_order - b.display_order
  })
}

function detailToForm(detail: DashboardTherapistDetail): TherapistFormValues {
  return {
    name: detail.name ?? '',
    alias: detail.alias ?? '',
    headline: detail.headline ?? '',
    biography: detail.biography ?? '',
    specialties: Array.isArray(detail.specialties) ? [...detail.specialties] : [],
    qualifications: Array.isArray(detail.qualifications) ? [...detail.qualifications] : [],
    experienceYears:
      typeof detail.experience_years === 'number' && Number.isFinite(detail.experience_years)
        ? String(detail.experience_years)
        : '',
    photoUrls: Array.isArray(detail.photo_urls) ? [...detail.photo_urls] : [],
    status: detail.status,
    isBookingEnabled: Boolean(detail.is_booking_enabled),
  }
}

function toErrorMessage(
  result:
    | DashboardTherapistListResult
    | DashboardTherapistMutationResult
    | DashboardTherapistDeleteResult,
  fallback: string,
): string {
  if (
    'message' in result &&
    typeof result.message === 'string' &&
    result.message.trim().length > 0
  ) {
    return result.message
  }
  return fallback
}

// Preview Card Component
function TherapistPreviewCard({ values }: { values: TherapistFormValues }) {
  const mainPhoto = values.photoUrls[0]

  return (
    <div className="mx-auto max-w-sm">
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg">
        {/* Photo */}
        <div className="relative aspect-[3/4] bg-neutral-100">
          {mainPhoto ? (
            <SafeImage
              src={mainPhoto}
              alt={values.name || 'プレビュー'}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-6xl text-neutral-300">
              👤
            </div>
          )}
          {/* Status badge */}
          <div className={clsx(
            'absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow',
            STATUS_CONFIG[values.status].color
          )}>
            {STATUS_CONFIG[values.status].icon} {STATUS_CONFIG[values.status].label}
          </div>
          {/* Photo count */}
          {values.photoUrls.length > 1 && (
            <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white">
              +{values.photoUrls.length - 1}枚
            </div>
          )}
        </div>
        {/* Info */}
        <div className="space-y-3 p-4">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">
              {values.name || '名前未入力'}
              {values.alias && (
                <span className="ml-2 text-sm font-normal text-neutral-500">({values.alias})</span>
              )}
            </h3>
            {values.headline && (
              <p className="mt-1 text-sm text-neutral-600">{values.headline}</p>
            )}
          </div>
          {/* Specialties */}
          {values.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {values.specialties.slice(0, 4).map((spec) => (
                <span
                  key={spec}
                  className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs font-medium text-brand-primaryDark"
                >
                  {spec}
                </span>
              ))}
              {values.specialties.length > 4 && (
                <span className="text-xs text-neutral-500">+{values.specialties.length - 4}</span>
              )}
            </div>
          )}
          {/* Experience */}
          {values.experienceYears && (
            <p className="text-sm text-neutral-500">
              経験 {values.experienceYears}年
            </p>
          )}
          {/* Booking status */}
          <div className="flex items-center gap-2">
            {values.isBookingEnabled ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                予約受付中
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                予約停止中
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function TherapistManager({ profileId, initialItems, initialError, onToast }: Props) {
  const [therapists, setTherapists] = useState<DashboardTherapistSummary[]>(
    sortTherapists(initialItems),
  )
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [formState, setFormState] = useState<TherapistFormState | null>(null)
  const [currentStep, setCurrentStep] = useState<WizardStep>('basic')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null)

  const isModalOpen = formState !== null
  useBodyScrollLock(isModalOpen)

  const hasTherapists = therapists.length > 0

  function openCreateForm() {
    setPhotoUploadError(null)
    setIsUploadingPhoto(false)
    setCurrentStep('basic')
    setFormState({
      mode: 'create',
      values: { ...DEFAULT_FORM_VALUES, photoUrls: [] },
    })
  }

  async function openEditForm(therapistId: string) {
    setIsLoadingDetail(true)
    const result = await fetchDashboardTherapist(profileId, therapistId)
    setIsLoadingDetail(false)

    switch (result.status) {
      case 'success': {
        setPhotoUploadError(null)
        setIsUploadingPhoto(false)
        setCurrentStep('basic')
        setFormState({
          mode: 'edit',
          therapistId,
          updatedAt: result.data.updated_at,
          values: detailToForm(result.data),
        })
        break
      }
      case 'not_found': {
        onToast('error', 'セラピストが見つかりませんでした。再読み込みしてください。')
        break
      }
      case 'unauthorized':
      case 'forbidden': {
        onToast('error', 'セラピスト情報を取得する権限がありません。')
        break
      }
      default: {
        onToast('error', toErrorMessage(result, 'セラピスト情報の取得に失敗しました。'))
      }
    }
  }

  function closeForm() {
    setFormState(null)
    setPhotoUploadError(null)
    setIsUploadingPhoto(false)
    setCurrentStep('basic')
  }

  function handleValuesChange<T extends keyof TherapistFormValues>(
    key: T,
    value: TherapistFormValues[T],
  ) {
    setFormState((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        values: {
          ...prev.values,
          [key]: value,
        },
      }
    })
  }

  const handlePhotoUpload = useCallback(async (files: FileList) => {
    if (!formState || files.length === 0) return
    setIsUploadingPhoto(true)
    setPhotoUploadError(null)

    for (const file of Array.from(files)) {
      try {
        const result = await uploadDashboardTherapistPhoto(profileId, file)
        switch (result.status) {
          case 'success': {
            const url = result.data.url
            setFormState((prev) => {
              if (!prev) return prev
              const current = prev.values.photoUrls
              if (current.includes(url)) return prev
              return {
                ...prev,
                values: { ...prev.values, photoUrls: [...current, url] }
              }
            })
            onToast('success', '写真をアップロードしました。')
            break
          }
          case 'too_large': {
            const limitMb = result.limitBytes ? Math.round(result.limitBytes / (1024 * 1024)) : 8
            const message = `ファイルサイズが大きすぎます（最大 ${limitMb}MB）`
            setPhotoUploadError(message)
            onToast('error', message)
            break
          }
          case 'unsupported_media_type': {
            const message = '対応していないファイル形式です。PNG / JPG / WEBP / GIF を利用してください。'
            setPhotoUploadError(message)
            onToast('error', message)
            break
          }
          default: {
            const message = 'message' in result && result.message ? result.message : 'アップロードに失敗しました。'
            setPhotoUploadError(message)
            onToast('error', message)
          }
        }
      } catch {
        const message = 'アップロードに失敗しました。時間をおいて再試行してください。'
        setPhotoUploadError(message)
        onToast('error', message)
      }
    }

    setIsUploadingPhoto(false)
  }, [formState, profileId, onToast])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!formState) return

    const values = formState.values
    const trimmedName = values.name.trim()
    if (!trimmedName) {
      onToast('error', 'セラピスト名を入力してください。')
      return
    }

    const sanitizedPhotoUrls = Array.from(
      new Set(values.photoUrls.map((url) => url.trim()).filter((url) => url.length > 0)),
    )

    const experienceYears = values.experienceYears.trim()
    const experienceYearsNumber = experienceYears ? Number(experienceYears) : undefined

    const sharedFields = {
      alias: values.alias.trim() || undefined,
      headline: values.headline.trim() || undefined,
      biography: values.biography.trim() || undefined,
      specialties: values.specialties.length ? values.specialties : undefined,
      qualifications: values.qualifications.length ? values.qualifications : undefined,
      experience_years:
        experienceYearsNumber !== undefined && Number.isFinite(experienceYearsNumber)
          ? Math.max(0, Math.round(experienceYearsNumber))
          : undefined,
      photo_urls: sanitizedPhotoUrls,
      is_booking_enabled: Boolean(values.isBookingEnabled),
    }

    setIsSubmitting(true)
    try {
      if (formState.mode === 'create') {
        const result = await createDashboardTherapist(profileId, {
          name: trimmedName,
          ...sharedFields,
        })
        if (result.status === 'success') {
          setTherapists((prev) => sortTherapists([...prev, summarizeTherapist(result.data)]))
          setError(null)
          onToast('success', 'セラピストを追加しました。')
          closeForm()
        } else if (result.status === 'validation_error') {
          onToast('error', '入力内容に誤りがあります。確認してください。')
        } else if (result.status === 'unauthorized' || result.status === 'forbidden') {
          onToast('error', 'セラピストを追加する権限がありません。')
        } else {
          onToast('error', toErrorMessage(result, 'セラピストの追加に失敗しました。'))
        }
      } else {
        const result = await updateDashboardTherapist(profileId, formState.therapistId!, {
          updated_at: formState.updatedAt!,
          name: trimmedName,
          status: values.status,
          ...sharedFields,
        })
        if (result.status === 'success') {
          setTherapists((prev) =>
            sortTherapists(
              prev.map((item) =>
                item.id === result.data.id ? summarizeTherapist(result.data) : item,
              ),
            ),
          )
          setError(null)
          onToast('success', 'セラピスト情報を更新しました。')
          closeForm()
        } else if (result.status === 'conflict') {
          onToast('error', '他のユーザーによって更新されました。再読み込みしてください。')
        } else if (result.status === 'validation_error') {
          onToast('error', '入力内容に誤りがあります。確認してください。')
        } else if (result.status === 'not_found') {
          onToast('error', 'セラピストが見つかりませんでした。')
        } else if (result.status === 'unauthorized' || result.status === 'forbidden') {
          onToast('error', 'セラピストを更新する権限がありません。')
        } else {
          onToast('error', toErrorMessage(result, 'セラピストの更新に失敗しました。'))
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(therapistId: string) {
    const target = therapists.find((item) => item.id === therapistId)
    if (!target) return
    if (!window.confirm(`「${target.name}」を削除しますか？この操作は取り消せません。`)) {
      return
    }
    const result = await deleteDashboardTherapist(profileId, therapistId)
    if (result.status === 'success') {
      setTherapists((prev) => prev.filter((item) => item.id !== therapistId))
      onToast('success', 'セラピストを削除しました。')
    } else if (result.status === 'unauthorized' || result.status === 'forbidden') {
      onToast('error', 'セラピストを削除する権限がありません。')
    } else if (result.status === 'not_found') {
      onToast('error', 'セラピストが見つかりませんでした。')
    } else {
      onToast('error', toErrorMessage(result, 'セラピストの削除に失敗しました。'))
    }
  }

  async function persistOrder(
    next: DashboardTherapistSummary[],
    previous: DashboardTherapistSummary[],
  ) {
    const payload = {
      items: next.map((item, index) => ({
        therapist_id: item.id,
        display_order: index * 10,
      })),
    }
    const result = await reorderDashboardTherapists(profileId, payload)
    if (result.status === 'success') {
      setTherapists(sortTherapists(result.data))
      setError(null)
      onToast('success', '並び順を更新しました。')
    } else if (result.status === 'unauthorized' || result.status === 'forbidden') {
      onToast('error', '並び順を変更する権限がありません。')
      setTherapists([...previous])
    } else if (result.status === 'not_found') {
      onToast('error', 'セラピストが見つかりませんでした。')
      setTherapists([...previous])
    } else {
      onToast('error', toErrorMessage(result, '並び順の変更に失敗しました。'))
      setTherapists([...previous])
    }
  }

  async function handleMove(index: number, direction: 1 | -1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= therapists.length) {
      return
    }
    const previous = [...therapists]
    const next = [...therapists]
    const [removed] = next.splice(index, 1)
    next.splice(targetIndex, 0, removed)
    setTherapists(next)
    await persistOrder(next, previous)
  }

  const currentStepIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep)

  function goToStep(step: WizardStep) {
    setCurrentStep(step)
  }

  function nextStep() {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < WIZARD_STEPS.length) {
      setCurrentStep(WIZARD_STEPS[nextIndex].id)
    }
  }

  function prevStep() {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(WIZARD_STEPS[prevIndex].id)
    }
  }

  return (
    <>
      <Card className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary text-xl text-white shadow-lg shadow-brand-primary/25">
                👥
              </div>
              <h2 className="text-xl font-bold text-neutral-900">在籍セラピスト管理</h2>
            </div>
            <p className="text-sm text-neutral-600">
              セラピストのプロフィールを追加・更新し、公開状態や表示順を管理します。
            </p>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
          <Button
            type="button"
            onClick={openCreateForm}
            className="gap-2 bg-gradient-to-r from-brand-primary to-brand-secondary shadow-lg shadow-brand-primary/25 hover:shadow-xl hover:shadow-brand-primary/30"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新しいセラピストを追加
          </Button>
        </div>

        {/* Stats */}
        {hasTherapists && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-neutral-900">{therapists.length}</p>
              <p className="text-xs text-neutral-500">登録数</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">
                {therapists.filter((t) => t.status === 'published').length}
              </p>
              <p className="text-xs text-emerald-600">公開中</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-amber-600">
                {therapists.filter((t) => t.status === 'draft').length}
              </p>
              <p className="text-xs text-amber-600">下書き</p>
            </div>
          </div>
        )}

        {/* Therapist Grid */}
        <div className="space-y-4">
          {hasTherapists ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {therapists.map((therapist, index) => (
                <div
                  key={therapist.id}
                  className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all hover:shadow-lg"
                >
                  {/* Photo */}
                  <div className="relative aspect-[4/3] bg-neutral-100">
                    {therapist.photo_urls.length > 0 ? (
                      <SafeImage
                        src={therapist.photo_urls[0]}
                        alt={therapist.name}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-5xl text-neutral-300">
                        👤
                      </div>
                    )}
                    {/* Status badge */}
                    <div className={clsx(
                      'absolute right-3 top-3 rounded-full border px-2.5 py-1 text-xs font-semibold shadow',
                      STATUS_CONFIG[therapist.status].color
                    )}>
                      {STATUS_CONFIG[therapist.status].icon} {STATUS_CONFIG[therapist.status].label}
                    </div>
                    {/* Order badge */}
                    <div className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    {/* Photo count */}
                    {therapist.photo_urls.length > 1 && (
                      <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white">
                        +{therapist.photo_urls.length - 1}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-neutral-900">{therapist.name}</h3>
                    {therapist.alias && (
                      <p className="text-xs text-neutral-500">({therapist.alias})</p>
                    )}
                    {therapist.headline && (
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{therapist.headline}</p>
                    )}
                    {therapist.specialties.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {therapist.specialties.slice(0, 3).map((spec) => (
                          <span
                            key={spec}
                            className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs font-medium text-brand-primaryDark"
                          >
                            {spec}
                          </span>
                        ))}
                        {therapist.specialties.length > 3 && (
                          <span className="text-xs text-neutral-500">+{therapist.specialties.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMove(index, -1)}
                        disabled={index === 0}
                        className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                        title="上に移動"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, 1)}
                        disabled={index === therapists.length - 1}
                        className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                        title="下に移動"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(therapist.id)}
                        disabled={isLoadingDetail}
                        className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-200"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(therapist.id)}
                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-8 py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-200 text-4xl">
                👥
              </div>
              <h3 className="text-lg font-semibold text-neutral-700">まだセラピストがいません</h3>
              <p className="mt-1 text-sm text-neutral-500">
                「新しいセラピストを追加」ボタンから登録を始めましょう
              </p>
              <Button
                type="button"
                onClick={openCreateForm}
                className="mt-4 gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                最初のセラピストを追加
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Modal */}
      {formState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeForm}
          />

          {/* Modal content */}
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-neutral-900">
                  {formState.mode === 'create' ? 'セラピストを追加' : 'セラピストを編集'}
                </h2>
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Step indicator */}
              <div className="mt-4 flex items-center justify-between">
                {WIZARD_STEPS.map((step, stepIndex) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => goToStep(step.id)}
                    className={clsx(
                      'flex flex-1 flex-col items-center gap-1 py-2 transition',
                      stepIndex <= currentStepIndex ? 'text-brand-primary' : 'text-neutral-400'
                    )}
                  >
                    <div className={clsx(
                      'flex h-8 w-8 items-center justify-center rounded-full text-sm transition',
                      stepIndex < currentStepIndex
                        ? 'bg-brand-primary text-white'
                        : stepIndex === currentStepIndex
                          ? 'bg-brand-primary/20 text-brand-primary ring-2 ring-brand-primary'
                          : 'bg-neutral-200 text-neutral-500'
                    )}>
                      {stepIndex < currentStepIndex ? (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        step.icon
                      )}
                    </div>
                    <span className="text-xs font-medium">{step.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="flex flex-col">
              <div className="max-h-[60vh] overflow-y-auto px-6 py-6">
                {/* Step 1: Basic Info */}
                {currentStep === 'basic' && (
                  <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-neutral-700">
                          名前 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formState.values.name}
                          onChange={(e) => handleValuesChange('name', e.target.value)}
                          placeholder="例: 三上 ゆり"
                          className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-neutral-700">ニックネーム</label>
                        <input
                          type="text"
                          value={formState.values.alias}
                          onChange={(e) => handleValuesChange('alias', e.target.value)}
                          placeholder="例: ゆりちゃん"
                          className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700">紹介文（キャッチコピー）</label>
                      <input
                        type="text"
                        value={formState.values.headline}
                        onChange={(e) => handleValuesChange('headline', e.target.value)}
                        placeholder="例: 癒しのゴッドハンドで至福のひとときを"
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700">プロフィール詳細</label>
                      <textarea
                        value={formState.values.biography}
                        onChange={(e) => handleValuesChange('biography', e.target.value)}
                        placeholder="経歴や得意な施術、メッセージなどを記載してください。"
                        rows={4}
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: Details */}
                {currentStep === 'details' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700">得意な施術</label>
                      <TagInput
                        tags={formState.values.specialties}
                        onChange={(tags) => handleValuesChange('specialties', tags)}
                        placeholder="タグを入力..."
                        suggestions={SPECIALTY_SUGGESTIONS}
                        maxTags={10}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700">保有資格</label>
                      <TagInput
                        tags={formState.values.qualifications}
                        onChange={(tags) => handleValuesChange('qualifications', tags)}
                        placeholder="資格を入力..."
                        suggestions={QUALIFICATION_SUGGESTIONS}
                        maxTags={10}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-neutral-700">経験年数</label>
                        <input
                          type="number"
                          value={formState.values.experienceYears}
                          onChange={(e) => handleValuesChange('experienceYears', e.target.value)}
                          placeholder="例: 3"
                          min={0}
                          className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        />
                      </div>
                      {formState.mode === 'edit' && (
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-neutral-700">公開ステータス</label>
                          <select
                            value={formState.values.status}
                            onChange={(e) => handleValuesChange('status', e.target.value as DashboardTherapistSummary['status'])}
                            className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                          >
                            <option value="draft">📝 下書き</option>
                            <option value="published">✓ 公開中</option>
                            <option value="archived">📦 アーカイブ</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <label className="flex items-center gap-3 rounded-xl border border-neutral-200 p-4 transition hover:bg-neutral-50">
                      <input
                        type="checkbox"
                        checked={formState.values.isBookingEnabled}
                        onChange={(e) => handleValuesChange('isBookingEnabled', e.target.checked)}
                        className="h-5 w-5 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
                      />
                      <div>
                        <p className="font-medium text-neutral-700">オンライン予約を受け付ける</p>
                        <p className="text-xs text-neutral-500">オフにすると予約ボタンが非表示になります</p>
                      </div>
                    </label>
                  </div>
                )}

                {/* Step 3: Photos */}
                {currentStep === 'photos' && (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-brand-primary/5 p-4">
                      <p className="text-sm font-medium text-brand-primaryDark">
                        💡 ヒント: 最初の写真がメイン画像として表示されます。ドラッグで並び替えできます。
                      </p>
                    </div>
                    <PhotoGrid
                      photos={formState.values.photoUrls}
                      onChange={(photos) => handleValuesChange('photoUrls', photos)}
                      onUpload={handlePhotoUpload}
                      disabled={isSubmitting}
                      isUploading={isUploadingPhoto}
                      error={photoUploadError}
                      maxPhotos={10}
                    />
                  </div>
                )}

                {/* Step 4: Preview */}
                {currentStep === 'preview' && (
                  <div className="space-y-6">
                    <div className="rounded-xl bg-neutral-100 p-4 text-center">
                      <p className="text-sm font-medium text-neutral-600">
                        実際の表示イメージをご確認ください
                      </p>
                    </div>
                    <TherapistPreviewCard values={formState.values} />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 flex items-center justify-between border-t border-neutral-200 bg-white px-6 py-4">
                <div>
                  {currentStepIndex > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={prevStep}
                      disabled={isSubmitting}
                    >
                      <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      戻る
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={closeForm}
                    disabled={isSubmitting}
                  >
                    キャンセル
                  </Button>
                  {currentStepIndex < WIZARD_STEPS.length - 1 ? (
                    <Button
                      type="button"
                      onClick={nextStep}
                      disabled={isSubmitting || (currentStep === 'basic' && !formState.values.name.trim())}
                    >
                      次へ
                      <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={isSubmitting || !formState.values.name.trim()}
                      className="gap-2 bg-gradient-to-r from-brand-primary to-brand-secondary"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          保存中...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {formState.mode === 'create' ? '追加する' : '保存する'}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// Keep exports for backwards compatibility
export type { TherapistPhotoFieldProps } from './TherapistManager-legacy'
export { TherapistPhotoField } from './TherapistManager-legacy'
