import Link from 'next/link'

export default function ShopNotFound() {
  return (
    <main className="mx-auto max-w-4xl p-4">
      <div className="rounded border border-red-200 bg-red-50 p-6 text-center">
        <h1 className="mb-2 text-xl font-bold text-red-800">
          店舗が見つかりませんでした
        </h1>
        <p className="mb-4 text-sm text-red-700">
          お探しの店舗は存在しないか、削除された可能性があります。
        </p>
        <Link
          href="/search"
          className="inline-block rounded-full bg-brand-primary px-6 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary/90"
        >
          店舗を検索する
        </Link>
      </div>
    </main>
  )
}
