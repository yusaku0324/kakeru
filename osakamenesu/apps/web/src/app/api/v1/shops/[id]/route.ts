import { NextResponse, type NextRequest } from 'next/server'

import { SAMPLE_SHOPS } from '@/lib/sampleShops'
import { sampleShopToDetail } from '@/lib/sampleShopAdapters'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Params) {
  const { id: identifier } = await context.params
  const shop =
    SAMPLE_SHOPS.find((candidate) => candidate.id === identifier) ??
    SAMPLE_SHOPS.find((candidate) => candidate.slug === identifier)

  if (!shop) {
    return NextResponse.json({ detail: 'shop not found' }, { status: 404 })
  }

  const payload = sampleShopToDetail(shop)
  return NextResponse.json(payload)
}
