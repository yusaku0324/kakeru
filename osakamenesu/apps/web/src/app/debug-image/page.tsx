'use client'

import SafeImage from '@/components/SafeImage'
import { useState } from 'react'

export default function DebugImagePage() {
  const [testUrls] = useState([
    'https://i.pravatar.cc/300',
    'https://pub-f573ead3e2054ef0a2e2fcc4af0e2203.r2.dev/test.jpg',
    'https://example.com/test.jpg',
    '/images/placeholder-card.svg'
  ])

  const [uploadedUrl, setUploadedUrl] = useState('')

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">SafeImage Debug Page</h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Test URLs</h2>
        <div className="grid grid-cols-2 gap-4">
          {testUrls.map((url, index) => (
            <div key={index} className="border p-4">
              <p className="text-sm mb-2">URL: {url}</p>
              <SafeImage
                src={url}
                alt={`Test image ${index}`}
                width={200}
                height={200}
                className="border"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Custom URL Test</h2>
        <input
          type="text"
          value={uploadedUrl}
          onChange={(e) => setUploadedUrl(e.target.value)}
          placeholder="Enter image URL"
          className="border p-2 w-full mb-4"
        />
        {uploadedUrl && (
          <div className="border p-4">
            <p className="text-sm mb-2">URL: {uploadedUrl}</p>
            <SafeImage
              src={uploadedUrl}
              alt="Custom test image"
              width={200}
              height={200}
              className="border"
            />
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-gray-100">
        <h2 className="text-xl font-semibold mb-4">Debug Info</h2>
        <pre className="text-xs">
{`SafeImage version: Current
Build time: ${new Date().toISOString()}`}
        </pre>
      </div>
    </div>
  )
}
