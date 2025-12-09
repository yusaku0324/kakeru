'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type Therapist = {
  id: string
  name: string
  profile_id: string
  status?: string | null
  tags?: string[]
  age?: number | null
  mood_tag?: string | null
  style_tag?: string | null
  look_type?: string | null
  price_rank?: number | null
}

type TherapistsResponse = { items?: Therapist[] }

// Predefined options for matching tags
const MOOD_OPTIONS = ['癒し系', '元気系', '大人系', 'クール系', 'ナチュラル系']
const STYLE_OPTIONS = ['ソフト', 'しっかり', 'オイル中心', 'ストレッチ多め']
const LOOK_OPTIONS = ['可愛い系', '綺麗系', 'セクシー系', 'ナチュラル系', 'スポーティ系']

export default function AdminShopTherapistsPage() {
  const params = useParams<{ shopId: string }>()
  const shopId = params.shopId
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [tags, setTags] = useState('')
  // Matching tags
  const [moodTag, setMoodTag] = useState('')
  const [styleTag, setStyleTag] = useState('')
  const [lookType, setLookType] = useState('')
  const [priceRank, setPriceRank] = useState('')
  const [hobbyTags, setHobbyTags] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/admin/therapists?shop_id=${shopId}`, { cache: 'no-store' })
      if (!resp.ok) throw new Error(`status ${resp.status}`)
      const data = (await resp.json()) as TherapistsResponse
      setTherapists(data.items ?? [])
    } catch (e) {
      console.error('failed to load therapists', e)
      setTherapists([])
      setError('セラピスト一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    void load()
  }, [load])

  const tagList = useMemo(() => {
    return tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  }, [tags])

  const hobbyTagList = useMemo(() => {
    return hobbyTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  }, [hobbyTags])

  const resetForm = () => {
    setName('')
    setAge('')
    setPhotoUrl('')
    setTags('')
    setMoodTag('')
    setStyleTag('')
    setLookType('')
    setPriceRank('')
    setHobbyTags('')
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('セラピスト名を入力してください')
      return
    }

    const payload: Record<string, unknown> = {
      profile_id: shopId,
      name: name.trim(),
    }
    if (age) payload.age = Number(age)
    if (photoUrl.trim()) payload.photo_url = photoUrl.trim()
    if (tagList.length > 0) payload.tags = tagList

    // Matching tags
    if (moodTag) payload.mood_tag = moodTag
    if (styleTag) payload.style_tag = styleTag
    if (lookType) payload.look_type = lookType
    if (priceRank) payload.price_rank = Number(priceRank)
    if (hobbyTagList.length > 0) payload.hobby_tags = hobbyTagList

    try {
      const resp = await fetch('/api/admin/therapists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        setError('セラピストの作成に失敗しました')
        return
      }
      resetForm()
      await load()
    } catch (e) {
      console.error('failed to create therapist', e)
      setError('セラピストの作成に失敗しました')
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div>
        <h1 data-testid="admin-title" className="text-2xl font-semibold">
          店舗のセラピスト管理
        </h1>
        <p className="text-sm text-neutral-textMuted">店舗ID: {shopId}</p>
      </div>

      {error ? <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{error}</div> : null}

      <section className="space-y-2 rounded border border-neutral-borderLight bg-white p-3">
        <h2 className="text-lg font-semibold text-neutral-text">新規セラピストを追加</h2>
        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          {/* Basic Info */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              名前 <span className="text-red-500">*</span>
              <input
                className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="必須"
              />
            </label>
            <label className="block">
              年齢
              <input
                className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="例: 25"
                type="number"
                min="18"
                max="99"
              />
            </label>
          </div>

          <label className="block">
            写真URL
            <input
              className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              type="url"
            />
          </label>

          <label className="block">
            得意技術・タグ（カンマ区切り）
            <input
              className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="例: オイルマッサージ, ヘッドスパ, 足つぼ"
            />
          </label>

          {/* Toggle Advanced */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-brand-primary underline"
          >
            {showAdvanced ? 'マッチングタグを閉じる' : 'マッチングタグを表示'}
          </button>

          {showAdvanced && (
            <div className="space-y-3 rounded border border-neutral-borderLight bg-neutral-50 p-3">
              <p className="text-xs text-neutral-textMuted">
                マッチングタグはゲストの好みとのマッチングに使用されます
              </p>

              {/* Mood & Style */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  雰囲気タイプ
                  <select
                    className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1 bg-white"
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
                    className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1 bg-white"
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

              {/* Look & Price */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  外見タイプ
                  <select
                    className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1 bg-white"
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
                  価格帯ランク（1-5）
                  <select
                    className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1 bg-white"
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

              {/* Hobby Tags */}
              <label className="block">
                趣味タグ（カンマ区切り）
                <input
                  className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
                  value={hobbyTags}
                  onChange={(e) => setHobbyTags(e.target.value)}
                  placeholder="例: 映画, 音楽, 旅行, グルメ"
                />
              </label>
            </div>
          )}

          <button
            type="submit"
            className="rounded bg-brand-primary px-4 py-2 text-white hover:brightness-110 disabled:opacity-60"
            disabled={loading}
          >
            追加する
          </button>
        </form>
      </section>

      <section className="space-y-2 rounded border border-neutral-borderLight bg-white p-3">
        <h2 className="text-lg font-semibold text-neutral-text">セラピスト一覧</h2>
        {loading ? (
          <div className="text-sm text-neutral-textMuted">読み込み中…</div>
        ) : therapists.length === 0 ? (
          <div className="text-sm text-neutral-textMuted">セラピストがいません。</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-borderLight text-left text-xs text-neutral-textMuted">
                <th className="px-2 py-1">名前</th>
                <th className="px-2 py-1">年齢</th>
                <th className="px-2 py-1">タグ</th>
                <th className="px-2 py-1">雰囲気</th>
                <th className="px-2 py-1">ステータス</th>
                <th className="px-2 py-1">操作</th>
              </tr>
            </thead>
            <tbody>
              {therapists.map((t) => (
                <tr key={t.id} className="border-b border-neutral-borderLight">
                  <td className="px-2 py-1 font-medium">{t.name}</td>
                  <td className="px-2 py-1">{t.age || '-'}</td>
                  <td className="px-2 py-1 max-w-[150px] truncate">{(t.tags || []).join(', ') || '-'}</td>
                  <td className="px-2 py-1">{t.mood_tag || '-'}</td>
                  <td className="px-2 py-1">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${
                      t.status === 'active' ? 'bg-green-100 text-green-800' :
                      t.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-neutral-100 text-neutral-600'
                    }`}>
                      {t.status || 'draft'}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <a
                      className="text-brand-primary underline"
                      href={`/admin/therapists/${t.id}/shifts`}
                    >
                      シフト管理
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
