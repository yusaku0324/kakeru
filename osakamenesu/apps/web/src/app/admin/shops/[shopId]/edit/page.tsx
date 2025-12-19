'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type Shop = {
  id: string
  name: string
  slug?: string | null
  area?: string | null
  status?: string | null
  buffer_minutes?: number | null
  room_count?: number | null
  default_slot_duration_minutes?: number | null
  price_min?: number | null
  price_max?: number | null
  nearest_station?: string | null
  station_walk_minutes?: number | null
  photos?: string[]
  contact?: {
    phone?: string | null
    line_id?: string | null
    website_url?: string | null
  } | null
  description?: string | null
  catch_copy?: string | null
  address?: string | null
}

const STATUS_OPTIONS = [
  { value: 'draft', label: '下書き', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'published', label: '公開中', color: 'bg-green-100 text-green-800' },
]

const AREA_OPTIONS = [
  '梅田', '難波', '心斎橋', '天王寺', '京橋', '十三', '堺', '東大阪', 'その他',
]

export default function AdminShopEditPage() {
  const params = useParams<{ shopId: string }>()
  const shopId = params.shopId

  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Confirmation dialog state
  const [showStatusConfirm, setShowStatusConfirm] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const initialStatus = useRef<string>('draft')

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [area, setArea] = useState('')
  const [status, setStatus] = useState('draft')
  const [description, setDescription] = useState('')
  const [catchCopy, setCatchCopy] = useState('')
  const [address, setAddress] = useState('')
  const [bufferMinutes, setBufferMinutes] = useState('')
  const [roomCount, setRoomCount] = useState('')
  const [defaultSlotDuration, setDefaultSlotDuration] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [nearestStation, setNearestStation] = useState('')
  const [stationWalkMinutes, setStationWalkMinutes] = useState('')
  const [photos, setPhotos] = useState('')
  const [phone, setPhone] = useState('')
  const [lineId, setLineId] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/admin/shops/${shopId}`, { cache: 'no-store' })
      if (!resp.ok) throw new Error(`status ${resp.status}`)
      const data = await resp.json()
      setShop(data)
      // Populate form
      setName(data.name || '')
      setSlug(data.slug || '')
      setArea(data.area || '')
      setStatus(data.status || 'draft')
      initialStatus.current = data.status || 'draft'
      setDescription(data.description || '')
      setCatchCopy(data.catch_copy || '')
      setAddress(data.address || '')
      setBufferMinutes(data.buffer_minutes?.toString() || '')
      setRoomCount(data.room_count?.toString() || '')
      setDefaultSlotDuration(data.default_slot_duration_minutes?.toString() || '')
      setPriceMin(data.price_min?.toString() || '')
      setPriceMax(data.price_max?.toString() || '')
      setNearestStation(data.nearest_station || '')
      setStationWalkMinutes(data.station_walk_minutes?.toString() || '')
      setPhotos((data.photos || []).join('\n'))
      setPhone(data.contact?.phone || '')
      setLineId(data.contact?.line_id || '')
      setWebsiteUrl(data.contact?.website_url || '')
    } catch (e) {
      console.error('failed to load shop', e)
      setError('店舗情報の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    void load()
  }, [load])

  // Handle status change with confirmation for publishing
  const handleStatusChange = useCallback((newStatus: string) => {
    // Confirm when publishing (draft → published)
    if (newStatus === 'published' && initialStatus.current !== 'published') {
      setPendingStatus(newStatus)
      setShowStatusConfirm(true)
    }
    // Confirm when unpublishing (published → draft)
    else if (newStatus !== 'published' && initialStatus.current === 'published') {
      setPendingStatus(newStatus)
      setShowStatusConfirm(true)
    }
    // No confirmation needed for other changes
    else {
      setStatus(newStatus)
    }
  }, [])

  const confirmStatusChange = useCallback(() => {
    if (pendingStatus) {
      setStatus(pendingStatus)
    }
    setPendingStatus(null)
    setShowStatusConfirm(false)
  }, [pendingStatus])

  const cancelStatusChange = useCallback(() => {
    setPendingStatus(null)
    setShowStatusConfirm(false)
  }, [])

  // Validation
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {}

    // Name validation
    if (!name.trim()) {
      errors.name = '店舗名は必須です'
    } else if (name.trim().length > 100) {
      errors.name = '店舗名は100文字以内で入力してください'
    }

    // Slug validation
    if (slug.trim() && !/^[a-z0-9-]+$/.test(slug.trim())) {
      errors.slug = 'スラッグは半角英数字とハイフンのみ使用可能です'
    }

    // Catch copy validation
    if (catchCopy.trim().length > 100) {
      errors.catchCopy = 'キャッチコピーは100文字以内で入力してください'
    }

    // Description validation
    if (description.trim().length > 2000) {
      errors.description = '店舗説明は2000文字以内で入力してください'
    }

    // Buffer minutes validation
    if (bufferMinutes && (Number(bufferMinutes) < 0 || Number(bufferMinutes) > 120)) {
      errors.bufferMinutes = 'バッファ時間は0〜120分の範囲で入力してください'
    }

    // Room count validation
    if (roomCount && Number(roomCount) < 1) {
      errors.roomCount = '同時予約可能数は1以上で入力してください'
    }

    // Default slot duration validation
    if (defaultSlotDuration && Number(defaultSlotDuration) < 30) {
      errors.defaultSlotDuration = 'デフォルト施術時間は30分以上で入力してください'
    }

    // Price validation
    if (priceMin && priceMax && Number(priceMin) > Number(priceMax)) {
      errors.priceMin = '最低価格は最高価格以下にしてください'
    }

    // Photo URL validation
    const photoList = photos.split('\n').map((u) => u.trim()).filter(Boolean)
    const invalidUrls = photoList.filter((url) => {
      try {
        new URL(url)
        return false
      } catch {
        return true
      }
    })
    if (invalidUrls.length > 0) {
      errors.photos = '無効なURLが含まれています'
    }

    // Website URL validation
    if (websiteUrl.trim()) {
      try {
        new URL(websiteUrl.trim())
      } catch {
        errors.websiteUrl = '有効なURLを入力してください'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [name, slug, catchCopy, description, bufferMinutes, roomCount, defaultSlotDuration, priceMin, priceMax, photos, websiteUrl])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!validateForm()) {
      return
    }

    setSaving(true)

    const payload: Record<string, unknown> = {
      name: name.trim(),
    }

    // Basic info
    if (slug.trim()) payload.slug = slug.trim()
    payload.area = area || null
    payload.status = status
    if (description.trim()) payload.description = description.trim()
    if (catchCopy.trim()) payload.catch_copy = catchCopy.trim()
    if (address.trim()) payload.address = address.trim()

    // Settings
    if (bufferMinutes) payload.buffer_minutes = Number(bufferMinutes)
    if (roomCount) payload.room_count = Number(roomCount)
    if (defaultSlotDuration) payload.default_slot_duration_minutes = Number(defaultSlotDuration)

    // Price
    if (priceMin) payload.price_min = Number(priceMin)
    if (priceMax) payload.price_max = Number(priceMax)

    // Photos
    const photoList = photos.split('\n').map((u) => u.trim()).filter(Boolean)
    payload.photos = photoList

    // Contact
    payload.contact = {
      phone: phone.trim() || null,
      line_id: lineId.trim() || null,
      website_url: websiteUrl.trim() || null,
    }

    try {
      const resp = await fetch(`/api/admin/shops/${shopId}/content`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        setError(data.detail || '店舗の更新に失敗しました')
        return
      }
      setSuccess('保存しました')
      await load()
    } catch (e) {
      console.error('failed to update shop', e)
      setError('店舗の更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-4">
        <div className="text-neutral-textMuted">読み込み中…</div>
      </main>
    )
  }

  if (!shop) {
    return (
      <main className="mx-auto max-w-4xl p-4">
        <div className="text-red-600">{error || '店舗が見つかりません'}</div>
        <Link href="/admin/shops" className="text-brand-primary underline mt-2 inline-block">
          店舗一覧に戻る
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">店舗編集</h1>
          <p className="text-sm text-neutral-textMuted">ID: {shopId}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/shops/${shopId}/therapists`}
            className="rounded bg-neutral-100 px-3 py-1.5 text-sm hover:bg-neutral-200"
          >
            セラピスト管理
          </Link>
          <Link
            href={`/admin/shops/${shopId}/reservations`}
            className="rounded bg-neutral-100 px-3 py-1.5 text-sm hover:bg-neutral-200"
          >
            予約一覧
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-green-800">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Status Section */}
        <section className="rounded border border-neutral-borderLight bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">公開設定</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              ステータス
              <select
                className="mt-1 w-full rounded border border-neutral-borderLight bg-white px-2 py-1.5"
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {status === 'published' && (
                <p className="mt-1 text-xs text-green-600">公開中 - ユーザーに表示されます</p>
              )}
            </label>
            <label className="block">
              URL スラッグ
              <input
                className={`mt-1 w-full rounded border px-2 py-1.5 ${validationErrors.slug ? 'border-red-500' : 'border-neutral-borderLight'}`}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="例: my-shop"
              />
              {validationErrors.slug ? (
                <p className="mt-1 text-xs text-red-500">{validationErrors.slug}</p>
              ) : (
                <p className="mt-1 text-xs text-neutral-textMuted">
                  /profiles/{slug || 'shop-slug'} でアクセス可能
                </p>
              )}
            </label>
          </div>
        </section>

        {/* Basic Info Section */}
        <section className="rounded border border-neutral-borderLight bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">基本情報</h2>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                店舗名 <span className="text-red-500">*</span>
                <input
                  className={`mt-1 w-full rounded border px-2 py-1.5 ${validationErrors.name ? 'border-red-500' : 'border-neutral-borderLight'}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="必須"
                />
                {validationErrors.name && (
                  <p className="mt-1 text-xs text-red-500">{validationErrors.name}</p>
                )}
              </label>
              <label className="block">
                エリア
                <select
                  className="mt-1 w-full rounded border border-neutral-borderLight bg-white px-2 py-1.5"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                >
                  <option value="">選択してください</option>
                  {AREA_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              キャッチコピー
              <input
                className={`mt-1 w-full rounded border px-2 py-1.5 ${validationErrors.catchCopy ? 'border-red-500' : 'border-neutral-borderLight'}`}
                value={catchCopy}
                onChange={(e) => setCatchCopy(e.target.value)}
                placeholder="例: 癒しの空間で極上のひととき"
              />
              {validationErrors.catchCopy && (
                <p className="mt-1 text-xs text-red-500">{validationErrors.catchCopy}</p>
              )}
            </label>
            <label className="block">
              店舗説明
              <textarea
                className={`mt-1 w-full rounded border px-2 py-1.5 ${validationErrors.description ? 'border-red-500' : 'border-neutral-borderLight'}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="店舗の説明文を入力してください"
                rows={4}
              />
              {validationErrors.description && (
                <p className="mt-1 text-xs text-red-500">{validationErrors.description}</p>
              )}
            </label>
            <label className="block">
              住所
              <input
                className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1.5"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="例: 大阪市北区梅田1-1-1"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                最寄り駅
                <input
                  className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1.5"
                  value={nearestStation}
                  onChange={(e) => setNearestStation(e.target.value)}
                  placeholder="例: 梅田駅"
                />
              </label>
              <label className="block">
                徒歩（分）
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1.5"
                  value={stationWalkMinutes}
                  onChange={(e) => setStationWalkMinutes(e.target.value)}
                  placeholder="例: 5"
                  min="0"
                />
              </label>
            </div>
          </div>
        </section>

        {/* Settings Section */}
        <section className="rounded border border-neutral-borderLight bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">予約設定</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              バッファ時間（分）
              <input
                type="number"
                className={`mt-1 w-full rounded border px-2 py-1.5 ${validationErrors.bufferMinutes ? 'border-red-500' : 'border-neutral-borderLight'}`}
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(e.target.value)}
                placeholder="例: 15"
                min="0"
                max="120"
              />
              {validationErrors.bufferMinutes ? (
                <p className="mt-1 text-xs text-red-500">{validationErrors.bufferMinutes}</p>
              ) : (
                <p className="mt-1 text-xs text-neutral-textMuted">予約間の準備時間</p>
              )}
            </label>
            <label className="block">
              同時予約可能数
              <input
                type="number"
                className={`mt-1 w-full rounded border px-2 py-1.5 ${validationErrors.roomCount ? 'border-red-500' : 'border-neutral-borderLight'}`}
                value={roomCount}
                onChange={(e) => setRoomCount(e.target.value)}
                placeholder="例: 1"
                min="1"
              />
              {validationErrors.roomCount ? (
                <p className="mt-1 text-xs text-red-500">{validationErrors.roomCount}</p>
              ) : (
                <p className="mt-1 text-xs text-neutral-textMuted">部屋数・ベッド数</p>
              )}
            </label>
            <label className="block">
              デフォルト施術時間（分）
              <input
                type="number"
                className={`mt-1 w-full rounded border px-2 py-1.5 ${validationErrors.defaultSlotDuration ? 'border-red-500' : 'border-neutral-borderLight'}`}
                value={defaultSlotDuration}
                onChange={(e) => setDefaultSlotDuration(e.target.value)}
                placeholder="例: 60"
                min="30"
                step="30"
              />
              {validationErrors.defaultSlotDuration && (
                <p className="mt-1 text-xs text-red-500">{validationErrors.defaultSlotDuration}</p>
              )}
            </label>
          </div>
        </section>

        {/* Price Section */}
        <section className="rounded border border-neutral-borderLight bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">料金</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              最低価格（円）
              <input
                type="number"
                className={`mt-1 w-full rounded border px-2 py-1.5 ${validationErrors.priceMin ? 'border-red-500' : 'border-neutral-borderLight'}`}
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="例: 5000"
                min="0"
                step="1000"
              />
              {validationErrors.priceMin && (
                <p className="mt-1 text-xs text-red-500">{validationErrors.priceMin}</p>
              )}
            </label>
            <label className="block">
              最高価格（円）
              <input
                type="number"
                className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1.5"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="例: 15000"
                min="0"
                step="1000"
              />
            </label>
          </div>
        </section>

        {/* Photos Section */}
        <section className="rounded border border-neutral-borderLight bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">写真</h2>
          <label className="block">
            写真URL（1行に1つ）
            <textarea
              className={`mt-1 w-full rounded border px-2 py-1.5 font-mono text-sm ${validationErrors.photos ? 'border-red-500' : 'border-neutral-borderLight'}`}
              value={photos}
              onChange={(e) => setPhotos(e.target.value)}
              placeholder="https://example.com/photo1.jpg&#10;https://example.com/photo2.jpg"
              rows={4}
            />
            {validationErrors.photos && (
              <p className="mt-1 text-xs text-red-500">{validationErrors.photos}</p>
            )}
          </label>
        </section>

        {/* Contact Section */}
        <section className="rounded border border-neutral-borderLight bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">連絡先</h2>
          <div className="space-y-3">
            <label className="block">
              電話番号
              <input
                type="tel"
                className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1.5"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="例: 06-1234-5678"
              />
            </label>
            <label className="block">
              LINE ID
              <input
                className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1.5"
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                placeholder="例: @myshop"
              />
            </label>
            <label className="block">
              ウェブサイトURL
              <input
                type="url"
                className={`mt-1 w-full rounded border px-2 py-1.5 ${validationErrors.websiteUrl ? 'border-red-500' : 'border-neutral-borderLight'}`}
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="例: https://example.com"
              />
              {validationErrors.websiteUrl && (
                <p className="mt-1 text-xs text-red-500">{validationErrors.websiteUrl}</p>
              )}
            </label>
          </div>
        </section>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded bg-brand-primary px-6 py-2 text-white hover:brightness-110 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? '保存中…' : '保存する'}
          </button>
          <Link
            href="/admin/shops"
            className="rounded border border-neutral-borderLight bg-white px-6 py-2 hover:bg-neutral-50"
          >
            キャンセル
          </Link>
        </div>
      </form>

      {/* Status change confirmation dialog */}
      <ConfirmDialog
        open={showStatusConfirm}
        title={pendingStatus === 'published' ? '店舗を公開しますか？' : '店舗を非公開にしますか？'}
        message={
          pendingStatus === 'published'
            ? 'この店舗がユーザーに表示されるようになります。公開してもよろしいですか？'
            : 'この店舗がユーザーに表示されなくなります。非公開にしてもよろしいですか？'
        }
        confirmLabel={pendingStatus === 'published' ? '公開する' : '非公開にする'}
        cancelLabel="キャンセル"
        variant={pendingStatus === 'published' ? 'default' : 'danger'}
        onConfirm={confirmStatusChange}
        onCancel={cancelStatusChange}
      />
    </main>
  )
}
