'use client'

import { useCallback, useEffect, useState } from 'react'

type Shop = {
  id: string
  name: string
  area?: string | null
  status?: string | null
  url?: string | null
}

type ShopsResponse = { items?: Shop[] }

export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/admin/shops', { cache: 'no-store' })
      if (!resp.ok) throw new Error(`status ${resp.status}`)
      const data = (await resp.json()) as ShopsResponse
      setShops(data.items ?? [])
    } catch (e) {
      console.error('failed to load shops', e)
      setShops([])
      setError('店舗一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('店舗名を入力してください')
      return
    }
    try {
      const resp = await fetch('/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, area: area || undefined, url: url || undefined }),
      })
      if (!resp.ok) {
        setError('店舗の作成に失敗しました')
        return
      }
      setName('')
      setArea('')
      setUrl('')
      await load()
    } catch (e) {
      console.error('failed to create shop', e)
      setError('店舗の作成に失敗しました')
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div>
        <h1 data-testid="admin-title" className="text-2xl font-semibold">
          店舗管理
        </h1>
        <p className="text-sm text-neutral-textMuted">店舗の一覧と追加を管理します。</p>
      </div>

      {error ? <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{error}</div> : null}

      <section className="space-y-2 rounded border border-neutral-borderLight bg-white p-3">
        <h2 className="text-lg font-semibold text-neutral-text">新規店舗を追加</h2>
        <form onSubmit={handleSubmit} className="space-y-2 text-sm">
          <label className="block">
            店舗名
            <input
              className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="必須"
            />
          </label>
          <label className="block">
            エリア
            <input
              className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="任意"
            />
          </label>
          <label className="block">
            URL
            <input
              className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="任意"
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
        <h2 className="text-lg font-semibold text-neutral-text">店舗一覧</h2>
        {loading ? (
          <div className="text-sm text-neutral-textMuted">読み込み中…</div>
        ) : shops.length === 0 ? (
          <div className="text-sm text-neutral-textMuted">店舗がありません。</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-borderLight text-left text-xs text-neutral-textMuted">
                <th className="px-2 py-1">名前</th>
                <th className="px-2 py-1">エリア</th>
                <th className="px-2 py-1">ステータス</th>
                <th className="px-2 py-1">操作</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => (
                <tr key={shop.id} className="border-b border-neutral-borderLight">
                  <td className="px-2 py-1">{shop.name}</td>
                  <td className="px-2 py-1">{shop.area || '-'}</td>
                  <td className="px-2 py-1">{shop.status || '-'}</td>
                  <td className="flex gap-2 px-2 py-1">
                    <a
                      className="text-brand-primary underline"
                      href={`/admin/shops/${shop.id}/therapists`}
                    >
                      セラ一覧
                    </a>
                    <a
                      className="text-brand-primary underline"
                      href={`/admin/shops/${shop.id}/dashboard`}
                    >
                      ダッシュボード
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
