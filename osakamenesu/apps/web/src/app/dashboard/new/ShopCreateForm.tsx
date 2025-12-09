'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'

import { ToastContainer, useToast } from '@/components/useToast'
import { TagInput } from '@/components/ui/TagInput'
import {
  createDashboardShopProfile,
  type DashboardShopProfileCreatePayload,
  type DashboardShopServiceType,
} from '@/lib/dashboard-shops'

type Props = {
  isAuthenticated: boolean
}

const SERVICE_TYPE_OPTIONS: { label: string; value: DashboardShopServiceType; icon: string }[] = [
  { label: '店舗型', value: 'store', icon: '🏪' },
  { label: '出張型', value: 'dispatch', icon: '🚗' },
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
]

function parseMultiline(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
}

// Section Card component
function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description?: string
  icon?: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
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
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-1 text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </label>
  )
}

export function ShopCreateForm({ isAuthenticated }: Props) {
  const router = useRouter()
  const { toasts, push, remove } = useToast()

  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const [serviceType, setServiceType] = useState<DashboardShopServiceType>('store')
  const [priceMin, setPriceMin] = useState('7000')
  const [priceMax, setPriceMax] = useState('15000')
  const [serviceTags, setServiceTags] = useState<string[]>([])
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
      service_tags: serviceTags,
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
      <div className="space-y-6">
        <ToastContainer toasts={toasts} onDismiss={remove} />
        <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-200">
            <svg className="h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-neutral-700">ログインが必要です</h3>
          <p className="mt-2 text-sm text-neutral-500">
            店舗を作成するにはログインが必要です。ログインページからマジックリンクを送信し、メール経由でログインしてください。
          </p>
          <Link
            href="/dashboard/login"
            className={clsx(
              'mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all',
              'bg-gradient-to-r from-brand-primary to-brand-secondary',
              'hover:shadow-lg hover:shadow-brand-primary/25'
            )}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            ログインページへ
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ToastContainer toasts={toasts} onDismiss={remove} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">新しい店舗を作成</h1>
        <p className="mt-1 text-sm text-neutral-500">
          基本情報を入力して店舗を作成しましょう。詳細は後からプロフィール編集画面で追加できます。
        </p>
      </div>

      {formError && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <svg className="h-5 w-5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-red-700">{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <SectionCard
          title="基本情報"
          description="店舗名とエリアは必須です"
          icon="🏢"
        >
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <InputField label="店舗名" required>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  placeholder="例: 難波/日本橋メンエス A店"
                  required
                />
              </InputField>
              <InputField label="エリア" required>
                <input
                  type="text"
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  placeholder="例: 難波/日本橋"
                  required
                />
              </InputField>
            </div>

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

            <div className="grid gap-6 md:grid-cols-2">
              <InputField label="料金下限" required hint="円">
                <input
                  type="number"
                  value={priceMin}
                  min={0}
                  onChange={(event) => setPriceMin(event.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  required
                />
              </InputField>
              <InputField label="料金上限" required hint="円">
                <input
                  type="number"
                  value={priceMax}
                  min={0}
                  onChange={(event) => setPriceMax(event.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  required
                />
              </InputField>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-neutral-700">サービスタグ</span>
              <TagInput
                tags={serviceTags}
                onChange={setServiceTags}
                suggestions={TAG_SUGGESTIONS}
                placeholder="タグを入力して Enter"
                maxTags={10}
              />
            </div>
          </div>
        </SectionCard>

        {/* Contact */}
        <SectionCard
          title="連絡先"
          description="お客様からの問い合わせ先を登録します（任意）"
          icon="📞"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <InputField label="電話番号">
              <input
                type="text"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="例: 06-1234-5678"
              />
            </InputField>
            <InputField label="LINE ID / URL">
              <input
                type="text"
                value={lineId}
                onChange={(event) => setLineId(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="LINE ID または URL"
              />
            </InputField>
            <InputField label="Web サイト URL">
              <input
                type="url"
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="例: https://example.com"
              />
            </InputField>
            <InputField label="予約フォーム URL">
              <input
                type="url"
                value={reservationUrl}
                onChange={(event) => setReservationUrl(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="例: https://form.example.com"
              />
            </InputField>
          </div>
        </SectionCard>

        {/* Description */}
        <SectionCard
          title="掲載情報"
          description="店舗ページに表示される情報です（任意）"
          icon="📝"
        >
          <div className="space-y-6">
            <InputField label="キャッチコピー" hint="短いフレーズで魅力を伝えましょう">
              <input
                type="text"
                value={catchCopy}
                onChange={(event) => setCatchCopy(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="例: 心と体を癒す至福のひととき"
              />
            </InputField>
            <InputField label="住所">
              <input
                type="text"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="例: 大阪市中央区難波○丁目"
              />
            </InputField>
            <InputField label="紹介文">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-[120px] w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="店舗の特徴やおすすめポイントを入力してください"
              />
            </InputField>
            <InputField label="写真 URL" hint="1行に1件のURLを入力">
              <textarea
                value={photoInputs}
                onChange={(event) => setPhotoInputs(event.target.value)}
                className="min-h-[100px] w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="https://example.com/photo1.jpg"
              />
            </InputField>
          </div>
        </SectionCard>

        {/* Submit */}
        <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>作成後はプロフィール編集画面で詳細を追加できます</span>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={clsx(
              'inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all',
              'bg-gradient-to-r from-brand-primary to-brand-secondary',
              'hover:shadow-xl hover:shadow-brand-primary/25',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {isSubmitting ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                作成中...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                店舗を作成
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
