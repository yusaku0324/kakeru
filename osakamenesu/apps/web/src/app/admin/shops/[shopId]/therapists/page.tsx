'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Therapist = {
  id: string
  name: string
  profile_id: string
  status?: string | null
  tags?: string[]
}

type TherapistsResponse = { items?: Therapist[] }

export default function AdminShopTherapistsPage({ params }: { params: { shopId: string } }) {
  const shopId = params.shopId
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [tags, setTags] = useState('')

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('セラピスト名を入力してください')
      return
    }
    try {
      const resp = await fetch('/api/admin/therapists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shopId,
          name,
          age: age ? Number(age) : undefined,
          photo_url: photoUrl || undefined,
          tags: tagList,
        }),
      })
      if (!resp.ok) {
        setError('セラピストの作成に失敗しました')
        return
      }
      setName('')
      setAge('')
      setPhotoUrl('')
      setTags('')
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
        <form onSubmit={handleSubmit} className="space-y-2 text-sm">
          <label className="block">
            名前
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
              placeholder="任意"
              type="number"
            />
          </label>
          <label className="block">
            写真URL
            <input
              className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="任意"
            />
          </label>
          <label className="block">
            タグ（カンマ区切り）
            <input
              className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="例: 癒し系, 元気系"
            />
          </label>
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
                <th className="px-2 py-1">タグ</th>
                <th className="px-2 py-1">ステータス</th>
                <th className="px-2 py-1">操作</th>
              </tr>
            </thead>
            <tbody>
              {therapists.map((t) => (
                <tr key={t.id} className="border-b border-neutral-borderLight">
                  <td className="px-2 py-1">{t.name}</td>
                  <td className="px-2 py-1">{(t.tags || []).join(', ') || '-'}</td>
                  <td className="px-2 py-1">{t.status || '-'}</td>
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
