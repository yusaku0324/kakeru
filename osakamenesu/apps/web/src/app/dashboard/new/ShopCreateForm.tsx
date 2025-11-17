'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

import { ToastContainer, useToast } from '@/components/useToast'
import { Badge } from '@/components/ui/Badge'
import {
  createDashboardShopProfile,
  type DashboardShopProfileCreatePayload,
  type DashboardShopServiceType,
} from '@/lib/dashboard-shops'

type Props = {
  isAuthenticated: boolean
}

const SERVICE_TYPE_OPTIONS: { label: string; value: DashboardShopServiceType }[] = [
  { label: '店舗型', value: 'store' },
  { label: '出張型', value: 'dispatch' },
]

function parseCsv(input: string): string[] {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function parseMultiline(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
}

export function ShopCreateForm({ isAuthenticated }: Props) {
  const router = useRouter()
  const { toasts, push, remove } = useToast()

  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const [serviceType, setServiceType] = useState<DashboardShopServiceType>('store')
  const [priceMin, setPriceMin] = useState('7000')
  const [priceMax, setPriceMax] = useState('15000')
  const [serviceTags, setServiceTags] = useState('')
  const [phone, setPhone] = useState('')
  const [lineId, setLineId] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [reservationUrl, setReservationUrl] = useState('')
  const [address, setAddress] = useState('')
  const [catchCopy, setCatchCopy] = useState('')
  const [description, setDescription] = useState('')
  const [photoInputs, setPhotoInputs] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const trimmedName = name.trim()
    const trimmedArea = area.trim()

    if (!trimmedName) {
      setFormError('店舗名を入力してください。')
      return
    }
    if (!trimmedArea) {
      setFormError('エリアを入力してください。')
      return
    }

    const minValue = Number(priceMin)
    const maxValue = Number(priceMax)
    if (Number.isNaN(minValue) || Number.isNaN(maxValue)) {
      setFormError('料金は数値で入力してください。')
      return
    }
    if (maxValue < minValue) {
      setFormError('料金の上限は下限以上に設定してください。')
      return
    }

    const payload: DashboardShopProfileCreatePayload = {
      name: trimmedName,
      area: trimmedArea,
      price_min: Math.max(0, Math.floor(minValue)),
      price_max: Math.max(0, Math.floor(maxValue)),
      service_type: serviceType,
      service_tags: parseCsv(serviceTags),
      description: description.trim() || undefined,
      catch_copy: catchCopy.trim() || undefined,
      address: address.trim() || undefined,
      photos: parseMultiline(photoInputs),
      contact: {
        phone: phone.trim() || undefined,
        line_id: lineId.trim() || undefined,
        website_url: websiteUrl.trim() || undefined,
        reservation_form_url: reservationUrl.trim() || undefined,
      },
    }

    setIsSubmitting(true)
    try {
      const result = await createDashboardShopProfile(payload)
      switch (result.status) {
        case 'success': {
          push('success', '店舗を作成しました')
          router.replace(`/dashboard/${result.data.id}/profile`)
          return
        }
        case 'unauthorized':
          setFormError('ログインが必要です。ログインページからマジックリンクを再送信してください。')
          break
        case 'forbidden':
          setFormError('店舗を作成する権限がありません。運営までお問い合わせください。')
          break
        case 'validation_error':
          setFormError('入力内容に不備があります。再度ご確認ください。')
          break
        case 'error':
          setFormError(result.message)
          break
        default:
          setFormError('店舗の作成に失敗しました。時間をおいて再度お試しください。')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-4">
        <ToastContainer toasts={toasts} onDismiss={remove} />
        <p className="text-sm text-neutral-600">
          店舗を作成するにはログインが必要です。ログインページからマジックリンクを送信し、メール経由でログインした後にこのページを再読み込みしてください。
        </p>
        <Link
          href="/dashboard/login"
          className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
        >
          ログインページへ
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={remove} />
      {formError ? (
        <div className="rounded border border-state-dangerBorder bg-state-dangerBg/40 px-4 py-3 text-sm text-state-dangerText">
          {formError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-neutral-text">店舗名 *</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
                placeholder="例) 難波/日本橋メンエス A店"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-neutral-text">エリア *</span>
              <input
                type="text"
                value={area}
                onChange={(event) => setArea(event.target.value)}
                className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
                placeholder="例) 難波/日本橋"
                required
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-medium text-neutral-text">サービス形態</span>
              <select
                value={serviceType}
                onChange={(event) => setServiceType(event.target.value as DashboardShopServiceType)}
                className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
              >
                {SERVICE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-neutral-text">料金下限 *</span>
              <input
                type="number"
                value={priceMin}
                min={0}
                onChange={(event) => setPriceMin(event.target.value)}
                className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-neutral-text">料金上限 *</span>
              <input
                type="number"
                value={priceMax}
                min={0}
                onChange={(event) => setPriceMax(event.target.value)}
                className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
                required
              />
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-sm font-medium text-neutral-text">
              サービスタグ (カンマ区切り)
            </span>
            <input
              type="text"
              value={serviceTags}
              onChange={(event) => setServiceTags(event.target.value)}
              className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
              placeholder="例) 完全個室, 日本人セラピスト"
            />
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-neutral-text uppercase tracking-wide">
            連絡先
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-neutral-text">電話番号</span>
              <input
                type="text"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-neutral-text">LINE ID / URL</span>
              <input
                type="text"
                value={lineId}
                onChange={(event) => setLineId(event.target.value)}
                className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-neutral-text">Web サイト URL</span>
              <input
                type="url"
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-neutral-text">予約フォーム URL</span>
              <input
                type="url"
                value={reservationUrl}
                onChange={(event) => setReservationUrl(event.target.value)}
                className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-neutral-text uppercase tracking-wide">
            掲載情報
          </h2>
          <label className="space-y-1">
            <span className="text-sm font-medium text-neutral-text">キャッチコピー</span>
            <input
              type="text"
              value={catchCopy}
              onChange={(event) => setCatchCopy(event.target.value)}
              className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-neutral-text">住所</span>
            <input
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
              placeholder="例) 大阪市中央区難波○丁目"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-neutral-text">紹介文</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-[120px] w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
              placeholder="店舗の特徴やおすすめポイントを入力してください"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-neutral-text">写真 URL（1 行に 1 件）</span>
            <textarea
              value={photoInputs}
              onChange={(event) => setPhotoInputs(event.target.value)}
              className="min-h-[100px] w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
              placeholder="https://example.com/photo1.jpg"
            />
          </label>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-400"
          >
            {isSubmitting ? '作成中...' : '店舗を作成'}
          </button>
          <Badge variant="outline" className="text-xs text-neutral-textMuted">
            作成後はプロフィール編集画面で詳細を追加できます
          </Badge>
        </div>
      </form>
    </div>
  )
}
