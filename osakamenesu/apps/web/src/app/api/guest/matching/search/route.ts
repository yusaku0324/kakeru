import { NextRequest, NextResponse } from 'next/server'

import { buildApiUrl, resolveApiBases } from '@/lib/api'

const SAMPLE_THERAPISTS = [
  {
    therapist_id: '11111111-1111-1111-8888-111111111111',
    therapist_name: '葵',
    shop_id: 'sample-namba-resort',
    shop_name: 'アロマリゾート 難波本店',
    score: 0.85,
    recommended_score: 0.85,
    summary: '丁寧なオイルトリートメントで人気のセラピスト。リンパケアが得意です。',
    slots: [
      { start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), end_at: new Date(Date.now() + 4.5 * 60 * 60 * 1000).toISOString() },
      { start_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), end_at: new Date(Date.now() + 25.5 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    therapist_id: '22222222-2222-2222-8888-222222222222',
    therapist_name: '凛',
    shop_id: 'sample-namba-resort',
    shop_name: 'アロマリゾート 難波本店',
    score: 0.78,
    recommended_score: 0.78,
    summary: 'ストレッチと指圧を組み合わせた独自施術が評判。',
    slots: [
      { start_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), end_at: new Date(Date.now() + 6.5 * 60 * 60 * 1000).toISOString() },
    ],
  },
]

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const targets = resolveApiBases()
  const endpoint = `/api/guest/matching/search?${searchParams.toString()}`

  for (const base of targets) {
    try {
      const response = await fetch(buildApiUrl(base, endpoint), {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()

        if (data.items && data.items.length > 0) {
          return NextResponse.json(data)
        }
      }
    } catch {
      // Try next base or fall through to sample data
    }
  }

  return NextResponse.json({
    items: SAMPLE_THERAPISTS,
    total: SAMPLE_THERAPISTS.length,
  })
}
