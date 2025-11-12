"use client"

import { useCallback, useEffect, useState } from 'react'
import { useToast, ToastContainer } from '@/components/useToast'
import { Card } from '@/components/ui/Card'

const EMPTY_PHONE = ''

type ShopSummary = {
  id: string
  name: string
  slug?: string | null
  area: string
  status: string
  service_type: string
}

type MenuItem = {
  id?: string
  name: string
  price: number
  duration_minutes?: number | null
  description?: string | null
  tags?: string[]
  is_reservable_online?: boolean | null
}

type StaffItem = {
  id?: string
  name: string
  alias?: string | null
  headline?: string | null
  specialties?: string[]
}

type AvailabilitySlot = {
  start_at: string
  end_at: string
  status: 'open' | 'tentative' | 'blocked'
}

type AvailabilityDay = {
  date: string
  slots: AvailabilitySlot[]
}

const STATUS_OPTIONS: Array<AvailabilitySlot['status']> = ['open', 'tentative', 'blocked']

type ContactInfo = {
  phone?: string
  line_id?: string
  website_url?: string
  reservation_form_url?: string
}

type ShopDetail = {
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

function toLocalIso(value?: string | null) {
  if (!value) return ''
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const offset = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - offset).toISOString().slice(0, 16)
  } catch {
    return value
  }
}

function fromLocalIso(value: string) {
  if (!value) return value
  try {
    const date = new Date(value)
    return date.toISOString()
  } catch {
    return value
  }
}

function emptyMenu(): MenuItem {
  return { name: '', price: 0, duration_minutes: undefined, description: '', tags: [] }
}

function emptyStaff(): StaffItem {
  return { name: '', alias: '', headline: '', specialties: [] }
}

function emptySlot(): AvailabilitySlot {
  const now = new Date()
  const plusHour = new Date(now.getTime() + 60 * 60 * 1000)
  return {
    start_at: toLocalIso(now.toISOString()),
    end_at: toLocalIso(plusHour.toISOString()),
    status: 'open',
  }
}

const SERVICE_TYPES = ['store', 'dispatch'] as const
type ServiceType = typeof SERVICE_TYPES[number]

export default function AdminShopsPage() {
  const [shops, setShops] = useState<ShopSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState<boolean>(false)
  const [detail, setDetail] = useState<ShopDetail | null>(null)
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [staff, setStaff] = useState<StaffItem[]>([])
  const [serviceTags, setServiceTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState<string>('')
  const [contact, setContact] = useState<ContactInfo>({})
  const [availability, setAvailability] = useState<AvailabilityDay[]>([])
  const [description, setDescription] = useState<string>('')
  const [catchCopy, setCatchCopy] = useState<string>('')
  const [address, setAddress] = useState<string>('')
  const [photoUrls, setPhotoUrls] = useState<string[]>([''])
  const [name, setName] = useState<string>('')
  const [slugValue, setSlugValue] = useState<string>('')
  const [areaValue, setAreaValue] = useState<string>('')
  const [priceMin, setPriceMin] = useState<number>(0)
  const [priceMax, setPriceMax] = useState<number>(0)
  const [serviceType, setServiceType] = useState<ServiceType>('store')
  const { toasts, push, remove } = useToast()
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false)

  async function refreshAvailability(id: string) {
    try {
      const resp = await fetch(`/api/admin/shops/${id}/availability`, { cache: 'no-store' })
      if (!resp.ok) throw new Error('failed to load availability')
      const json = await resp.json()
      const days = (json.days || []) as AvailabilityDay[]
      setAvailability(days.map(day => ({
        date: day.date,
        slots: (day.slots || []).map(slot => ({
          start_at: toLocalIso(slot.start_at),
          end_at: toLocalIso(slot.end_at),
          status: slot.status,
        })),
      })))
    } catch (err) {
      console.error(err)
      push('error', '空き枠の取得に失敗しました')
    }
  }

  async function fetchShops(selectFirst: boolean = true) {
    try {
      const resp = await fetch('/api/admin/shops', { cache: 'no-store' })
      if (!resp.ok) throw new Error('failed to load shops')
      const json = await resp.json()
      const items: ShopSummary[] = json.items || []
      setShops(items)
      if (selectFirst && items.length > 0 && !isCreating) {
        setSelectedId(items[0].id)
      }
    } catch (err) {
      console.error(err)
      push('error', '店舗一覧の取得に失敗しました')
    }
  }

  useEffect(() => {
    fetchShops()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchDetail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    try {
      const resp = await fetch(`/api/admin/shops/${id}`, { cache: 'no-store' })
      if (!resp.ok) throw new Error('failed to load detail')
      const json = await resp.json()
      setDetail(json)
      setName(json.name || '')
      setSlugValue(json.slug || '')
      setAreaValue(json.area || '')
      setPriceMin(json.price_min ?? 0)
      setPriceMax(json.price_max ?? 0)
      setServiceType((json.service_type as ServiceType) || 'store')
      setIsCreating(false)
      setMenus((json.menus || []).map((m: MenuItem) => ({
        ...m,
        tags: (m.tags || []),
      })))
      setStaff((json.staff || []).map((s: StaffItem) => ({
        ...s,
        specialties: (s.specialties || []),
      })))
      setServiceTags(json.service_tags || [])
      setContact({
        phone: json.contact?.phone || EMPTY_PHONE,
        line_id: json.contact?.line_id || '',
        website_url: json.contact?.website_url || '',
        reservation_form_url: json.contact?.reservation_form_url || '',
      })
      if (json.availability && json.availability.length > 0) {
        setAvailability((json.availability || []).map((day: AvailabilityDay) => ({
          date: day.date,
          slots: (day.slots || []).map(slot => ({
            start_at: toLocalIso(slot.start_at),
            end_at: toLocalIso(slot.end_at),
            status: slot.status,
          })),
        })))
      } else {
        setAvailability([])
      }
      setDescription(json.description || '')
      setCatchCopy(json.catch_copy || '')
      setAddress(json.address || '')
      const photos: string[] = json.photos && json.photos.length > 0 ? json.photos : ['']
      setPhotoUrls(photos)
    } catch (err) {
      console.error(err)
      push('error', '店舗詳細の取得に失敗しました')
    } finally {
      setLoadingDetail(false)
    }
  }, [push])

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId)
    }
  }, [selectedId, fetchDetail])

  function selectShop(id: string) {
    setIsCreating(false)
    setSelectedId(id)
  }

  function startCreate() {
    setIsCreating(true)
    setSelectedId(null)
    const blankDetail: ShopDetail = {
      id: '',
      name: '',
      slug: '',
      area: '',
      price_min: 0,
      price_max: 0,
      service_type: 'store',
      service_tags: [],
      contact: null,
      description: '',
      catch_copy: '',
      address: '',
      photos: [],
      menus: [],
      staff: [],
      availability: [],
    }
    setDetail(blankDetail)
    setName('')
    setSlugValue('')
    setAreaValue('')
    setPriceMin(0)
    setPriceMax(0)
    setServiceType('store')
    setServiceTags([])
    setContact({})
    setMenus([emptyMenu()])
    setStaff([emptyStaff()])
    setAvailability([])
    setDescription('')
    setCatchCopy('')
    setAddress('')
    setPhotoUrls([''])
  }

  function updateMenu(index: number, key: keyof MenuItem, value: any) {
    setMenus(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [key]: value }
      return next
    })
  }

  function updateStaff(index: number, key: keyof StaffItem, value: any) {
    setStaff(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [key]: value }
      return next
    })
  }

  function addServiceTag() {
    const value = tagDraft.trim()
    if (!value) return
    if (serviceTags.includes(value)) {
      setTagDraft('')
      return
    }
    setServiceTags(prev => [...prev, value])
    setTagDraft('')
  }

  function removeServiceTag(index: number) {
    setServiceTags(prev => prev.filter((_, idx) => idx !== index))
  }

  function updatePhotoUrl(index: number, value: string) {
    setPhotoUrls(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  function addPhotoField() {
    setPhotoUrls(prev => [...prev, ''])
  }

  function removePhotoField(index: number) {
    setPhotoUrls(prev => prev.filter((_, idx) => idx !== index))
  }

  function updateSlot(dayIndex: number, slotIndex: number, key: keyof AvailabilitySlot, value: any) {
    setAvailability(prev => {
      const next = [...prev]
      const day = { ...next[dayIndex] }
      const slots = [...day.slots]
      slots[slotIndex] = { ...slots[slotIndex], [key]: value }
      day.slots = slots
      next[dayIndex] = day
      return next
    })
  }

  function addSlot(dayIndex: number) {
    setAvailability(prev => {
      const next = [...prev]
      const day = { ...next[dayIndex] }
      day.slots = [...day.slots, emptySlot()]
      next[dayIndex] = day
      return next
    })
  }

  function removeSlot(dayIndex: number, slotIndex: number) {
    setAvailability(prev => {
      const next = [...prev]
      const day = { ...next[dayIndex] }
      day.slots = day.slots.filter((_, idx) => idx !== slotIndex)
      next[dayIndex] = day
      return next
    })
  }

  function addAvailabilityDay() {
    setAvailability(prev => [...prev, { date: '', slots: [emptySlot()] }])
  }

  function updateAvailabilityDate(index: number, value: string) {
    setAvailability(prev => {
      const next = [...prev]
      next[index] = { ...next[index], date: value }
      return next
    })
  }

  function buildUpdatePayload() {
    const normalizedMenus = menus
      .filter(menu => menu.name?.trim())
      .map(menu => ({
        ...menu,
        name: menu.name.trim(),
        price: Number(menu.price) || 0,
        duration_minutes: menu.duration_minutes ? Number(menu.duration_minutes) : undefined,
        description: menu.description || undefined,
        tags: (menu.tags || []).map(tag => tag.trim()).filter(Boolean),
      }))

    const normalizedStaff = staff
      .filter(member => member.name?.trim())
      .map(member => ({
        ...member,
        name: member.name.trim(),
        alias: member.alias || undefined,
        headline: member.headline || undefined,
        specialties: (member.specialties || []).map(tag => tag.trim()).filter(Boolean),
      }))

    const contactPayload: ContactInfo = {
      phone: contact.phone && contact.phone !== EMPTY_PHONE ? contact.phone : undefined,
      line_id: contact.line_id || undefined,
      website_url: contact.website_url || undefined,
      reservation_form_url: contact.reservation_form_url || undefined,
    }

    return {
      name: name.trim(),
      slug: slugValue.trim() || undefined,
      area: areaValue.trim(),
      price_min: Number(priceMin) || 0,
      price_max: Number(priceMax) || 0,
      service_type: serviceType,
      service_tags: serviceTags,
      menus: normalizedMenus,
      staff: normalizedStaff,
      contact: contactPayload,
      description: description || undefined,
      catch_copy: catchCopy || undefined,
      address: address || undefined,
      photos: photoUrls.map(url => url.trim()).filter(Boolean),
    }
  }

  function buildCreatePayload(updatePayload: ReturnType<typeof buildUpdatePayload>) {
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
  }

  async function saveContent() {
    const updatePayload = buildUpdatePayload()
    if (!updatePayload.name) {
      push('error', '店舗名を入力してください')
      return
    }
    if (!updatePayload.slug) {
      push('error', 'スラッグを入力してください')
      return
    }

    try {
      if (isCreating) {
        const createPayload = buildCreatePayload(updatePayload)
        const createResp = await fetch('/api/admin/shops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload),
        })
      if (!createResp.ok) {
        const detailResp = await createResp.json().catch(() => ({}))
        push('error', detailResp?.detail || '店舗の作成に失敗しました')
        return
      }
      const createJson = await createResp.json()
      const newId = createJson.id || createJson?.detail?.id
      if (!newId) {
        push('error', '店舗IDを取得できませんでした')
        return
      }

      const patchResp = await fetch(`/api/admin/shops/${newId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })
      if (!patchResp.ok) {
        const patchDetail = await patchResp.json().catch(() => ({}))
        push('error', patchDetail?.detail || '店舗情報の更新に失敗しました')
        return
      }
        setIsCreating(false)
        setSelectedId(newId)
        await fetchShops(false)
        push('success', '店舗を作成しました')
        return
      }

      if (!selectedId) return

      const resp = await fetch(`/api/admin/shops/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })
      if (!resp.ok) {
        const detailResp = await resp.json().catch(() => ({}))
        push('error', detailResp?.detail || '保存に失敗しました')
        return
      }
      await fetchDetail(selectedId)
      await fetchShops(false)
      push('success', '店舗情報を保存しました')
    } catch (err) {
      console.error(err)
      push('error', 'ネットワークエラーが発生しました')
    }
  }

  async function saveAvailability(date: string, slots: AvailabilitySlot[]) {
    if (!selectedId) return false
    if (!date) {
      push('error', '日付を入力してください')
      return false
    }
    try {
      const payload = {
        date,
        slots: slots.map(slot => ({
          start_at: fromLocalIso(slot.start_at),
          end_at: fromLocalIso(slot.end_at),
          status: slot.status,
        })),
      }
      const resp = await fetch(`/api/admin/shops/${selectedId}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        const detailResp = await resp.json().catch(() => ({}))
        push('error', detailResp?.detail || '空き枠の保存に失敗しました')
        return false
      }
      push('success', `${date} の空き枠を保存しました`)
      await refreshAvailability(selectedId)
      return true
    } catch (err) {
      console.error(err)
      push('error', 'ネットワークエラーが発生しました')
      return false
    }
  }

  async function deleteAvailabilityDay(dayIndex: number) {
    if (!selectedId) return
    const target = availability[dayIndex]
    if (!target) return
    await saveAvailability(target.date, [])
  }

  if (!detail || (!selectedId && !isCreating)) {
    return (
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <h1 data-testid="admin-title" className="text-2xl font-semibold">店舗管理</h1>
        <p className="text-sm text-slate-500">店舗を選択してください。</p>
        <ToastContainer toasts={toasts} onDismiss={remove} />
      </main>
    )
  }

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <aside className="w-full md:w-64 border rounded-lg bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
            <span>店舗一覧</span>
            <button
              type="button"
              onClick={startCreate}
              className="rounded border border-blue-600 px-2 py-0.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
            >
              新規
            </button>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {shops.map(shop => (
              <li key={shop.id}>
                <button
                  onClick={() => selectShop(shop.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 ${shop.id === selectedId && !isCreating ? 'bg-blue-50 font-semibold' : ''}`}
                >
                  <div>{shop.name}</div>
                  <div className="text-xs text-slate-500">{shop.area} / {shop.status}</div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex-1 space-y-6">
          <header className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">店舗名 *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例: アロマリゾート 難波本店"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-lg font-semibold text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">スラッグ *</label>
                <input
                  value={slugValue}
                  onChange={e => setSlugValue(e.target.value)}
                  placeholder="例: aroma-namba"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">エリア</label>
                <input
                  value={areaValue}
                  onChange={e => setAreaValue(e.target.value)}
                  placeholder="例: 難波/日本橋"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">サービス種別</label>
                <select
                  value={serviceType}
                  onChange={e => setServiceType(e.target.value as ServiceType)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  {SERVICE_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type === 'store' ? '店舗型' : '出張型'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">最低料金 (円)</label>
                <input
                  type="number"
                  value={priceMin}
                  onChange={e => setPriceMin(Number(e.target.value))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  min={0}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">最高料金 (円)</label>
                <input
                  type="number"
                  value={priceMax}
                  onChange={e => setPriceMax(Number(e.target.value))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  min={0}
                />
              </div>
            </div>
            {loadingDetail ? <p className="text-xs text-slate-400">読み込み中...</p> : null}
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">店舗紹介文</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className="w-full border rounded px-3 py-2 text-sm"
                data-testid="shop-description"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">キャッチコピー</label>
              <textarea
                value={catchCopy}
                onChange={e => setCatchCopy(e.target.value)}
                rows={4}
                className="w-full border rounded px-3 py-2 text-sm"
                data-testid="shop-catch-copy"
              />
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">出勤・空き枠</h2>
              <button
                type="button"
                onClick={addAvailabilityDay}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                日を追加
              </button>
            </div>
            <p className="text-xs text-slate-500">日付を選び、時間帯とステータスを編集して保存してください。</p>
            {availability.length === 0 ? (
              <Card className="p-4 text-sm text-slate-500">登録された空き枠はありません。</Card>
            ) : null}
            <div className="space-y-4">
              {availability.map((day, dayIndex) => (
                <Card key={dayIndex} className="space-y-4 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">日付</label>
                      <input
                        type="date"
                        value={day.date}
                        onChange={e => updateAvailabilityDate(dayIndex, e.target.value)}
                        className="rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => deleteAvailabilityDay(dayIndex)}
                        className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
                      >
                        日を削除
                      </button>
                      <button
                        type="button"
                        onClick={() => saveAvailability(day.date, day.slots)}
                        className="rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        この日の枠を保存
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {day.slots.map((slot, slotIndex) => (
                      <div
                        key={slotIndex}
                        className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1fr_160px_auto] md:items-end"
                      >
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">開始</label>
                          <input
                            type="datetime-local"
                            value={slot.start_at}
                            onChange={e => updateSlot(dayIndex, slotIndex, 'start_at', e.target.value)}
                            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">終了</label>
                          <input
                            type="datetime-local"
                            value={slot.end_at}
                            onChange={e => updateSlot(dayIndex, slotIndex, 'end_at', e.target.value)}
                            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">ステータス</label>
                          <select
                            value={slot.status}
                            onChange={e => updateSlot(dayIndex, slotIndex, 'status', e.target.value as AvailabilitySlot['status'])}
                            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                          >
                            {STATUS_OPTIONS.map(option => (
                              <option key={option} value={option}>
                                {option === 'open' ? '空きあり' : option === 'tentative' ? '調整中' : '受付停止'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex h-full items-end justify-end">
                          <button
                            type="button"
                            onClick={() => removeSlot(dayIndex, slotIndex)}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                          >
                            枠を削除
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addSlot(dayIndex)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      枠を追加
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">住所</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              data-testid="shop-address"
            />
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">掲載写真URL</label>
              <button onClick={addPhotoField} className="border px-3 py-1 rounded text-sm" type="button">行を追加</button>
            </div>
            <div className="space-y-2">
              {photoUrls.map((url, idx) => (
                <div key={`photo-${idx}`} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={url}
                    onChange={e => updatePhotoUrl(idx, e.target.value)}
                    className="flex-1 border rounded px-3 py-2 text-sm font-mono"
                    placeholder="https://example.com/photo.jpg"
                    data-testid="shop-photo-input"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => removePhotoField(idx)} className="text-xs text-red-600" type="button" disabled={photoUrls.length <= 1}>削除</button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">公開ページに表示する画像のURLを1行ずつ入力してください。</p>
          </section>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">サービスタグ</label>
            <div className="flex flex-wrap gap-2" data-testid="shop-service-tags">
              {serviceTags.length === 0 ? (
                <span className="text-xs text-slate-400 border border-dashed rounded px-2 py-1">タグ未設定</span>
              ) : (
                serviceTags.map((tag, idx) => (
                  <span key={`${tag}-${idx}`} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                    {tag}
                    <button onClick={() => removeServiceTag(idx)} className="hover:text-blue-900" type="button" aria-label={`${tag} を削除`}>
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={tagDraft}
                onChange={e => setTagDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addServiceTag()
                  }
                }}
                className="flex-1 border rounded px-3 py-2 text-sm"
                placeholder="例: 指圧, アロマ"
              />
              <button onClick={addServiceTag} className="border px-3 py-1 rounded text-sm" type="button">追加</button>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">連絡先</h2>
            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={contact.phone || ''}
                onChange={e => setContact(prev => ({ ...prev, phone: e.target.value }))}
                className="border rounded px-3 py-2 text-sm"
                placeholder="電話番号"
              />
              <input
                value={contact.line_id || ''}
                onChange={e => setContact(prev => ({ ...prev, line_id: e.target.value }))}
                className="border rounded px-3 py-2 text-sm"
                placeholder="LINE ID / URL"
              />
              <input
                value={contact.website_url || ''}
                onChange={e => setContact(prev => ({ ...prev, website_url: e.target.value }))}
                className="border rounded px-3 py-2 text-sm"
                placeholder="公式サイトURL"
              />
              <input
                value={contact.reservation_form_url || ''}
                onChange={e => setContact(prev => ({ ...prev, reservation_form_url: e.target.value }))}
                className="border rounded px-3 py-2 text-sm"
                placeholder="WEB予約フォームURL"
              />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">メニュー</h2>
              <button onClick={() => setMenus(prev => [...prev, emptyMenu()])} className="border px-3 py-1 rounded text-sm">メニューを追加</button>
            </div>
            <div className="space-y-3">
              {menus.map((menu, idx) => (
                <div
                  key={menu.id || idx}
                  className="border rounded-lg bg-white shadow-sm p-3 space-y-2"
                  data-testid="menu-item"
                >
                  <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr]">
                    <input
                      value={menu.name}
                      onChange={e => updateMenu(idx, 'name', e.target.value)}
                      className="border rounded px-3 py-2 text-sm"
                      placeholder="メニュー名"
                    />
                    <input
                      value={menu.price}
                      onChange={e => updateMenu(idx, 'price', Number(e.target.value))}
                      className="border rounded px-3 py-2 text-sm"
                      type="number"
                      min={0}
                      placeholder="価格"
                    />
                    <input
                      value={menu.duration_minutes ?? ''}
                      onChange={e => updateMenu(idx, 'duration_minutes', e.target.value ? Number(e.target.value) : undefined)}
                      className="border rounded px-3 py-2 text-sm"
                      type="number"
                      min={0}
                      placeholder="時間(分)"
                    />
                  </div>
                  <textarea
                    value={menu.description || ''}
                    onChange={e => updateMenu(idx, 'description', e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    rows={2}
                    placeholder="説明"
                  />
                  <input
                    value={(menu.tags || []).join(', ')}
                    onChange={e => updateMenu(idx, 'tags', e.target.value.split(',').map(tag => tag.trim()).filter(Boolean))}
                    className="border rounded px-3 py-2 text-sm w-full"
                    placeholder="タグ (カンマ区切り)"
                  />
                  <div className="flex justify-end">
                    <button onClick={() => setMenus(prev => prev.filter((_, i) => i !== idx))} className="text-xs text-red-600">削除</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">スタッフ</h2>
              <button onClick={() => setStaff(prev => [...prev, emptyStaff()])} className="border px-3 py-1 rounded text-sm">スタッフを追加</button>
            </div>
            <div className="space-y-3">
              {staff.map((member, idx) => (
                <div
                  key={member.id || idx}
                  className="border rounded-lg bg-white shadow-sm p-3 space-y-2"
                  data-testid="staff-item"
                >
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      value={member.name}
                      onChange={e => updateStaff(idx, 'name', e.target.value)}
                      className="border rounded px-3 py-2 text-sm"
                      placeholder="名前"
                    />
                    <input
                      value={member.alias || ''}
                      onChange={e => updateStaff(idx, 'alias', e.target.value)}
                      className="border rounded px-3 py-2 text-sm"
                      placeholder="表示名"
                    />
                  </div>
                  <textarea
                    value={member.headline || ''}
                    onChange={e => updateStaff(idx, 'headline', e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    rows={2}
                    placeholder="紹介文"
                  />
                  <input
                    value={(member.specialties || []).join(', ')}
                    onChange={e => updateStaff(idx, 'specialties', e.target.value.split(',').map(tag => tag.trim()).filter(Boolean))}
                    className="border rounded px-3 py-2 text-sm w-full"
                    placeholder="得意分野 (カンマ区切り)"
                  />
                  <div className="flex justify-end">
                    <button onClick={() => setStaff(prev => prev.filter((_, i) => i !== idx))} className="text-xs text-red-600">削除</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <button onClick={saveContent} className="px-4 py-2 rounded bg-blue-600 text-white shadow disabled:opacity-50" disabled={loadingDetail}>
            店舗情報を保存
          </button>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">空き枠</h2>
              <button onClick={addAvailabilityDay} className="border px-3 py-1 rounded text-sm">日付を追加</button>
            </div>
            <div className="space-y-4">
              {availability.map((day, dayIndex) => (
                <div
                  key={`${day.date}-${dayIndex}`}
                  className="border rounded-lg bg-white shadow-sm p-3 space-y-3"
                  data-testid="availability-day"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={day.date}
                      onChange={e => updateAvailabilityDate(dayIndex, e.target.value)}
                      className="border rounded px-3 py-2 text-sm"
                      data-testid="availability-date"
                    />
                    <button onClick={() => setAvailability(prev => prev.filter((_, idx) => idx !== dayIndex))} className="text-xs text-red-600">削除</button>
                  </div>
                  <div className="space-y-2">
                    {day.slots.map((slot, slotIndex) => (
                      <div
                        key={slotIndex}
                        className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto] items-center"
                        data-testid="availability-slot"
                      >
                        <input
                          type="datetime-local"
                          value={slot.start_at}
                          onChange={e => updateSlot(dayIndex, slotIndex, 'start_at', e.target.value)}
                          className="border rounded px-3 py-2 text-sm"
                          data-testid="slot-start"
                        />
                        <input
                          type="datetime-local"
                          value={slot.end_at}
                          onChange={e => updateSlot(dayIndex, slotIndex, 'end_at', e.target.value)}
                          className="border rounded px-3 py-2 text-sm"
                          data-testid="slot-end"
                        />
                        <select
                          value={slot.status}
                          onChange={e => updateSlot(dayIndex, slotIndex, 'status', e.target.value)}
                          className="border rounded px-3 py-2 text-sm"
                          data-testid="slot-status"
                        >
                          <option value="open">open</option>
                          <option value="tentative">tentative</option>
                          <option value="blocked">blocked</option>
                        </select>
                        <button onClick={() => removeSlot(dayIndex, slotIndex)} className="text-xs text-red-600">削除</button>
                      </div>
                    ))}
                    <button onClick={() => addSlot(dayIndex)} className="text-xs text-blue-600" data-testid="add-slot">枠を追加</button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => saveAvailability(day.date, day.slots)}
                      className="px-3 py-1 rounded bg-emerald-600 text-white text-sm"
                      data-testid="save-availability"
                    >
                      この日の空き枠を保存
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      </div>

      <ToastContainer toasts={toasts} onDismiss={remove} />
    </main>
  )
}
