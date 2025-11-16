import { notFound } from 'next/navigation'
import TestFavoritesClient from './testFavoritesClient'

const isMockMode =
  (process.env.NEXT_PUBLIC_FAVORITES_API_MODE || process.env.FAVORITES_API_MODE || '')
    .toLowerCase()
    .includes('mock') || process.env.NODE_ENV !== 'production'

export default function TestFavoritesPage() {
  if (!isMockMode) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-12 text-sm text-neutral-text">
        <h1 className="text-xl font-semibold">テスト用お気に入りページ</h1>
        <p>このページはモックお気に入り API が有効な環境でのみ実データを書き換えずに利用できます。</p>
        <p className="text-neutral-textMuted">
          `FAVORITES_API_MODE=mock` を設定して再読み込みするか、Playwright などの E2E 実行環境でアクセスしてください。
        </p>
      </div>
    )
  }
  return <TestFavoritesClient />
}
