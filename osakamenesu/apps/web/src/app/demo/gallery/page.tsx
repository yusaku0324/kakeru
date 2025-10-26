import Gallery from '@/components/Gallery'

export default function GalleryDemoPage() {
  const photos = [
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507537417841-1ae12265b9c9?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80',
  ]
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Gallery Demo</h1>
        <a href="/" className="text-blue-600">トップへ</a>
      </header>
      <Gallery photos={photos} altBase="Demo" />
      <p className="text-sm text-slate-600">サムネ/ドットのクリック、スワイプ/フリックでの移動、LQIP表示を確認できます。</p>
    </main>
  )
}
