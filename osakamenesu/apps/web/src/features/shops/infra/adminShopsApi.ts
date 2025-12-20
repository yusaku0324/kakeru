import type {
  AvailabilityDay,
  ContactInfo,
  MenuItem,
  ShopDetail,
  ShopSummary,
  StaffItem,
} from '@/features/shops/model'

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const resp = await fetch(input, init)
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    const message = detail?.detail || resp.statusText || 'Request failed'
    throw new Error(message)
  }
  return resp.json() as Promise<T>
}

export async function fetchAdminShops(): Promise<ShopSummary[]> {
  const data = await jsonFetch<{ items: ShopSummary[] }>('/api/admin/shops', { cache: 'no-store' })
  return data.items || []
}

export async function fetchAdminShopDetail(id: string): Promise<ShopDetail> {
  return jsonFetch<ShopDetail>(`/api/admin/shops/${id}`, { cache: 'no-store' })
}

export type ShopContentPayload = {
  name: string
  slug?: string | null
  area: string
  price_min: number
  price_max: number
  service_type: string
  service_tags: string[]
  contact: ContactInfo | null
  description?: string | null
  catch_copy?: string | null
  address?: string | null
  photos: string[]
  menus: MenuItem[]
  staff: StaffItem[]
}

export async function updateAdminShopContent(id: string, payload: ShopContentPayload) {
  await jsonFetch(`/api/admin/shops/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export type CreateShopResponse = { id: string }

export async function createAdminShop(payload: Record<string, unknown>) {
  return jsonFetch<CreateShopResponse>('/api/admin/shops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function fetchShopAvailability(id: string): Promise<{ days: AvailabilityDay[] }> {
  return jsonFetch(`/api/admin/shops/${id}/availability`, { cache: 'no-store' })
}

export async function upsertShopAvailability(id: string, payload: { date: string; slots: Array<{ start_at: string; end_at: string; status?: string }> }) {
  await jsonFetch(`/api/admin/shops/${id}/availability`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
