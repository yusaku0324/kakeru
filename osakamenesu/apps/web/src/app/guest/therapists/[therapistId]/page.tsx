"use client"

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

/**
 * シンプルなセラピスト詳細ページ（v1）
 *  - 現状は検索/マッチング結果から遷移してくる前提で、パラメータ情報をそのまま表示するだけ。
 *  - 予約導線を /guest/therapists/[id]/reserve に統一するための入口。
 */
export default function TherapistDetailPage({ params }: { params: { therapistId: string } }) {
  const sp = useSearchParams()
  const shopId = sp.get('shop_id') || ''
  const therapistName = sp.get('name') || ''
  const shopName = sp.get('shop_name') || ''

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 text-sm">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-text">セラピスト詳細</h1>
        <p className="text-neutral-textMuted">ID: {params.therapistId}</p>
        {therapistName ? <p className="text-neutral-textMuted">名前: {therapistName}</p> : null}
        {shopName ? <p className="text-neutral-textMuted">店舗: {shopName}</p> : null}
        {shopId ? <p className="text-neutral-textMuted">店舗ID: {shopId}</p> : null}
      </div>

      <div className="flex gap-3">
        <Link
          className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105"
          href={`/guest/therapists/${params.therapistId}/reserve${shopId ? `?shop_id=${shopId}` : ''}`}
        >
          この子を予約する
        </Link>
        <Link className="text-brand-primary underline" href="/guest/search">
          検索に戻る
        </Link>
      </div>
    </main>
  )
}
