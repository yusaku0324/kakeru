import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-bold">ページが見つかりません</h1>
      <p className="text-slate-600 mt-2">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <Link href="/" className="inline-block mt-4 text-blue-600">
        トップへ戻る
      </Link>
    </main>
  )
}
