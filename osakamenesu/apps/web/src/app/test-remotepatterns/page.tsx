import Image from 'next/image'

export default function TestRemotePatternsPage() {
  // next.config.mjs の remotePatterns 設定を確認するテストページ
  const testImages = [
    {
      url: 'https://pub-f573ead3e2054ef0a2e2fcc4af0e2203.r2.dev/test.jpg',
      label: 'Cloudflare R2 (should work)'
    },
    {
      url: 'https://i.pravatar.cc/300',
      label: 'Pravatar (should work)'
    },
    {
      url: 'https://example.com/test.jpg',
      label: 'Example.com (should fail)'
    }
  ]

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Next.js Remote Patterns Test</h1>

      <div className="space-y-8">
        {testImages.map((item, index) => (
          <div key={index} className="border p-4 rounded">
            <h3 className="font-semibold mb-2">{item.label}</h3>
            <p className="text-sm text-gray-600 mb-4">URL: {item.url}</p>

            <div className="bg-gray-100 p-4">
              {/* 通常のNext.js Image（設定エラーが表示されるはず） */}
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Next.js Image (without error handling):</p>
                <Image
                  src={item.url}
                  alt={item.label}
                  width={200}
                  height={200}
                  unoptimized
                />
              </div>

              {/* 通常のimg要素（常に表示される） */}
              <div>
                <p className="text-sm font-medium mb-2">Regular img element (always works):</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.label}
                  width={200}
                  height={200}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded">
        <h2 className="font-semibold mb-2">Expected Results:</h2>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li>R2 domain should work if next.config.mjs is properly configured</li>
          <li>If you see "Invalid src prop" error, the config is not being applied</li>
          <li>Regular img elements always work (no domain restrictions)</li>
        </ul>
      </div>
    </div>
  )
}
