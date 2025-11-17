'use client'

import { FormEvent, useMemo, useState } from 'react'

import { ToastContainer, useToast } from '@/components/useToast'
import { Card } from '@/components/ui/Card'
import {
  DashboardShopContact,
  DashboardShopMenu,
  DashboardShopProfile,
  DashboardShopProfileUpdatePayload,
  DashboardShopServiceType,
  updateDashboardShopProfile,
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
}

const SERVICE_TYPE_OPTIONS: { value: DashboardShopServiceType; label: string }[] = [
  { value: 'store', label: '店舗型' },
  { value: 'dispatch', label: '出張型' },
]

const STATUS_OPTIONS: {
  value: 'draft' | 'published' | 'hidden'
  label: string
  description: string
}[] = [
  {
    value: 'draft',
    label: '下書き',
    description: '検索には表示されず、編集者だけが閲覧できます。',
  },
  {
    value: 'published',
    label: '公開中',
    description: '検索結果に表示され、一般ユーザーが閲覧できます。',
  },
  {
    value: 'hidden',
    label: '非公開',
    description: '検索には表示されず、URL を知っているユーザーだけがアクセスできます。',
  },
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
  }
}

function emptyMenu(): MenuDraft {
  return { name: '', price: '', duration: '', description: '', tags: '' }
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
  const [tagInput, setTagInput] = useState('')
  const [description, setDescription] = useState(initialData.description ?? '')
  const [catchCopy, setCatchCopy] = useState(initialData.catch_copy ?? '')
  const [address, setAddress] = useState(initialData.address ?? '')
  const [statusValue, setStatusValue] = useState<'draft' | 'published' | 'hidden'>(
    (initialData.status as 'draft' | 'published' | 'hidden' | undefined) ?? 'draft',
  )
  const [contact, setContact] = useState<ContactDraft>(normalizeContact(initialData.contact))
  const [photos, setPhotos] = useState<string[]>(
    initialData.photos && initialData.photos.length ? [...initialData.photos] : [''],
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
    setTagInput('')
    setDescription(data.description ?? '')
    setCatchCopy(data.catch_copy ?? '')
    setAddress(data.address ?? '')
    setStatusValue((data.status as 'draft' | 'published' | 'hidden' | undefined) ?? 'draft')
    setContact(normalizeContact(data.contact))
    setPhotos(data.photos && data.photos.length ? [...data.photos] : [''])
    setMenus(data.menus && data.menus.length ? data.menus.map(toMenuDraft) : [emptyMenu()])
    setUpdatedAt(data.updated_at)
  }

  function handleAddTag() {
    const value = tagInput.trim()
    if (!value) return
    if (serviceTags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      setTagInput('')
      return
    }
    setServiceTags((prev) => [...prev, value])
    setTagInput('')
  }

  function handleRemoveTag(index: number) {
    setServiceTags((prev) => prev.filter((_, idx) => idx !== index))
  }

  function handlePhotoChange(index: number, value: string) {
    setPhotos((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  function handleAddPhotoField() {
    setPhotos((prev) => [...prev, ''])
  }

  function handleRemovePhotoField(index: number) {
    setPhotos((prev) => {
      const next = prev.filter((_, idx) => idx !== index)
      return next.length ? next : ['']
    })
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

    const photoList = photos.map((url) => url.trim()).filter(Boolean)

    const normalizedContactValues: ContactDraft = {
      phone: contact.phone.trim(),
      line_id: contact.line_id.trim(),
      website_url: contact.website_url.trim(),
      reservation_form_url: contact.reservation_form_url.trim(),
    }
    const hasContactValue = Object.values(normalizedContactValues).some((value) => value.length > 0)
    const contactPayload: DashboardShopContact | null = hasContactValue
      ? {
          phone: normalizedContactValues.phone || undefined,
          line_id: normalizedContactValues.line_id || undefined,
          website_url: normalizedContactValues.website_url || undefined,
          reservation_form_url: normalizedContactValues.reservation_form_url || undefined,
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
      photos: photoList,
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
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={remove} />

      {formError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      ) : null}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <Card className="space-y-6 p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">基本情報</h2>
            <p className="text-sm text-neutral-600">
              サイト上に表示される店舗名や料金などの基本情報を設定してください。
            </p>
            <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-surfaceAlt px-3 py-2 text-xs text-neutral-600 md:flex-row md:items-center md:gap-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold uppercase tracking-wide text-neutral-500">
                  ステータス
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-semibold text-white">
                  {selectedStatusOption.label}
                </span>
              </div>
              <p className="text-neutral-500">{selectedStatusOption.description}</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-neutral-600">店舗名 *</span>
              <input
                id="shop-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                placeholder="例: アロマリゾート 難波本店"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-neutral-600">スラッグ</span>
              <input
                id="shop-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                placeholder="例: aroma-namba"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-neutral-600">エリア *</span>
              <input
                id="shop-area"
                value={area}
                onChange={(event) => setArea(event.target.value)}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                placeholder="例: 難波 / 心斎橋"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-neutral-600">サービス形態</span>
              <select
                id="shop-service-type"
                value={serviceType}
                onChange={(event) => setServiceType(event.target.value as DashboardShopServiceType)}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              >
                {SERVICE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-neutral-600">公開ステータス</span>
              <select
                id="shop-status"
                value={statusValue}
                onChange={(event) =>
                  setStatusValue(event.target.value as 'draft' | 'published' | 'hidden')
                }
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-neutral-600">料金（下限）</span>
              <input
                id="shop-price-min"
                value={priceMin}
                onChange={(event) => setPriceMin(event.target.value)}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                type="number"
                min={0}
                placeholder="例: 9000"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-neutral-600">料金（上限）</span>
              <input
                id="shop-price-max"
                value={priceMax}
                onChange={(event) => setPriceMax(event.target.value)}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                type="number"
                min={0}
                placeholder="例: 16000"
              />
            </label>
          </div>
        </Card>

        <Card className="space-y-6 p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">店舗紹介</h2>
            <p className="text-sm text-neutral-600">
              サイトの店舗ページに表示される紹介文とキャッチコピーを設定します。
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-neutral-600">紹介文</span>
              <textarea
                id="shop-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="h-32 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                placeholder="お店の特徴やこだわりを記載してください。"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-neutral-600">キャッチコピー</span>
              <textarea
                id="shop-catch-copy"
                value={catchCopy}
                onChange={(event) => setCatchCopy(event.target.value)}
                className="h-32 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                placeholder="短いフレーズで魅力を伝えましょう。"
              />
            </label>
          </div>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-600">住所</span>
            <input
              id="shop-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              placeholder="例: 大阪市中央区○○1-2-3"
            />
          </label>
        </Card>

        <Card className="space-y-6 p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">サービスタグ</h2>
            <p className="text-sm text-neutral-600">
              検索条件や店舗ページに表示されるタグです。例: アロマ, メンズエステ, 出張可
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {serviceTags.length === 0 ? (
              <span className="rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs text-neutral-500">
                タグ未設定
              </span>
            ) : (
              serviceTags.map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(index)}
                    className="text-neutral-400 transition hover:text-red-500"
                    aria-label={`${tag} を削除`}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              id="shop-tag-input"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleAddTag()
                }
              }}
              className="flex-1 rounded-md border border-neutral-200 px-3 py-2 text-sm"
              placeholder="例: 指圧, よもぎ蒸し"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="inline-flex items-center justify-center rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              タグを追加
            </button>
          </div>
        </Card>
        <Card className="space-y-6 p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">掲載写真</h2>
            <p className="text-sm text-neutral-600">
              ギャラリーに表示する画像 URL を登録してください。1 枚目がリード画像になります。
            </p>
          </div>
          <div className="space-y-3">
            {photos.map((photo, index) => (
              <div
                key={`photo-${index}`}
                className="flex flex-col gap-2 md:flex-row md:items-center"
              >
                <label className="flex-1">
                  <span className="sr-only">写真 {index + 1}</span>
                  <input
                    value={photo}
                    onChange={(event) => handlePhotoChange(index, event.target.value)}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                    placeholder={`写真 ${index + 1} の URL`}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleRemovePhotoField(index)}
                    className="rounded-md border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100"
                  >
                    削除
                  </button>
                  {index === photos.length - 1 ? (
                    <button
                      type="button"
                      onClick={handleAddPhotoField}
                      className="rounded-md border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
                    >
                      追加
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-6 p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">連絡先</h2>
            <p className="text-sm text-neutral-600">
              電話・LINE・公式サイトなどの連絡方法を登録します。未入力の項目は表示されません。
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-neutral-600">電話番号</span>
              <input
                id="shop-contact-phone"
                value={contact.phone}
                onChange={(event) => setContact((prev) => ({ ...prev, phone: event.target.value }))}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                placeholder="例: 06-1234-5678"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-neutral-600">LINE ID / URL</span>
              <input
                id="shop-contact-line"
                value={contact.line_id}
                onChange={(event) =>
                  setContact((prev) => ({ ...prev, line_id: event.target.value }))
                }
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                placeholder="LINE ID または https:// から始まる URL"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-neutral-600">公式サイト</span>
              <input
                id="shop-contact-website"
                value={contact.website_url}
                onChange={(event) =>
                  setContact((prev) => ({ ...prev, website_url: event.target.value }))
                }
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                placeholder="例: https://example.com"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-neutral-600">WEB 予約フォーム</span>
              <input
                id="shop-contact-reservation"
                value={contact.reservation_form_url}
                onChange={(event) =>
                  setContact((prev) => ({
                    ...prev,
                    reservation_form_url: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                placeholder="例: https://form.example.com"
              />
            </label>
          </div>
        </Card>

        <Card className="space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">メニュー</h2>
              <p className="text-sm text-neutral-600">
                代表的なコースや料金プランを登録してください。メニュー名が空の場合は保存時に除外されます。
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddMenu}
              className="inline-flex items-center rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              メニューを追加
            </button>
          </div>
          <div className="space-y-4">
            {menus.map((menu, index) => (
              <div
                key={menu.id ?? `menu-${index}`}
                className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-neutral-700">メニュー {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => handleRemoveMenu(index)}
                    className="text-xs font-medium text-neutral-500 transition hover:text-red-500"
                  >
                    削除
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-neutral-600">メニュー名</span>
                    <input
                      value={menu.name}
                      onChange={(event) => handleMenuChange(index, 'name', event.target.value)}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="例: 90分 コース"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-neutral-600">料金 (円)</span>
                    <input
                      value={menu.price}
                      onChange={(event) => handleMenuChange(index, 'price', event.target.value)}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      type="number"
                      min={0}
                      placeholder="例: 13000"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-neutral-600">施術時間 (分)</span>
                    <input
                      value={menu.duration}
                      onChange={(event) => handleMenuChange(index, 'duration', event.target.value)}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      type="number"
                      min={0}
                      placeholder="例: 90"
                    />
                  </label>
                </div>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-neutral-600">説明</span>
                  <textarea
                    value={menu.description}
                    onChange={(event) => handleMenuChange(index, 'description', event.target.value)}
                    className="h-24 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                    placeholder="コース内容やおすすめポイントを記載してください。"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-neutral-600">
                    タグ (カンマ区切り)
                  </span>
                  <input
                    value={menu.tags}
                    onChange={(event) => handleMenuChange(index, 'tags', event.target.value)}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                    placeholder="例: オイル, ヘッドスパ"
                  />
                </label>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1 text-sm text-neutral-500">
            <p>プロフィール ID: {profileId}</p>
            {updatedAt ? <p>最終更新: {new Date(updatedAt).toLocaleString('ja-JP')}</p> : null}
            {lastSavedAtLabel ? <p>直近の保存: {lastSavedAtLabel}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => hydrateFromData(snapshot)}
              className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
            >
              保存済みの内容に戻す
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-400"
            >
              {isSaving ? '保存中…' : '変更を保存'}
            </button>
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
