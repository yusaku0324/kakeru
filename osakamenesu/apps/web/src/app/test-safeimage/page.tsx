'use client'

import SafeImage from '@/components/SafeImage'

export default function TestSafeImagePage() {
  const testImages = [
    {
      url: 'https://i.pravatar.cc/300?img=1',
      label: 'Pravatar (HTTPS)'
    },
    {
      url: 'https://pub-f573ead3e2054ef0a2e2fcc4af0e2203.r2.dev/test.jpg',
      label: 'R2 Bucket (HTTPS)'
    },
    {
      url: 'https://picsum.photos/300/300',
      label: 'Picsum (HTTPS)'
    },
    {
      url: '/images/placeholder-card.svg',
      label: 'Local Placeholder'
    },
    {
      url: null,
      label: 'Null URL (should show placeholder)'
    },
    {
      url: '',
      label: 'Empty URL (should show placeholder)'
    }
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">SafeImage Component Test</h1>

      <div className="grid grid-cols-2 gap-8">
        {testImages.map((item, index) => (
          <div key={index} className="border p-4 rounded">
            <h3 className="font-semibold mb-2">{item.label}</h3>
            <p className="text-sm text-gray-600 mb-4 break-all">URL: {item.url || 'null'}</p>

            <div className="bg-gray-100 p-4">
              <SafeImage
                src={item.url}
                alt={`Test image ${index}`}
                width={300}
                height={300}
                className="w-full h-auto"
              />
            </div>

            <div className="mt-4 text-xs text-gray-500">
              <p>Expected: {item.url ? 'Should show image' : 'Should show placeholder'}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded">
        <h2 className="font-semibold mb-2">Test Instructions:</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Check if HTTPS URLs are showing actual images (not placeholders)</li>
          <li>Check if null/empty URLs show the placeholder image</li>
          <li>Open browser DevTools (F12) and check for any errors in console</li>
          <li>Check Network tab to see if images are being loaded</li>
        </ol>
      </div>
    </div>
  )
}
