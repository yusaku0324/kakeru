import Link from 'next/link'

import Gallery from '@/components/Gallery'

export default function GalleryDemoPage() {
  const photos = [
    '/images/demo-shop-1.svg',
    '/images/demo-shop-2.svg',
    '/images/demo-shop-3.svg',
    '/images/placeholder-card.svg',
    '/images/demo-shop-2.svg',
  ]
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Gallery Demo</h1>
        <Link href="/" className="text-blue-600">
          トップへ
        </Link>
      </header>
      <Gallery photos={photos} altBase="Demo" />
      <p className="text-sm text-slate-600">
        サムネ/ドットのクリック、スワイプ/フリックでの移動、LQIP表示を確認できます。
      </p>
    </main>
  )
}
