"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"

interface Shop {
  id: string
  name: string
  area: string
  status: string
  buffer_minutes: number
  url?: string
  created_at: string
  updated_at: string
}

export default function ShopSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const shopId = params.shopId as string

  const [shop, setShop] = useState<Shop | null>(null)
  const [bufferMinutes, setBufferMinutes] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const fetchShop = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/shops/${shopId}`)
      if (!response.ok) throw new Error("Failed to fetch shop")
      const data = await response.json()
      setShop(data)
      setBufferMinutes(data.buffer_minutes || 0)
    } catch (error) {
      console.error("Failed to fetch shop", error)
      setMessage({ type: "error", text: "店舗情報の取得に失敗しました" })
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    fetchShop()
  }, [fetchShop])

  const handleSaveBuffer = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/shops/${shopId}/buffer`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ buffer_minutes: bufferMinutes }),
      })

      if (!response.ok) throw new Error("Failed to update buffer minutes")

      setMessage({ type: "success", text: `バッファ時間を${bufferMinutes}分に更新しました` })
      await fetchShop()
    } catch (error) {
      console.error("Failed to update buffer", error)
      setMessage({ type: "error", text: "バッファ時間の更新に失敗しました" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-brand-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-neutral-textMuted">店舗が見つかりません</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-sm text-neutral-textMuted hover:text-neutral-text"
        >
          <span>←</span>
          <span>戻る</span>
        </button>
        <h1 className="text-2xl font-bold text-neutral-text">{shop.name} - 設定</h1>
      </div>

      {message && (
        <div
          className={`mb-4 rounded border px-4 py-3 ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Buffer Minutes Settings */}
        <section className="rounded-lg border border-neutral-borderLight bg-white p-6">
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-text">
              <span>🕐</span>
              予約バッファ時間設定
            </h2>
            <p className="mt-1 text-sm text-neutral-textMuted">
              予約間のバッファ時間を設定することで、連続した予約を防ぎ、準備や移動の時間を確保できます
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="buffer-minutes" className="block text-sm font-medium text-neutral-text">
                バッファ時間（分）
              </label>
              <div className="flex items-center gap-4">
                <input
                  id="buffer-minutes"
                  type="number"
                  min="0"
                  max="120"
                  value={bufferMinutes}
                  onChange={(e) => setBufferMinutes(parseInt(e.target.value, 10) || 0)}
                  className="w-32 rounded border border-neutral-borderLight px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
                <span className="text-sm text-neutral-textMuted">分（0〜120分）</span>
              </div>
              <p className="text-sm text-neutral-textMuted">
                例：15分に設定すると、予約の前後15分間は他の予約を受け付けません
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveBuffer}
              disabled={saving || bufferMinutes < 0 || bufferMinutes > 120}
              className="inline-flex items-center gap-2 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  保存中...
                </>
              ) : (
                <>
                  <span>💾</span>
                  保存
                </>
              )}
            </button>
          </div>
        </section>

        {/* Shop Info */}
        <section className="rounded-lg border border-neutral-borderLight bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-neutral-text">店舗情報</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-neutral-textMuted">店舗ID</dt>
              <dd className="mt-1 text-sm text-neutral-text">{shop.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-textMuted">エリア</dt>
              <dd className="mt-1 text-sm text-neutral-text">{shop.area}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-textMuted">ステータス</dt>
              <dd className="mt-1 text-sm text-neutral-text">{shop.status}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-textMuted">現在のバッファ時間</dt>
              <dd className="mt-1 text-sm text-neutral-text">{shop.buffer_minutes}分</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  )
}
