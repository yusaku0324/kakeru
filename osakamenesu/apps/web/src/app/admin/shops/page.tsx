'use client'

import { useCallback, useEffect, useState } from 'react'

import { ErrorAlert } from '@/components/ui/Alert'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

type Shop = {
  id: string
  name: string
  area?: string | null
  status?: string | null
  url?: string | null
  price_min?: number | null
  price_max?: number | null
  nearest_station?: string | null
  station_walk_minutes?: number | null
}

type ShopsResponse = { items?: Shop[] }

async function getErrorMessage(resp: Response, fallback: string): Promise<string> {
  // Try to parse error details from response
  try {
    const data = await resp.json()
    if (data.detail) {
      return typeof data.detail === 'string' ? data.detail : fallback
    }
    if (data.message) {
      return data.message
    }
  } catch {
    // Response body was not JSON
  }

  // Return status-specific messages
  switch (resp.status) {
    case 400:
      return '入力内容に誤りがあります。'
    case 401:
      return 'セッションが切れました。再度ログインしてください。'
    case 403:
      return 'この操作を行う権限がありません。'
    case 404:
      return '対象のデータが見つかりませんでした。'
    case 409:
      return '他のユーザーが更新中です。しばらくしてから再度お試しください。'
    case 422:
      return '入力内容を確認してください。'
    case 429:
      return 'リクエストが多すぎます。しばらくしてから再度お試しください。'
    case 500:
    case 502:
    case 503:
      return 'サーバーエラーが発生しました。しばらくしてから再度お試しください。'
    default:
      return fallback
  }
}

export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const [url, setUrl] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [nearestStation, setNearestStation] = useState('')
  const [stationWalkMinutes, setStationWalkMinutes] = useState('')
  const [phone, setPhone] = useState('')
  const [lineId, setLineId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/admin/shops', { cache: 'no-store' })
      if (!resp.ok) {
        const errorMessage = await getErrorMessage(resp, '店舗一覧の取得に失敗しました')
        throw new Error(errorMessage)
      }
      const data = (await resp.json()) as ShopsResponse
      setShops(data.items ?? [])
    } catch (e) {
      console.error('failed to load shops', e)
      setShops([])
      if (e instanceof TypeError && e.message.includes('fetch')) {
        setError('ネットワークエラーが発生しました。接続を確認してください。')
      } else {
        setError(e instanceof Error ? e.message : '店舗一覧の取得に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setName('')
    setArea('')
    setUrl('')
    setPriceMin('')
    setPriceMax('')
    setNearestStation('')
    setStationWalkMinutes('')
    setPhone('')
    setLineId('')
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('店舗名を入力してください')
      return
    }

    // Build payload
    const payload: Record<string, unknown> = {
      name: name.trim(),
    }
    if (area.trim()) payload.area = area.trim()
    if (url.trim()) payload.url = url.trim()
    if (priceMin) payload.price_min = Number(priceMin)
    if (priceMax) payload.price_max = Number(priceMax)
    if (nearestStation.trim()) payload.nearest_station = nearestStation.trim()
    if (stationWalkMinutes) payload.station_walk_minutes = Number(stationWalkMinutes)

    // Contact info
    if (phone.trim() || lineId.trim()) {
      payload.contact = {
        phone: phone.trim() || undefined,
        line_id: lineId.trim() || undefined,
        website_url: url.trim() || undefined,
      }
    }

    try {
      const resp = await fetch('/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        const errorMessage = await getErrorMessage(resp, '店舗の作成に失敗しました')
        setError(errorMessage)
        return
      }
      resetForm()
      await load()
    } catch (e) {
      console.error('failed to create shop', e)
      if (e instanceof TypeError && e.message.includes('fetch')) {
        setError('ネットワークエラーが発生しました。接続を確認してください。')
      } else {
        setError('店舗の作成に失敗しました')
      }
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

      {error && <ErrorAlert message={error} onRetry={load} />}

      <section className="space-y-2 rounded border border-neutral-borderLight bg-white p-3">
        <h2 className="text-lg font-semibold text-neutral-text">新規店舗を追加</h2>
        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          {/* Basic Info */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              店舗名 <span className="text-red-500">*</span>
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
                placeholder="例: 梅田"
              />
            </label>
          </div>

          <label className="block">
            URL
            <input
              className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              type="url"
            />
          </label>

          {/* Toggle Advanced */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-brand-primary underline"
          >
            {showAdvanced ? '詳細項目を閉じる' : '詳細項目を表示'}
          </button>

          {showAdvanced && (
            <div className="space-y-3 rounded border border-neutral-borderLight bg-neutral-50 p-3">
              {/* Price Range */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  最低価格（円）
                  <input
                    className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    placeholder="例: 5000"
                    type="number"
                    min="0"
                  />
                </label>
                <label className="block">
                  最高価格（円）
                  <input
                    className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    placeholder="例: 15000"
                    type="number"
                    min="0"
                  />
                </label>
              </div>

              {/* Station Info */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  最寄り駅
                  <input
                    className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
                    value={nearestStation}
                    onChange={(e) => setNearestStation(e.target.value)}
                    placeholder="例: 梅田駅"
                  />
                </label>
                <label className="block">
                  徒歩（分）
                  <input
                    className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
                    value={stationWalkMinutes}
                    onChange={(e) => setStationWalkMinutes(e.target.value)}
                    placeholder="例: 5"
                    type="number"
                    min="0"
                  />
                </label>
              </div>

              {/* Contact Info */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  電話番号
                  <input
                    className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="例: 06-1234-5678"
                    type="tel"
                  />
                </label>
                <label className="block">
                  LINE ID
                  <input
                    className="mt-1 w-full rounded border border-neutral-borderLight px-2 py-1"
                    value={lineId}
                    onChange={(e) => setLineId(e.target.value)}
                    placeholder="例: @shop_line"
                  />
                </label>
              </div>
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
        <h2 className="text-lg font-semibold text-neutral-text">店舗一覧</h2>
        {loading ? (
          <LoadingSpinner label="読み込み中..." />
        ) : shops.length === 0 ? (
          <div className="text-sm text-neutral-textMuted">店舗がありません。</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-borderLight text-left text-xs text-neutral-textMuted">
                <th className="px-2 py-1">名前</th>
                <th className="px-2 py-1">エリア</th>
                <th className="px-2 py-1">価格帯</th>
                <th className="px-2 py-1">ステータス</th>
                <th className="px-2 py-1">操作</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => {
                const priceRange =
                  shop.price_min != null && shop.price_max != null && (shop.price_min > 0 || shop.price_max > 0)
                    ? `¥${shop.price_min.toLocaleString()} ~ ¥${shop.price_max.toLocaleString()}`
                    : '-'
                return (
                  <tr key={shop.id} className="border-b border-neutral-borderLight">
                    <td className="px-2 py-1">{shop.name}</td>
                    <td className="px-2 py-1">{shop.area || '-'}</td>
                    <td className="px-2 py-1">{priceRange}</td>
                    <td className="px-2 py-1">{shop.status || '-'}</td>
                    <td className="flex gap-2 px-2 py-1">
                      <a
                        className="text-brand-primary underline"
                        href={`/admin/shops/${shop.id}/edit`}
                      >
                        編集
                      </a>
                      <a
                        className="text-brand-primary underline"
                        href={`/admin/shops/${shop.id}/therapists`}
                      >
                        セラピスト
                      </a>
                      <a
                        className="text-brand-primary underline"
                        href={`/admin/shops/${shop.id}/reservations`}
                      >
                        予約
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
