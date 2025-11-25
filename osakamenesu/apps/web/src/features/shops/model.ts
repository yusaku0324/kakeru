export type ShopSummary = {
  id: string
  name: string
  slug?: string | null
  area: string
  status: string
  service_type: string
}

export type MenuItem = {
  id?: string
  name: string
  price: number
  duration_minutes?: number | null
  description?: string | null
  tags?: string[]
  is_reservable_online?: boolean | null
}

export type StaffItem = {
  id?: string
  name: string
  alias?: string | null
  headline?: string | null
  specialties?: string[]
  mood_tag?: string | null
  talk_level?: string | null
  style_tag?: string | null
  look_type?: string | null
  contact_style?: string | null
  hobby_tags?: string[] | null
}

export type AvailabilitySlot = {
  start_at: string
  end_at: string
  status: 'open' | 'tentative' | 'blocked'
}

export type AvailabilityDay = {
  date: string
  slots: AvailabilitySlot[]
}

export type ContactInfo = {
  phone?: string
  line_id?: string
  website_url?: string
  reservation_form_url?: string
  sns?: string[]
}

export type ShopDetail = {
  id: string
  slug?: string | null
  name: string
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
  availability: AvailabilityDay[]
}

export type ShopFormState = {
  name: string
  slug: string
  area: string
  priceMin: number
  priceMax: number
  serviceType: 'store' | 'dispatch'
  serviceTags: string[]
  contact: ContactInfo
  description: string
  catchCopy: string
  address: string
  photos: string[]
  menus: MenuItem[]
  staff: StaffItem[]
}
