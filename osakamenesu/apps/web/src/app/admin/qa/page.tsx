"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

type Shop = {
  id: string
  name: string
}

type Therapist = {
  id: string
  name: string
}

// 環境変数から読み込むか、デフォルト値を使用
// 開発環境では最初に作成された店舗とセラピストのIDを設定してください
// 例: NEXT_PUBLIC_QA_FAVORITE_SHOP_ID=実際のUUID
//     NEXT_PUBLIC_QA_FAVORITE_THERAPIST_ID=実際のUUID
const FAVORITE_SHOP_ID = process.env.NEXT_PUBLIC_QA_FAVORITE_SHOP_ID || ""
const FAVORITE_THERAPIST_ID = process.env.NEXT_PUBLIC_QA_FAVORITE_THERAPIST_ID || ""

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

export default function QAMenuPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [selectedShop, setSelectedShop] = useState<string>("")
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [loadingShops, setLoadingShops] = useState(false)
  const [loadingTherapists, setLoadingTherapists] = useState(false)

  useEffect(() => {
    const fetchShops = async () => {
      try {
        setLoadingShops(true)
        const res = await fetch("/api/admin/shops?page=1&page_size=20")
        if (!res.ok) return
        const data = await res.json()
        const items = Array.isArray(data?.results)
          ? data.results.map((shop: any) => ({ id: shop.id, name: shop.name || "(no name)" }))
          : []
        setShops(items)
      } finally {
        setLoadingShops(false)
      }
    }
    fetchShops().catch(() => setLoadingShops(false))
  }, [])

  useEffect(() => {
    if (!selectedShop) {
      setTherapists([])
      return
    }
    const fetchTherapists = async () => {
      try {
        setLoadingTherapists(true)
        const res = await fetch(`/api/admin/therapists?shop_id=${selectedShop}`)
        if (!res.ok) return
        const data = await res.json()
        const items = Array.isArray(data?.results)
          ? data.results.map((t: any) => ({ id: t.id, name: t.name || "(no name)" }))
          : []
        setTherapists(items)
      } finally {
        setLoadingTherapists(false)
      }
    }
    fetchTherapists().catch(() => setLoadingTherapists(false))
  }, [selectedShop])

  const favoriteShopLinks = useMemo(() => {
    if (!FAVORITE_SHOP_ID) return null
    return (
      <div className="space-x-2">
        <Link className="rounded border px-3 py-1 text-sm" href={`/admin/shops/${FAVORITE_SHOP_ID}`}>
          店舗ダッシュボード (fav)
        </Link>
        <Link
          className="rounded border px-3 py-1 text-sm"
          href={`/admin/shops/${FAVORITE_SHOP_ID}/therapists`}
        >
          セラ一覧 (fav)
        </Link>
      </div>
    )
  }, [])

  const favoriteTherapistLinks = useMemo(() => {
    if (!FAVORITE_THERAPIST_ID) return null
    return (
      <div className="space-x-2">
        <Link
          className="rounded border px-3 py-1 text-sm"
          href={`/admin/therapists/${FAVORITE_THERAPIST_ID}/shifts`}
        >
          シフト管理 (fav)
        </Link>
        <Link
          className="rounded border px-3 py-1 text-sm"
          href={`/guest/therapists/${FAVORITE_THERAPIST_ID}/reserve`}
        >
          このセラで予約デモ (fav)
        </Link>
      </div>
    )
  }, [])

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">開発者QAメニュー</h1>

      {(!FAVORITE_SHOP_ID || !FAVORITE_THERAPIST_ID) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            💡 お気に入りの店舗・セラピストIDを設定すると、クイックアクセスリンクが表示されます。
          </p>
          <p className="text-xs text-amber-700 mt-1">
            .env.local ファイルに以下を追加してください：
            <br />
            NEXT_PUBLIC_QA_FAVORITE_SHOP_ID=店舗のUUID
            <br />
            NEXT_PUBLIC_QA_FAVORITE_THERAPIST_ID=セラピストのUUID
          </p>
        </div>
      )}

      <Section title="ゲストフロー">
        <div className="space-x-2">
          <Link className="rounded border px-3 py-1 text-sm" href="/guest/search">
            ゲスト検索デモ
          </Link>
          <Link
            className="rounded border px-3 py-1 text-sm"
            href={FAVORITE_THERAPIST_ID ? `/guest/therapists/${FAVORITE_THERAPIST_ID}/reserve` : '#'}
            onClick={!FAVORITE_THERAPIST_ID ? (e) => { e.preventDefault(); alert('環境変数 NEXT_PUBLIC_QA_FAVORITE_THERAPIST_ID を設定してください') } : undefined}
          >
            このセラで予約デモ {!FAVORITE_THERAPIST_ID && '(要設定)'}
          </Link>
        </div>
      </Section>

      <Section title="店舗管理フロー">
        <div className="space-x-2">
          <Link className="rounded border px-3 py-1 text-sm" href="/admin/shops">
            店舗一覧
          </Link>
          {favoriteShopLinks}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-text">店舗を選択してショートカット</label>
          <select
            className="w-full rounded border px-3 py-2 text-sm"
            value={selectedShop}
            onChange={(e) => setSelectedShop(e.target.value)}
            disabled={loadingShops}
          >
            <option value="">店舗を選択</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </select>
          {selectedShop && (
            <div className="space-x-2">
              <Link className="rounded border px-3 py-1 text-sm" href={`/admin/shops/${selectedShop}/therapists`}>
                選択店舗のセラ一覧
              </Link>
              <Link className="rounded border px-3 py-1 text-sm" href={`/guest/search?shop_id=${selectedShop}`}>
                選択店舗でゲスト検索
              </Link>
            </div>
          )}
        </div>
      </Section>

      <Section title="セラ & シフト">
        {favoriteTherapistLinks}
        {selectedShop && (
          <div className="space-y-2">
            <div className="text-sm text-neutral-textMuted">
              {loadingTherapists ? "セラピスト読み込み中…" : "セラを選択してショートカット"}
            </div>
            <ul className="space-y-1">
              {therapists.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{t.name}</span>
                  <Link className="rounded border px-2 py-1" href={`/admin/therapists/${t.id}/shifts`}>
                    シフト管理
                  </Link>
                  <Link className="rounded border px-2 py-1" href={`/guest/therapists/${t.id}/reserve`}>
                    ゲスト予約
                  </Link>
                </li>
              ))}
              {therapists.length === 0 && !loadingTherapists && (
                <li className="text-sm text-neutral-textMuted">セラ情報なし</li>
              )}
            </ul>
          </div>
        )}
      </Section>
    </div>
  )
}
