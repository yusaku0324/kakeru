'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type Therapist = {
  id: string
  name: string
  profile_id: string
  headline?: string | null
  biography?: string | null
  age?: number | null
  status?: string | null
  is_booking_enabled?: boolean | null
  display_order?: number | null
  photo_urls?: string[]
  main_photo_index?: number | null
  tags?: string[]
  mood_tag?: string | null
  style_tag?: string | null
  look_type?: string | null
  contact_style?: string | null
  talk_level?: string | null
  hobby_tags?: string[]
  price_rank?: number | null
}

// Predefined options for matching tags
const MOOD_OPTIONS = ['癒し系', '元気系', '大人系', 'クール系', 'ナチュラル系']
const STYLE_OPTIONS = ['ソフト', 'しっかり', 'オイル中心', 'ストレッチ多め']
const LOOK_OPTIONS = ['可愛い系', '綺麗系', 'セクシー系', 'ナチュラル系', 'スポーティ系']
const CONTACT_OPTIONS = ['積極的', '控えめ', 'お客様次第']
const TALK_OPTIONS = ['おしゃべり好き', '聞き上手', '静か']

const STATUS_OPTIONS = [
  { value: 'draft', label: '下書き', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'active', label: '公開中', color: 'bg-green-100 text-green-800' },
  { value: 'inactive', label: '非公開', color: 'bg-neutral-100 text-neutral-600' },
]

export default function AdminTherapistEditPage() {
  const params = useParams<{ therapistId: string }>()
  const router = useRouter()
  const therapistId = params.therapistId

  const [therapist, setTherapist] = useState<Therapist | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [headline, setHeadline] = useState('')
  const [biography, setBiography] = useState('')
  const [age, setAge] = useState('')
  const [status, setStatus] = useState('draft')
  const [isBookingEnabled, setIsBookingEnabled] = useState(true)
  const [displayOrder, setDisplayOrder] = useState('')
  const [photoUrls, setPhotoUrls] = useState('')
  const [mainPhotoIndex, setMainPhotoIndex] = useState('0')
  const [tags, setTags] = useState('')
  const [moodTag, setMoodTag] = useState('')
  const [styleTag, setStyleTag] = useState('')
  const [lookType, setLookType] = useState('')
  const [contactStyle, setContactStyle] = useState('')
  const [talkLevel, setTalkLevel] = useState('')
  const [hobbyTags, setHobbyTags] = useState('')
  const [priceRank, setPriceRank] = useState('')

  // Confirmation dialog state
  const [showStatusConfirm, setShowStatusConfirm] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const initialStatus = useRef<string>('draft')

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/admin/therapists?shop_id=`, { cache: 'no-store' })
      if (!resp.ok) throw new Error(`status ${resp.status}`)
      const data = await resp.json()
      const found = (data.items ?? []).find((t: Therapist) => t.id === therapistId)
      if (!found) {
        setError('セラピストが見つかりません')
        return
      }
      setTherapist(found)
      // Populate form
      setName(found.name || '')
      setHeadline(found.headline || '')
      setBiography(found.biography || '')
      setAge(found.age?.toString() || '')
      const foundStatus = found.status || 'draft'
      setStatus(foundStatus)
      initialStatus.current = foundStatus
      setIsBookingEnabled(found.is_booking_enabled ?? true)
      setDisplayOrder(found.display_order?.toString() || '')
      setPhotoUrls((found.photo_urls || []).join('\n'))
      setMainPhotoIndex((found.main_photo_index ?? 0).toString())
      setTags((found.tags || []).join(', '))
      setMoodTag(found.mood_tag || '')
      setStyleTag(found.style_tag || '')
      setLookType(found.look_type || '')
      setContactStyle(found.contact_style || '')
      setTalkLevel(found.talk_level || '')
      setHobbyTags((found.hobby_tags || []).join(', '))
      setPriceRank(found.price_rank?.toString() || '')
    } catch (e) {
      console.error('failed to load therapist', e)
      setError('セラピスト情報の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [therapistId])

  useEffect(() => {
    void load()
  }, [load])

  const tagList = useMemo(() => {
    return tags.split(',').map((t) => t.trim()).filter(Boolean)
  }, [tags])

  const hobbyTagList = useMemo(() => {
    return hobbyTags.split(',').map((t) => t.trim()).filter(Boolean)
  }, [hobbyTags])

  const photoUrlList = useMemo(() => {
    return photoUrls.split('\n').map((u) => u.trim()).filter(Boolean)
  }, [photoUrls])

  // Handle status change with confirmation
  const handleStatusChange = useCallback((newStatus: string) => {
    // Show confirmation when changing to/from 'active'
    if (newStatus === 'active' && initialStatus.current !== 'active') {
      setPendingStatus(newStatus)
      setShowStatusConfirm(true)
    } else if (newStatus !== 'active' && initialStatus.current === 'active') {
      setPendingStatus(newStatus)
      setShowStatusConfirm(true)
    } else {
      setStatus(newStatus)
    }
  }, [])

  const confirmStatusChange = useCallback(() => {
    if (pendingStatus) {
      setStatus(pendingStatus)
    }
    setShowStatusConfirm(false)
    setPendingStatus(null)
  }, [pendingStatus])

  const cancelStatusChange = useCallback(() => {
    setShowStatusConfirm(false)
    setPendingStatus(null)
  }, [])

  // Validation
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {}

    if (!name.trim()) {
      errors.name = 'セラピスト名は必須です'
    } else if (name.trim().length > 50) {
      errors.name = 'セラピスト名は50文字以内で入力してください'
    }

    if (age && (Number(age) < 18 || Number(age) > 99)) {
      errors.age = '年齢は18〜99の範囲で入力してください'
    }

    if (headline && headline.length > 100) {
      errors.headline = 'キャッチコピーは100文字以内で入力してください'
    }

    if (biography && biography.length > 1000) {
      errors.biography = '自己紹介は1000文字以内で入力してください'
    }

    // Validate photo URLs
    for (const url of photoUrlList) {
      try {
        new URL(url)
      } catch {
        errors.photos = '無効なURLが含まれています'
        break
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [name, age, headline, biography, photoUrlList])

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
    if (headline.trim()) payload.headline = headline.trim()
    else payload.headline = ''
    if (biography.trim()) payload.biography = biography.trim()
    else payload.biography = ''
    if (age) payload.age = Number(age)

    // Status & display
    payload.status = status
    payload.is_booking_enabled = isBookingEnabled
    if (displayOrder) payload.display_order = Number(displayOrder)

    // Photos
    payload.photo_urls = photoUrlList
    if (mainPhotoIndex) payload.main_photo_index = Number(mainPhotoIndex)

    // Matching tags
    if (tagList.length > 0) payload.tags = tagList
    else payload.tags = []
    payload.mood_tag = moodTag || null
    payload.style_tag = styleTag || null
    payload.look_type = lookType || null
    payload.contact_style = contactStyle || null
    payload.talk_level = talkLevel || null
    if (hobbyTagList.length > 0) payload.hobby_tags = hobbyTagList
    else payload.hobby_tags = []
    if (priceRank) payload.price_rank = Number(priceRank)

    try {
      const resp = await fetch(`/api/admin/therapists/${therapistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        setError(data.detail || 'セラピストの更新に失敗しました')
        return
      }
      setSuccess('保存しました')
      await load()
    } catch (e) {
      console.error('failed to update therapist', e)
      setError('セラピストの更新に失敗しました')
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

  if (!therapist) {
    return (
      <main className="mx-auto max-w-4xl p-4">
        <div className="text-red-600">{error || 'セラピストが見つかりません'}</div>
        <Link href="/admin/therapists" className="text-brand-primary underline mt-2 inline-block">
          セラピスト一覧に戻る
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">セラピスト編集</h1>
          <p className="text-sm text-neutral-textMuted">ID: {therapistId}</p>
        </div>
        <Link
          href={`/admin/therapists/${therapistId}/shifts`}
          className="rounded bg-neutral-100 px-3 py-1.5 text-sm hover:bg-neutral-200"
        >
          シフト管理
        </Link>
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
              {status === 'active' && (
                <p className="mt-1 text-xs text-green-600">このセラピストは公開中です</p>
              )}
            </label>
            <label className="flex items-center gap-2 self-end pb-1.5">
              <input
                type="checkbox"
                checked={isBookingEnabled}
                onChange={(e) => setIsBookingEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-borderLight"
              />
              <span>予約受付を有効にする</span>
            </label>
          </div>
          <label className="mt-3 block">
            表示順序（小さい数字が先に表示）
            <input
              type="number"
              className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1.5 sm:w-32"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              placeholder="例: 1"
              min="0"
            />
          </label>
        </section>

        {/* Basic Info Section */}
        <section className="rounded border border-neutral-borderLight bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">基本情報</h2>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                名前 <span className="text-red-500">*</span>
                <input
                  className={`mt-1 w-full rounded border px-2 py-1.5 ${
                    validationErrors.name ? 'border-red-500' : 'border-neutral-borderLight'
                  }`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="必須"
                />
                {validationErrors.name && (
                  <p className="mt-1 text-xs text-red-600">{validationErrors.name}</p>
                )}
              </label>
              <label className="block">
                年齢
                <input
                  className={`mt-1 w-full rounded border px-2 py-1.5 ${
                    validationErrors.age ? 'border-red-500' : 'border-neutral-borderLight'
                  }`}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="例: 25"
                  type="number"
                  min="18"
                  max="99"
                />
                {validationErrors.age && (
                  <p className="mt-1 text-xs text-red-600">{validationErrors.age}</p>
                )}
              </label>
            </div>
            <label className="block">
              キャッチコピー・見出し
              <input
                className={`mt-1 w-full rounded border px-2 py-1.5 ${
                  validationErrors.headline ? 'border-red-500' : 'border-neutral-borderLight'
                }`}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="例: 癒しのプロフェッショナル"
              />
              {validationErrors.headline && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.headline}</p>
              )}
            </label>
            <label className="block">
              自己紹介・略歴
              <textarea
                className={`mt-1 w-full rounded border px-2 py-1.5 ${
                  validationErrors.biography ? 'border-red-500' : 'border-neutral-borderLight'
                }`}
                value={biography}
                onChange={(e) => setBiography(e.target.value)}
                placeholder="自己紹介文を入力してください"
                rows={4}
              />
              {validationErrors.biography && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.biography}</p>
              )}
            </label>
            <label className="block">
              得意技術・タグ（カンマ区切り）
              <input
                className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1.5"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="例: オイルマッサージ, ヘッドスパ, 足つぼ"
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
              className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1.5 font-mono text-sm"
              value={photoUrls}
              onChange={(e) => setPhotoUrls(e.target.value)}
              placeholder="https://example.com/photo1.jpg&#10;https://example.com/photo2.jpg"
              rows={4}
            />
          </label>
          <div className="mt-2 text-sm text-neutral-textMuted">
            {photoUrlList.length > 0 ? `${photoUrlList.length}枚の写真` : '写真なし'}
          </div>
          {validationErrors.photos && (
            <p className="mt-1 text-xs text-red-600">{validationErrors.photos}</p>
          )}
          {photoUrlList.length > 1 && (
            <label className="mt-2 block">
              メイン写真（0から始まるインデックス）
              <select
                className="mt-1 w-full rounded border border-neutral-borderLight bg-white px-2 py-1.5 sm:w-48"
                value={mainPhotoIndex}
                onChange={(e) => setMainPhotoIndex(e.target.value)}
              >
                {photoUrlList.map((_, i) => (
                  <option key={i} value={i}>
                    {i + 1}枚目
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>

        {/* Matching Tags Section */}
        <section className="rounded border border-neutral-borderLight bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">マッチングタグ</h2>
          <p className="mb-3 text-sm text-neutral-textMuted">
            ゲストの好みとのマッチングに使用されます
          </p>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                雰囲気タイプ
                <select
                  className="mt-1 w-full rounded border border-neutral-borderLight bg-white px-2 py-1.5"
                  value={moodTag}
                  onChange={(e) => setMoodTag(e.target.value)}
                >
                  <option value="">選択してください</option>
                  {MOOD_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                施術スタイル
                <select
                  className="mt-1 w-full rounded border border-neutral-borderLight bg-white px-2 py-1.5"
                  value={styleTag}
                  onChange={(e) => setStyleTag(e.target.value)}
                >
                  <option value="">選択してください</option>
                  {STYLE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                外見タイプ
                <select
                  className="mt-1 w-full rounded border border-neutral-borderLight bg-white px-2 py-1.5"
                  value={lookType}
                  onChange={(e) => setLookType(e.target.value)}
                >
                  <option value="">選択してください</option>
                  {LOOK_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                価格帯ランク
                <select
                  className="mt-1 w-full rounded border border-neutral-borderLight bg-white px-2 py-1.5"
                  value={priceRank}
                  onChange={(e) => setPriceRank(e.target.value)}
                >
                  <option value="">選択してください</option>
                  <option value="1">1 (リーズナブル)</option>
                  <option value="2">2</option>
                  <option value="3">3 (標準)</option>
                  <option value="4">4</option>
                  <option value="5">5 (プレミアム)</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                接触スタイル
                <select
                  className="mt-1 w-full rounded border border-neutral-borderLight bg-white px-2 py-1.5"
                  value={contactStyle}
                  onChange={(e) => setContactStyle(e.target.value)}
                >
                  <option value="">選択してください</option>
                  {CONTACT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                会話レベル
                <select
                  className="mt-1 w-full rounded border border-neutral-borderLight bg-white px-2 py-1.5"
                  value={talkLevel}
                  onChange={(e) => setTalkLevel(e.target.value)}
                >
                  <option value="">選択してください</option>
                  {TALK_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              趣味タグ（カンマ区切り）
              <input
                className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1.5"
                value={hobbyTags}
                onChange={(e) => setHobbyTags(e.target.value)}
                placeholder="例: 映画, 音楽, 旅行, グルメ"
              />
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
            href={therapist.profile_id ? `/admin/shops/${therapist.profile_id}/therapists` : '/admin/therapists'}
            className="rounded border border-neutral-borderLight bg-white px-6 py-2 hover:bg-neutral-50"
          >
            キャンセル
          </Link>
        </div>
      </form>

      {/* Status Change Confirmation Dialog */}
      <ConfirmDialog
        open={showStatusConfirm}
        title="ステータス変更の確認"
        message={
          pendingStatus === 'active'
            ? 'このセラピストを公開しますか？公開すると、ゲストから予約可能になります。'
            : 'このセラピストを非公開にしますか？非公開にすると、ゲストからは見えなくなります。'
        }
        confirmLabel={pendingStatus === 'active' ? '公開する' : '非公開にする'}
        cancelLabel="キャンセル"
        variant={pendingStatus === 'active' ? 'default' : 'danger'}
        onConfirm={confirmStatusChange}
        onCancel={cancelStatusChange}
      />
    </main>
  )
}
