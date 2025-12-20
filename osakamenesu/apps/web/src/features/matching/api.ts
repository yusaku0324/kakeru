export type SimilarTherapist = {
  id: string
  name: string
  age: number | null
  priceRank: number | null
  moodTag?: string | null
  styleTag?: string | null
  lookType?: string | null
  contactStyle?: string | null
  hobbyTags: string[]
  photoUrl?: string | null
  isAvailableNow: boolean
  score: number
  photoSimilarity: number
  tagSimilarity: number
}

export type SimilarTherapistResponse = {
  baseStaffId: string
  items: SimilarTherapist[]
}

export type SimilarTherapistRequest = {
  staffId: string
  limit?: number
  minScore?: number
  shopId?: string
  excludeUnavailable?: boolean
}

function normalizeItem(raw: Record<string, unknown>): SimilarTherapist {
  return {
    id: String(raw.id ?? ''),
    name: typeof raw.name === 'string' ? raw.name : '',
    age: typeof raw.age === 'number' ? raw.age : null,
    priceRank: typeof raw.price_rank === 'number' ? raw.price_rank : null,
    moodTag: typeof raw.mood_tag === 'string' ? raw.mood_tag : null,
    styleTag: typeof raw.style_tag === 'string' ? raw.style_tag : null,
    lookType: typeof raw.look_type === 'string' ? raw.look_type : null,
    contactStyle: typeof raw.contact_style === 'string' ? raw.contact_style : null,
    hobbyTags: Array.isArray(raw.hobby_tags) ? (raw.hobby_tags as string[]) : [],
    photoUrl: typeof raw.photo_url === 'string' ? raw.photo_url : null,
    isAvailableNow: Boolean(raw.is_available_now ?? true),
    score: Number(raw.score ?? 0),
    photoSimilarity: Number(raw.photo_similarity ?? raw.tag_similarity ?? 0),
    tagSimilarity: Number(raw.tag_similarity ?? 0),
  }
}

export async function fetchSimilarTherapists(
  params: SimilarTherapistRequest,
): Promise<SimilarTherapistResponse> {
  const { staffId, limit = 8, minScore, shopId, excludeUnavailable } = params
  const search = new URLSearchParams()
  search.set('staff_id', staffId)
  if (limit) search.set('limit', String(limit))
  if (minScore !== undefined) search.set('min_score', String(minScore))
  if (shopId) search.set('shop_id', shopId)
  if (excludeUnavailable !== undefined) {
    search.set('exclude_unavailable', String(excludeUnavailable))
  }

  try {
    // Use absolute URL to avoid including Basic Auth credentials from window.location
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const resp = await fetch(`${baseUrl}/api/guest/matching/similar?${search.toString()}`, {
      cache: 'no-store',
    })

    if (resp.status === 404) {
      return { baseStaffId: staffId, items: [] }
    }
    if (!resp.ok) {
      console.error('fetchSimilarTherapists failed', resp.status)
      return { baseStaffId: staffId, items: [] }
    }
    const body = await resp.json()
    const items = Array.isArray(body.items) ? body.items.map(normalizeItem) : []
    const baseStaffId = body.base_staff_id ?? body.baseStaffId ?? staffId
    return { baseStaffId, items }
  } catch (e) {
    console.error('fetchSimilarTherapists error', e)
    return { baseStaffId: staffId, items: [] }
  }
}
