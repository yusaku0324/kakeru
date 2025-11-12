import { revalidateTag } from 'next/cache'

export const CACHE_TAGS = {
  stores: 'stores',
  store: (id: string) => `store-${id}`,
  staff: (id: string) => `staff-${id}`,
  slots: (storeId: string, yyyymmdd: string) => `slots-${storeId}-${yyyymmdd}`,
  searchFacets: 'search-facets',
  homeFeatured: 'home-featured',
} as const

const CACHE_LIFETIME_SECONDS = {
  hours: 60 * 60,
  // スロットは最長保持が欲しいので 24 時間
  max: 60 * 60 * 24,
} as const

export const CACHE_REVALIDATE_SECONDS = {
  homeFeatured: CACHE_LIFETIME_SECONDS.hours,
  searchFacets: CACHE_LIFETIME_SECONDS.hours,
  stores: CACHE_LIFETIME_SECONDS.hours,
  staff: CACHE_LIFETIME_SECONDS.hours,
  slots: CACHE_LIFETIME_SECONDS.max,
} as const

export function revalidateHomeFeatured() {
  revalidateTag(CACHE_TAGS.homeFeatured, 'hours')
}

export function revalidateStores() {
  revalidateTag(CACHE_TAGS.stores, 'hours')
}

export function revalidateStore(id: string) {
  revalidateTag(CACHE_TAGS.store(id), 'hours')
}

export function revalidateStaff(id: string) {
  revalidateTag(CACHE_TAGS.staff(id), 'hours')
}

export function revalidateSlots(storeId: string, yyyymmdd: string) {
  revalidateTag(CACHE_TAGS.slots(storeId, yyyymmdd), 'max')
}
