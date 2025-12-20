import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  AvailabilityDay,
  AvailabilitySlot,
  ContactInfo,
  MenuItem,
  ShopDetail,
  ShopFormState,
  ShopSummary,
  StaffItem,
} from '@/features/shops/model'
import { normalizeHobbyTags } from '@/features/therapist/profileTags'
import {
  createAdminShop,
  fetchAdminShopDetail,
  fetchAdminShops,
  fetchShopAvailability,
  updateAdminShopContent,
  upsertShopAvailability,
} from '@/features/shops/infra/adminShopsApi'
import { formatDatetimeLocal, formatZonedIso, toZonedDayjs } from '@/lib/timezone'

const SERVICE_TYPES: Array<'store' | 'dispatch'> = ['store', 'dispatch']

function createEmptyForm(): ShopFormState {
  return {
    name: '',
    slug: '',
    area: '',
    priceMin: 0,
    priceMax: 0,
    serviceType: 'store',
    serviceTags: [],
    contact: {},
    description: '',
    catchCopy: '',
    address: '',
    photos: [''],
    menus: [],
    staff: [],
  }
}

function toLocalIso(value?: string | null) {
  if (!value) return ''
  const formatted = formatDatetimeLocal(value)
  return formatted || ''
}

function fromLocalIso(value: string) {
  if (!value) return value
  const normalized = formatZonedIso(value)
  return normalized || value
}

function mapDetailToForm(detail: ShopDetail | null): ShopFormState {
  if (!detail) return createEmptyForm()
  return {
    name: detail.name || '',
    slug: detail.slug || '',
    area: detail.area || '',
    priceMin: detail.price_min,
    priceMax: detail.price_max,
    serviceType: (detail.service_type as 'store' | 'dispatch') || 'store',
    serviceTags: detail.service_tags || [],
    contact: detail.contact || {},
    description: detail.description || '',
    catchCopy: detail.catch_copy || '',
    address: detail.address || '',
    photos: detail.photos?.length ? detail.photos : [''],
    menus: detail.menus || [],
    staff: detail.staff || [],
  }
}

export type AdminShopsNotifications = {
  onError?: (message: string) => void
  onSuccess?: (message: string) => void
}

export function useAdminShopsController(notifications: AdminShopsNotifications = {}) {
  const { onError, onSuccess } = notifications
  const [shops, setShops] = useState<ShopSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [detail, setDetail] = useState<ShopDetail | null>(null)
  const [form, setForm] = useState<ShopFormState>(createEmptyForm())
  const [availability, setAvailability] = useState<AvailabilityDay[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const detailRequestIdRef = useRef(0)

  const notifyError = useCallback((message: string) => onError?.(message), [onError])
  const notifySuccess = useCallback((message: string) => onSuccess?.(message), [onSuccess])

  const loadShops = useCallback(async () => {
    try {
      const items = await fetchAdminShops()
      setShops(items)
      if (!isCreating && !selectedId && items.length > 0) {
        setSelectedId(items[0].id)
      }
    } catch (error) {
      console.error(error)
      notifyError('店舗一覧の取得に失敗しました')
    }
  }, [isCreating, selectedId, notifyError])

  const loadDetail = useCallback(
    async (id: string) => {
      const requestId = detailRequestIdRef.current + 1
      detailRequestIdRef.current = requestId
      setLoadingDetail(true)
      try {
        const json = await fetchAdminShopDetail(id)
        if (detailRequestIdRef.current !== requestId) {
          return
        }
        setDetail(json)
        setForm(mapDetailToForm(json))
        const availabilityJson = await fetchShopAvailability(id)
        if (detailRequestIdRef.current !== requestId) {
          return
        }
        setAvailability(
          (availabilityJson.days || []).map((day) => ({
            date: day.date,
            slots: (day.slots || []).map((slot) => ({
              start_at: toLocalIso(slot.start_at),
              end_at: toLocalIso(slot.end_at),
              status: slot.status,
            })),
          })),
        )
        setIsCreating(false)
      } catch (error) {
        console.error(error)
        if (detailRequestIdRef.current === requestId) {
          notifyError('店舗詳細の取得に失敗しました')
        }
      } finally {
        if (detailRequestIdRef.current === requestId) {
          setLoadingDetail(false)
        }
      }
    },
    [notifyError],
  )

  useEffect(() => {
    loadShops()
  }, [loadShops])

  useEffect(() => {
    if (selectedId && !isCreating) {
      loadDetail(selectedId)
    }
  }, [selectedId, isCreating, loadDetail])

  const selectShop = useCallback((id: string) => {
    setSelectedId(id)
    setIsCreating(false)
  }, [])

  const startCreate = useCallback(() => {
    setIsCreating(true)
    setSelectedId(null)
    setDetail(null)
    setForm(createEmptyForm())
    setAvailability([])
  }, [])

  const updateForm = useCallback(
    <K extends keyof ShopFormState>(key: K, value: ShopFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const updateContact = useCallback((patch: Partial<ContactInfo>) => {
    setForm((prev) => ({ ...prev, contact: { ...prev.contact, ...patch } }))
  }, [])

  const setServiceTags = useCallback((tags: string[]) => {
    setForm((prev) => ({ ...prev, serviceTags: tags }))
  }, [])

  const addServiceTag = useCallback(
    (value?: string) => {
      const baseValue = typeof value === 'string' ? value : tagDraft
      const trimmed = baseValue.trim()
      if (!trimmed) return
      setForm((prev) => {
        if (prev.serviceTags.includes(trimmed)) return prev
        return { ...prev, serviceTags: [...prev.serviceTags, trimmed] }
      })
      setTagDraft('')
    },
    [tagDraft],
  )

  const removeServiceTag = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      serviceTags: prev.serviceTags.filter((_, idx) => idx !== index),
    }))
  }, [])

  const updateMenu = useCallback((index: number, patch: Partial<MenuItem>) => {
    setForm((prev) => ({
      ...prev,
      menus: prev.menus.map((menu, idx) => (idx === index ? { ...menu, ...patch } : menu)),
    }))
  }, [])

  const addMenu = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      menus: [
        ...prev.menus,
        { name: '', price: 0, description: '', duration_minutes: undefined, tags: [] },
      ],
    }))
  }, [])

  const removeMenu = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      menus: prev.menus.filter((_, idx) => idx !== index),
    }))
  }, [])

  const updateStaff = useCallback((index: number, patch: Partial<StaffItem>) => {
    setForm((prev) => ({
      ...prev,
      staff: prev.staff.map((member, idx) => (idx === index ? { ...member, ...patch } : member)),
    }))
  }, [])

  const addStaff = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      staff: [...prev.staff, { name: '', alias: '', headline: '', specialties: [] }],
    }))
  }, [])

  const removeStaff = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      staff: prev.staff.filter((_, idx) => idx !== index),
    }))
  }, [])

  const updatePhoto = useCallback((index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      photos: prev.photos.map((url, idx) => (idx === index ? value : url)),
    }))
  }, [])

  const addPhoto = useCallback(() => {
    setForm((prev) => ({ ...prev, photos: [...prev.photos, ''] }))
  }, [])

  const removePhoto = useCallback((index: number) => {
    setForm((prev) => ({ ...prev, photos: prev.photos.filter((_, idx) => idx !== index) }))
  }, [])

  const refreshAvailability = useCallback(async () => {
    if (!selectedId) return
    try {
      const availabilityJson = await fetchShopAvailability(selectedId)
      setAvailability(
        (availabilityJson.days || []).map((day) => ({
          date: day.date,
          slots: (day.slots || []).map((slot) => ({
            start_at: toLocalIso(slot.start_at),
            end_at: toLocalIso(slot.end_at),
            status: slot.status,
          })),
        })),
      )
    } catch (error) {
      console.error(error)
      notifyError('空き枠の取得に失敗しました')
    }
  }, [selectedId, notifyError])

  const saveAvailability = useCallback(
    async (dateValue: string, slots: AvailabilitySlot[]) => {
      if (!selectedId) return false
      try {
        const payload = {
          date: dateValue,
          slots: slots.map((slot) => ({
            start_at: fromLocalIso(slot.start_at),
            end_at: fromLocalIso(slot.end_at),
            status: slot.status,
          })),
        }
        await upsertShopAvailability(selectedId, payload)
        notifySuccess(`${dateValue} の空き枠を保存しました`)
        await refreshAvailability()
        return true
      } catch (error) {
        console.error(error)
        notifyError('空き枠の保存に失敗しました')
        return false
      }
    },
    [selectedId, notifyError, notifySuccess, refreshAvailability],
  )

  const deleteAvailabilityDay = useCallback(
    async (dayIndex: number) => {
      const target = availability[dayIndex]
      if (!target) return
      if (!target.date) {
        setAvailability((prev) => prev.filter((_, idx) => idx !== dayIndex))
        return
      }
      await saveAvailability(target.date, [])
    },
    [availability, saveAvailability],
  )

  const addAvailabilityDay = useCallback(() => {
    const today = formatZonedIso().slice(0, 10)
    setAvailability((prev) => [...prev, { date: today, slots: [] }])
  }, [])

  const updateAvailabilityDate = useCallback((dayIndex: number, value: string) => {
    setAvailability((prev) =>
      prev.map((day, idx) => (idx === dayIndex ? { ...day, date: value } : day)),
    )
  }, [])

  const addSlot = useCallback((dayIndex: number) => {
    setAvailability((prev) =>
      prev.map((day, idx) =>
        idx === dayIndex
          ? (() => {
              const now = toZonedDayjs()
              const startIso = formatZonedIso(now)
              const endIso = formatZonedIso(now.add(60, 'minute'))
              return {
                ...day,
                slots: [
                  ...day.slots,
                  {
                    start_at: toLocalIso(startIso),
                    end_at: toLocalIso(endIso),
                    status: 'open',
                  },
                ],
              }
            })()
          : day,
      ),
    )
  }, [])

  const updateSlot = useCallback(
    (dayIndex: number, slotIndex: number, key: keyof AvailabilitySlot, value: string) => {
      setAvailability((prev) =>
        prev.map((day, idx) =>
          idx === dayIndex
            ? {
                ...day,
                slots: day.slots.map((slot, sIdx) =>
                  sIdx === slotIndex ? { ...slot, [key]: value } : slot,
                ),
              }
            : day,
        ),
      )
    },
    [],
  )

  const removeSlot = useCallback((dayIndex: number, slotIndex: number) => {
    setAvailability((prev) =>
      prev.map((day, idx) =>
        idx === dayIndex
          ? { ...day, slots: day.slots.filter((_, sIdx) => sIdx !== slotIndex) }
          : day,
      ),
    )
  }, [])

  const buildUpdatePayload = useCallback(() => {
    const normalizedMenus = form.menus.map((menu) => ({
      id: menu.id,
      name: menu.name,
      price: menu.price,
      duration_minutes: menu.duration_minutes,
      description: menu.description,
      tags: menu.tags,
      is_reservable_online: menu.is_reservable_online,
    }))
    const normalizedStaff = form.staff.map((member) => ({
      id: member.id,
      name: member.name,
      alias: member.alias,
      headline: member.headline,
      specialties: member.specialties,
      mood_tag: member.mood_tag ?? null,
      talk_level: member.talk_level ?? null,
      style_tag: member.style_tag ?? null,
      look_type: member.look_type ?? null,
      contact_style: member.contact_style ?? null,
      hobby_tags: normalizeHobbyTags(member.hobby_tags),
    }))

    const contactPayload: ContactInfo = {
      phone: form.contact.phone || undefined,
      line_id: form.contact.line_id || undefined,
      website_url: form.contact.website_url || undefined,
      reservation_form_url: form.contact.reservation_form_url || undefined,
      sns: form.contact.sns || [],
    }

    return {
      name: form.name.trim(),
      slug: form.slug.trim(),
      area: form.area.trim(),
      price_min: Number(form.priceMin) || 0,
      price_max: Number(form.priceMax) || 0,
      service_type: form.serviceType,
      service_tags: form.serviceTags.map((tag) => tag.trim()).filter(Boolean),
      menus: normalizedMenus,
      staff: normalizedStaff,
      contact: contactPayload,
      description: form.description || undefined,
      catch_copy: form.catchCopy || undefined,
      address: form.address.trim(),
      photos: form.photos.map((url) => url.trim()).filter(Boolean),
    }
  }, [form])

  const buildCreatePayload = useCallback((updatePayload: ReturnType<typeof buildUpdatePayload>) => {
    const contactJson: Record<string, any> = {}
    if (updatePayload.contact?.phone) contactJson.phone = updatePayload.contact.phone
    if (updatePayload.contact?.phone) contactJson.tel = updatePayload.contact.phone
    if (updatePayload.contact?.line_id) {
      contactJson.line_id = updatePayload.contact.line_id
      contactJson.line = updatePayload.contact.line_id
    }
    if (updatePayload.contact?.website_url) {
      contactJson.website_url = updatePayload.contact.website_url
      contactJson.web = updatePayload.contact.website_url
    }
    if (updatePayload.contact?.reservation_form_url) {
      contactJson.reservation_form_url = updatePayload.contact.reservation_form_url
    }
    if (updatePayload.service_tags) {
      contactJson.service_tags = updatePayload.service_tags
    }
    if (updatePayload.description) contactJson.description = updatePayload.description
    if (updatePayload.catch_copy) contactJson.catch_copy = updatePayload.catch_copy
    if (updatePayload.address) contactJson.address = updatePayload.address
    if (updatePayload.menus?.length) contactJson.menus = updatePayload.menus
    if (updatePayload.staff?.length) contactJson.staff = updatePayload.staff

    return {
      name: updatePayload.name,
      slug: updatePayload.slug,
      area: updatePayload.area,
      price_min: updatePayload.price_min,
      price_max: updatePayload.price_max,
      bust_tag: 'C',
      service_type: updatePayload.service_type,
      body_tags: updatePayload.service_tags,
      photos: updatePayload.photos,
      contact_json: contactJson,
      status: 'published',
    }
  }, [])

  const saveContent = useCallback(async () => {
    const updatePayload = buildUpdatePayload()
    const preparedPayload = {
      ...updatePayload,
      name: updatePayload.name || detail?.name || '',
      slug: updatePayload.slug || detail?.slug || '',
    }

    if (!preparedPayload.name) {
      notifyError('店舗名を入力してください')
      return
    }
    if (!preparedPayload.slug) {
      if (isCreating) {
        notifyError('スラッグを入力してください')
        return
      }
      delete preparedPayload.slug
    }

    try {
      if (isCreating) {
        const createPayload = buildCreatePayload(preparedPayload)
        const createResult = await createAdminShop(createPayload)
        const newId = createResult.id
        setIsCreating(false)
        setSelectedId(newId)
        await loadShops()
        notifySuccess('店舗を作成しました')
        return
      }

      const targetId = selectedId || detail?.id
      if (!targetId) return
      if (typeof document !== 'undefined') {
        const liveAddress = document
          .querySelector<HTMLInputElement>('[data-testid="shop-address"]')
          ?.value?.trim()
        if (liveAddress) {
          preparedPayload.address = liveAddress
        }
      }
      await updateAdminShopContent(targetId, preparedPayload)
      await loadDetail(targetId)
      await loadShops()
      notifySuccess('店舗情報を保存しました')
    } catch (error) {
      console.error(error)
      notifyError('保存に失敗しました')
    }
  }, [
    buildCreatePayload,
    buildUpdatePayload,
    detail,
    isCreating,
    loadDetail,
    loadShops,
    notifyError,
    notifySuccess,
    selectedId,
  ])

  const canSave = useMemo(() => {
    const resolvedName = (form.name || '').trim() || detail?.name || ''
    const resolvedSlug = (form.slug || '').trim() || detail?.slug || ''
    if (!resolvedName) return false
    if (isCreating && !resolvedSlug) return false
    return true
  }, [detail?.name, detail?.slug, form.name, form.slug, isCreating])

  return {
    state: {
      shops,
      selectedId,
      isCreating,
      detail,
      form,
      availability,
      loadingDetail,
      serviceTypes: SERVICE_TYPES,
      tagDraft,
      canSave,
    },
    actions: {
      selectShop,
      startCreate,
      updateForm,
      updateMenu,
      addMenu,
      removeMenu,
      updateStaff,
      addStaff,
      removeStaff,
      updatePhoto,
      addPhoto,
      removePhoto,
      saveContent,
      refreshAvailability,
      saveAvailability,
      deleteAvailabilityDay,
      addAvailabilityDay,
      updateAvailabilityDate,
      addSlot,
      updateSlot,
      removeSlot,
      loadShops,
      updateContact,
      setServiceTags,
      addServiceTag,
      removeServiceTag,
      setTagDraft: (value: string) => setTagDraft(value),
    },
    tagDraft,
  }
}
