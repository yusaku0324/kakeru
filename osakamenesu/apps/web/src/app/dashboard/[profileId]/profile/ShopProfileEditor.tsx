'use client'

import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import clsx from 'clsx'

import { ToastContainer, useToast } from '@/components/useToast'
import { TagInput } from '@/components/ui/TagInput'
import { PhotoGrid } from '@/components/ui/PhotoGrid'
import {
  DashboardShopContact,
  DashboardShopMenu,
  DashboardShopProfile,
  DashboardShopProfileUpdatePayload,
  DashboardShopServiceType,
  updateDashboardShopProfile,
  uploadDashboardShopPhoto,
} from '@/lib/dashboard-shops'
import { DashboardTherapistSummary } from '@/lib/dashboard-therapists'
import { TherapistManager } from './TherapistManager'

type Props = {
  profileId: string
  initialData: DashboardShopProfile
  initialTherapists: DashboardTherapistSummary[]
  initialTherapistsError?: string | null
}

type MenuDraft = {
  id?: string
  name: string
  price: string
  duration: string
  description: string
  tags: string
}

type ContactDraft = {
  phone: string
  line_id: string
  website_url: string
  reservation_form_url: string
  business_hours: string
}

const SERVICE_TYPE_OPTIONS: { value: DashboardShopServiceType; label: string; icon: string }[] = [
  { value: 'store', label: '店舗型', icon: '🏪' },
  { value: 'dispatch', label: '出張型', icon: '🚗' },
]

const STATUS_OPTIONS: {
  value: 'draft' | 'published' | 'hidden'
  label: string
  description: string
  icon: string
  color: string
}[] = [
  {
    value: 'draft',
    label: '下書き',
    description: '検索には表示されず、編集者だけが閲覧できます。',
    icon: '📝',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    value: 'published',
    label: '公開中',
    description: '検索結果に表示され、一般ユーザーが閲覧できます。',
    icon: '✅',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    value: 'hidden',
    label: '非公開',
    description: '検索には表示されず、URL を知っているユーザーだけがアクセスできます。',
    icon: '🔒',
    color: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  },
]

const TAG_SUGGESTIONS = [
  'アロマ',
  'メンズエステ',
  '出張可',
  '完全個室',
  '日本人セラピスト',
  '深夜営業',
  '指圧',
  'オイルマッサージ',
  'リンパ',
  'ヘッドスパ',
]

function toMenuDraft(menu: DashboardShopMenu): MenuDraft {
  return {
    id: menu.id,
    name: menu.name ?? '',
    price: typeof menu.price === 'number' ? String(menu.price) : (menu.price ?? ''),
    duration: menu.duration_minutes != null ? String(menu.duration_minutes) : '',
    description: menu.description ?? '',
    tags: Array.isArray(menu.tags)
      ? menu.tags.join(', ')
      : ((menu.tags as unknown as string) ?? ''),
  }
}

function normalizeContact(contact: DashboardShopContact | null | undefined): ContactDraft {
  return {
    phone: contact?.phone ?? '',
    line_id: contact?.line_id ?? '',
    website_url: contact?.website_url ?? '',
    reservation_form_url: contact?.reservation_form_url ?? '',
    business_hours: contact?.business_hours ?? '',
  }
}

function emptyMenu(): MenuDraft {
  return { name: '', price: '', duration: '', description: '', tags: '' }
}

// Section Card component
function SectionCard({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string
  description?: string
  icon?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={clsx(
        'overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md',
        className
      )}
    >
      <div className="border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white px-6 py-4">
        <div className="flex items-center gap-3">
          {icon && (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-lg">
              {icon}
            </span>
          )}
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
            {description && <p className="text-sm text-neutral-500">{description}</p>}
          </div>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  )
}

// Input field component
function InputField({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-1 text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && !error && <p className="text-xs text-neutral-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </label>
  )
}

export function ShopProfileEditor({
  profileId,
  initialData,
  initialTherapists,
  initialTherapistsError = null,
}: Props) {
  const { toasts, push, remove } = useToast()
  const [snapshot, setSnapshot] = useState<DashboardShopProfile>(initialData)
  const [name, setName] = useState(initialData.name ?? '')
  const [slug, setSlug] = useState(initialData.slug ?? '')
  const [area, setArea] = useState(initialData.area ?? '')
  const [priceMin, setPriceMin] = useState(
    typeof initialData.price_min === 'number' ? String(initialData.price_min) : '',
  )
  const [priceMax, setPriceMax] = useState(
    typeof initialData.price_max === 'number' ? String(initialData.price_max) : '',
  )
  const [serviceType, setServiceType] = useState<DashboardShopServiceType>(
    initialData.service_type ?? 'store',
  )
  const [serviceTags, setServiceTags] = useState<string[]>(initialData.service_tags ?? [])
  const [description, setDescription] = useState(initialData.description ?? '')
  const [catchCopy, setCatchCopy] = useState(initialData.catch_copy ?? '')
  const [address, setAddress] = useState(initialData.address ?? '')
  const [statusValue, setStatusValue] = useState<'draft' | 'published' | 'hidden'>(
    (initialData.status as 'draft' | 'published' | 'hidden' | undefined) ?? 'draft',
  )
  const [contact, setContact] = useState<ContactDraft>(normalizeContact(initialData.contact))
  const [photos, setPhotos] = useState<string[]>(
    initialData.photos && initialData.photos.length ? [...initialData.photos] : [],
  )
  const [menus, setMenus] = useState<MenuDraft[]>(
    initialData.menus && initialData.menus.length
      ? initialData.menus.map(toMenuDraft)
      : [emptyMenu()],
  )
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(initialData.updated_at)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPhotoUploading, setIsPhotoUploading] = useState(false)

  const lastSavedAtLabel = useMemo(() => {
    if (!lastSavedAt) return null
    try {
      return new Date(lastSavedAt).toLocaleString('ja-JP')
    } catch {
      return lastSavedAt
    }
  }, [lastSavedAt])

  const selectedStatusOption = useMemo(() => {
    return STATUS_OPTIONS.find((option) => option.value === statusValue) ?? STATUS_OPTIONS[0]
  }, [statusValue])

  function hydrateFromData(data: DashboardShopProfile) {
    setName(data.name ?? '')
    setSlug(data.slug ?? '')
    setArea(data.area ?? '')
    setPriceMin(typeof data.price_min === 'number' ? String(data.price_min) : '')
    setPriceMax(typeof data.price_max === 'number' ? String(data.price_max) : '')
    setServiceType(data.service_type ?? 'store')
    setServiceTags(data.service_tags ?? [])
    setDescription(data.description ?? '')
    setCatchCopy(data.catch_copy ?? '')
    setAddress(data.address ?? '')
    setStatusValue((data.status as 'draft' | 'published' | 'hidden' | undefined) ?? 'draft')
    setContact(normalizeContact(data.contact))
    setPhotos(data.photos && data.photos.length ? [...data.photos] : [])
    setMenus(data.menus && data.menus.length ? data.menus.map(toMenuDraft) : [emptyMenu()])
    setUpdatedAt(data.updated_at)
  }

  async function handlePhotoUpload(files: FileList) {
    setIsPhotoUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const result = await uploadDashboardShopPhoto(profileId, file)

        switch (result.status) {
          case 'success':
            setPhotos((prev) => [...prev, result.data.url])
            break
          case 'too_large':
            push('error', 'ファイルサイズが大きすぎます。5MB以下の画像をアップロードしてください。')
            break
          case 'unsupported_media_type':
            push('error', '対応していないファイル形式です。JPG, PNG, WebP形式の画像をアップロードしてください。')
            break
          case 'validation_error':
            push('error', result.message ?? '画像のアップロードに失敗しました。')
            break
          case 'unauthorized':
            push('error', 'セッションが切れました。ログインし直してください。')
            break
          case 'forbidden':
            push('error', '写真をアップロードする権限がありません。')
            break
          case 'not_found':
            push('error', '対象の店舗が見つかりませんでした。')
            break
          case 'error':
          default:
            push('error', result.message ?? '写真のアップロードに失敗しました。')
            break
        }
      }
      if (files.length > 0) {
        push('success', `${files.length}枚の写真をアップロードしました。`)
      }
    } catch (err) {
      console.error('[ShopProfileEditor] photo upload failed', err)
      push('error', '写真のアップロードに失敗しました。')
    } finally {
      setIsPhotoUploading(false)
    }
  }

  function handleMenuChange<T extends keyof MenuDraft>(index: number, key: T, value: MenuDraft[T]) {
    setMenus((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [key]: value }
      return next
    })
  }

  function handleAddMenu() {
    setMenus((prev) => [...prev, emptyMenu()])
  }

  function handleRemoveMenu(index: number) {
    setMenus((prev) => prev.filter((_, idx) => idx !== index))
  }

  function toInt(value: string, fallback: number) {
    const trimmed = value.trim()
    if (!trimmed) return fallback
    const parsed = Number(trimmed)
    if (Number.isNaN(parsed)) return fallback
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(0, Math.round(parsed))
  }

  function buildUpdatePayload(): DashboardShopProfileUpdatePayload | null {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError('店舗名を入力してください。')
      return null
    }

    const trimmedArea = area.trim()
    if (!trimmedArea) {
      setFormError('エリアを入力してください。')
      return null
    }

    const minValue = toInt(priceMin, 0)
    const maxValue = toInt(priceMax, 0)
    if (maxValue && minValue && maxValue < minValue) {
      setFormError('料金の上限は下限以上に設定してください。')
      return null
    }

    const normalizedTags = serviceTags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter(
        (tag, index, self) =>
          self.findIndex((t) => t.toLowerCase() === tag.toLowerCase()) === index,
      )

    const normalizedMenus: DashboardShopMenu[] = menus
      .map((menu) => ({
        id: menu.id,
        name: menu.name.trim(),
        price: toInt(menu.price, 0),
        duration_minutes: menu.duration.trim() ? toInt(menu.duration, 0) : undefined,
        description: menu.description.trim() || undefined,
        tags: menu.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      }))
      .filter((menu) => menu.name.length > 0)

    const normalizedContactValues: ContactDraft = {
      phone: contact.phone.trim(),
      line_id: contact.line_id.trim(),
      website_url: contact.website_url.trim(),
      reservation_form_url: contact.reservation_form_url.trim(),
      business_hours: contact.business_hours.trim(),
    }
    const hasContactValue = Object.values(normalizedContactValues).some((value) => value.length > 0)
    const contactPayload: DashboardShopContact | null = hasContactValue
      ? {
          phone: normalizedContactValues.phone || undefined,
          line_id: normalizedContactValues.line_id || undefined,
          website_url: normalizedContactValues.website_url || undefined,
          reservation_form_url: normalizedContactValues.reservation_form_url || undefined,
          business_hours: normalizedContactValues.business_hours || undefined,
        }
      : null

    const payload: DashboardShopProfileUpdatePayload = {
      updated_at: updatedAt,
      name: trimmedName,
      slug: slug.trim() || null,
      area: trimmedArea,
      price_min: minValue,
      price_max: maxValue,
      service_type: serviceType,
      service_tags: normalizedTags,
      description: description.trim() || null,
      catch_copy: catchCopy.trim() || null,
      address: address.trim() || null,
      photos: photos,
      contact: contactPayload,
      menus: normalizedMenus,
      status: statusValue,
    }

    return payload
  }

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault()
    setFormError(null)
    const payload = buildUpdatePayload()
    if (!payload) {
      push('error', '入力内容を確認してください。')
      return
    }

    try {
      setIsSaving(true)
      const result = await updateDashboardShopProfile(profileId, payload)

      switch (result.status) {
        case 'success': {
          hydrateFromData(result.data)
          setSnapshot(result.data)
          setLastSavedAt(new Date().toISOString())
          setFormError(null)
          push('success', '店舗情報を保存しました。')
          break
        }
        case 'conflict': {
          hydrateFromData(result.current)
          setSnapshot(result.current)
          setFormError(
            'ほかのユーザーが更新したため最新の内容に置き換えました。再度確認のうえ保存してください。',
          )
          push(
            'error',
            'ほかのユーザーが店舗情報を更新しました。内容を確認して再保存してください。',
          )
          break
        }
        case 'validation_error': {
          console.error('[dashboard] shop validation error', result.detail)
          setFormError(
            'サーバー側のバリデーションでエラーが発生しました。入力内容をご確認ください。',
          )
          push('error', '入力内容の保存でエラーが発生しました。')
          break
        }
        case 'unauthorized': {
          setFormError('セッションが切れました。再度ログインしてください。')
          push('error', 'セッションが切れました。ログインし直してください。')
          break
        }
        case 'forbidden': {
          setFormError('店舗情報を編集する権限がありません。')
          push('error', '編集権限がありません。')
          break
        }
        case 'not_found': {
          setFormError('対象の店舗情報が見つかりませんでした。')
          push('error', '店舗情報が見つかりません。')
          break
        }
        case 'error':
        default: {
          console.error('[dashboard] shop update error', result)
          const message =
            result.message ?? '店舗情報の保存に失敗しました。しばらくしてから再度お試しください。'
          setFormError(message)
          push('error', message)
          break
        }
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <ToastContainer toasts={toasts} onDismiss={remove} />

      {/* Status Banner */}
      <div
        className={clsx(
          'flex items-center gap-4 rounded-2xl border p-4',
          selectedStatusOption.color
        )}
      >
        <span className="text-2xl">{selectedStatusOption.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{selectedStatusOption.label}</span>
          </div>
          <p className="text-sm opacity-80">{selectedStatusOption.description}</p>
        </div>
        <select
          value={statusValue}
          onChange={(event) =>
            setStatusValue(event.target.value as 'draft' | 'published' | 'hidden')
          }
          className="rounded-lg border border-current/20 bg-white/50 px-3 py-1.5 text-sm font-medium backdrop-blur"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.icon} {option.label}
            </option>
          ))}
        </select>
      </div>

      {formError && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <svg className="h-5 w-5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-red-700">{formError}</span>
        </div>
      )}

      <form className="space-y-8" onSubmit={handleSubmit}>
        {/* Basic Info */}
        <SectionCard
          title="基本情報"
          description="サイト上に表示される店舗名や料金などの基本情報"
          icon="🏢"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <InputField label="店舗名" required>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="例: アロマリゾート 難波本店"
                required
              />
            </InputField>
            <InputField label="スラッグ" hint="URLに使用される識別子">
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="例: aroma-namba"
              />
            </InputField>
            <InputField label="エリア" required>
              <input
                value={area}
                onChange={(event) => setArea(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="例: 難波 / 心斎橋"
                required
              />
            </InputField>
            <InputField label="サービス形態">
              <div className="flex gap-3">
                {SERVICE_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setServiceType(option.value)}
                    className={clsx(
                      'flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all',
                      serviceType === option.value
                        ? 'border-brand-primary bg-brand-primary/5 text-brand-primary'
                        : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    )}
                  >
                    <span>{option.icon}</span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </InputField>
            <InputField label="料金（下限）" hint="円">
              <input
                value={priceMin}
                onChange={(event) => setPriceMin(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                type="number"
                min={0}
                placeholder="例: 9000"
              />
            </InputField>
            <InputField label="料金（上限）" hint="円">
              <input
                value={priceMax}
                onChange={(event) => setPriceMax(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                type="number"
                min={0}
                placeholder="例: 16000"
              />
            </InputField>
          </div>
        </SectionCard>

        {/* Shop Description */}
        <SectionCard
          title="店舗紹介"
          description="サイトの店舗ページに表示される紹介文とキャッチコピー"
          icon="📝"
        >
          <div className="space-y-6">
            <InputField label="キャッチコピー" hint="短いフレーズで魅力を伝えましょう">
              <input
                value={catchCopy}
                onChange={(event) => setCatchCopy(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="例: 心と体を癒す至福のひととき"
              />
            </InputField>
            <InputField label="紹介文">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="h-32 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="お店の特徴やこだわりを記載してください。"
              />
            </InputField>
            <InputField label="住所">
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="例: 大阪市中央区○○1-2-3"
              />
            </InputField>
          </div>
        </SectionCard>

        {/* Service Tags */}
        <SectionCard
          title="サービスタグ"
          description="検索条件や店舗ページに表示されるタグです"
          icon="🏷️"
        >
          <TagInput
            tags={serviceTags}
            onChange={setServiceTags}
            suggestions={TAG_SUGGESTIONS}
            placeholder="タグを入力して Enter"
            maxTags={20}
          />
        </SectionCard>

        {/* Photos */}
        <SectionCard
          title="掲載写真"
          description="写真をアップロードするか、ドラッグ&ドロップで追加できます。1枚目がメイン画像になります。"
          icon="📷"
        >
          <PhotoGrid
            photos={photos}
            onChange={setPhotos}
            onUpload={handlePhotoUpload}
            isUploading={isPhotoUploading}
            maxPhotos={10}
          />
        </SectionCard>

        {/* Contact */}
        <SectionCard
          title="連絡先"
          description="電話・LINE・公式サイトなどの連絡方法を登録します"
          icon="📞"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <InputField label="電話番号">
              <input
                value={contact.phone}
                onChange={(event) => setContact((prev) => ({ ...prev, phone: event.target.value }))}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="例: 06-1234-5678"
              />
            </InputField>
            <InputField label="LINE ID / URL">
              <input
                value={contact.line_id}
                onChange={(event) => setContact((prev) => ({ ...prev, line_id: event.target.value }))}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="LINE ID または URL"
              />
            </InputField>
            <InputField label="公式サイト">
              <input
                value={contact.website_url}
                onChange={(event) => setContact((prev) => ({ ...prev, website_url: event.target.value }))}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="例: https://example.com"
              />
            </InputField>
            <InputField label="WEB 予約フォーム">
              <input
                value={contact.reservation_form_url}
                onChange={(event) => setContact((prev) => ({ ...prev, reservation_form_url: event.target.value }))}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="例: https://form.example.com"
              />
            </InputField>
            <div className="md:col-span-2">
              <InputField label="営業時間">
                <input
                  value={contact.business_hours}
                  onChange={(event) => setContact((prev) => ({ ...prev, business_hours: event.target.value }))}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  placeholder="例: 10:00 - 翌3:00 / 年中無休"
                />
              </InputField>
            </div>
          </div>
        </SectionCard>

        {/* Menus */}
        <SectionCard
          title="メニュー"
          description="代表的なコースや料金プランを登録してください"
          icon="📋"
        >
          <div className="space-y-4">
            {menus.map((menu, index) => (
              <div
                key={menu.id ?? `menu-${index}`}
                className="group relative rounded-xl border border-neutral-200 bg-neutral-50/50 p-5 transition-all hover:border-neutral-300"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-brand-primary/10 px-3 py-1 text-sm font-medium text-brand-primary">
                    <span>📋</span>
                    メニュー {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMenu(index)}
                    className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
                  <InputField label="メニュー名">
                    <input
                      value={menu.name}
                      onChange={(event) => handleMenuChange(index, 'name', event.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      placeholder="例: 90分 コース"
                    />
                  </InputField>
                  <InputField label="料金 (円)">
                    <input
                      value={menu.price}
                      onChange={(event) => handleMenuChange(index, 'price', event.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      type="number"
                      min={0}
                      placeholder="例: 13000"
                    />
                  </InputField>
                  <InputField label="施術時間 (分)">
                    <input
                      value={menu.duration}
                      onChange={(event) => handleMenuChange(index, 'duration', event.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      type="number"
                      min={0}
                      placeholder="例: 90"
                    />
                  </InputField>
                </div>
                <div className="mt-4 space-y-4">
                  <InputField label="説明">
                    <textarea
                      value={menu.description}
                      onChange={(event) => handleMenuChange(index, 'description', event.target.value)}
                      className="h-20 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      placeholder="コース内容やおすすめポイントを記載してください。"
                    />
                  </InputField>
                  <InputField label="タグ" hint="カンマ区切りで入力">
                    <input
                      value={menu.tags}
                      onChange={(event) => handleMenuChange(index, 'tags', event.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      placeholder="例: オイル, ヘッドスパ"
                    />
                  </InputField>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddMenu}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-4 text-sm font-medium text-neutral-600 transition-all hover:border-brand-primary hover:bg-brand-primary/5 hover:text-brand-primary"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              メニューを追加
            </button>
          </div>
        </SectionCard>

        {/* Action Footer */}
        <div className="sticky bottom-4 z-10">
          <div className="rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500">
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  ID: {profileId.slice(0, 8)}...
                </span>
                {updatedAt && (
                  <span className="inline-flex items-center gap-1.5">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    更新: {new Date(updatedAt).toLocaleString('ja-JP')}
                  </span>
                )}
                {lastSavedAtLabel && (
                  <span className="inline-flex items-center gap-1.5 text-emerald-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    保存: {lastSavedAtLabel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => hydrateFromData(snapshot)}
                  className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 transition-all hover:bg-neutral-50"
                >
                  変更を破棄
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all',
                    'bg-gradient-to-r from-brand-primary to-brand-secondary',
                    'hover:shadow-xl hover:shadow-brand-primary/25',
                    'disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                >
                  {isSaving ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      保存中...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      変更を保存
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      <TherapistManager
        profileId={profileId}
        initialItems={initialTherapists}
        initialError={initialTherapistsError ?? null}
        onToast={push}
      />
    </div>
  )
}

export default ShopProfileEditor
