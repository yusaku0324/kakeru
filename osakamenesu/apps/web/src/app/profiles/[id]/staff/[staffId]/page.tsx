import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import SafeImage from '@/components/SafeImage'
import ReservationForm from '@/components/ReservationForm'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Section } from '@/components/ui/Section'
import { TherapistSchedule } from '@/features/therapist/ui/TherapistSchedule'
import { fetchShop, type ShopDetail, type StaffSummary } from '../../page'
import { buildStaffIdentifier, staffMatchesIdentifier, slugifyStaffIdentifier } from '@/lib/staff'

function findStaff(shop: ShopDetail, staffId: string): StaffSummary | null {
  if (!staffId) return null
  const list = Array.isArray(shop.staff) ? shop.staff : []
  return list.find((member) => staffMatchesIdentifier(member, staffId)) || null
}

function buildShopHref(params: { id: string }) {
  return `/profiles/${params.id}`
}

function buildStaffHref(shopId: string, staff: StaffSummary) {
  const identifier = buildStaffIdentifier(staff, staff.id || staff.alias || staff.name || 'staff')
  return `/profiles/${shopId}/staff/${encodeURIComponent(identifier)}`
}

function listOtherStaff(shop: ShopDetail, currentId: string) {
  const list = Array.isArray(shop.staff) ? shop.staff : []
  return list.filter((member) => member.id !== currentId)
}

function formatSpecialties(list?: string[] | null) {
  return Array.isArray(list) ? list.filter(Boolean) : []
}

type StaffPageProps = {
  params: Promise<{ id: string; staffId: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const dayFormatter = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return dayFormatter.format(date)
}

function toTimeLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(11, 16)
  return date
    .toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(/^24:/, '00:')
}

function toDateTimeLocal(iso?: string | null) {
  if (!iso) return undefined
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return undefined
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}

function computeSlotDurationMinutes(startIso?: string | null, endIso?: string | null): number | undefined {
  if (!startIso || !endIso) return undefined
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined
  const diff = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
  return diff || undefined
}

function parseBooleanParam(value?: string | string[] | null): boolean {
  if (!value) return false
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return false
  const normalized = raw.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export async function generateMetadata({ params }: StaffPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const shop = await fetchShop(resolvedParams.id)
  const staff = findStaff(shop, resolvedParams.staffId)
  const title = staff ? `${staff.name}｜${shop.name}のセラピスト` : `${shop.name}｜セラピスト`
  const description = staff?.headline || `${shop.name}に在籍するセラピストのプロフィール`
  return { title, description }
}

export default async function StaffProfilePage({ params, searchParams }: StaffPageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const shop = await fetchShop(resolvedParams.id)
  const staff = findStaff(shop, resolvedParams.staffId)

  if (!staff) {
    notFound()
  }

  const allowDemoSubmission = parseBooleanParam(resolvedSearchParams?.force_demo_submit ?? null)

  const shopHref = buildShopHref(resolvedParams)
  const staffId = staff.id
  const specialties = formatSpecialties(staff.specialties)
  const ratingLabel = typeof staff.rating === 'number' ? `${staff.rating.toFixed(1)} / 5.0` : null
  const reviewLabel = typeof staff.review_count === 'number' ? `${staff.review_count}件のクチコミ` : null
  const contact = shop.contact || {}
  const otherStaff = listOtherStaff(shop, staff.id)
  const availabilityDays = Array.isArray(shop.availability_calendar?.days) ? shop.availability_calendar?.days ?? [] : []
  const normalizedStaffId = slugifyStaffIdentifier(staff.id) || slugifyStaffIdentifier(staff.alias) || slugifyStaffIdentifier(staff.name)
  const staffAvailability = availabilityDays
    .map((day) => ({
      date: day.date,
      is_today: day.is_today,
      slots: (day.slots || []).filter((slot) => {
        if (!normalizedStaffId) return false
        const slotIdSlug = slugifyStaffIdentifier(slot.staff_id)
        return slotIdSlug === normalizedStaffId
      }),
    }))
    .filter((day) => day.slots.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  const slotParamValue = (() => {
    if (!resolvedSearchParams) return undefined
    const value = resolvedSearchParams.slot
    if (Array.isArray(value)) return value[0]
    return value
  })()

  const weekParamValue = (() => {
    if (!resolvedSearchParams) return undefined
    const value = resolvedSearchParams.week
    if (Array.isArray(value)) return value[0]
    return value
  })()

  function startOfWeek(dateStr: string) {
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return dateStr
    const day = date.getDay() || 7
    if (day !== 1) {
      date.setHours(-24 * (day - 1))
    }
    const iso = date.toISOString().slice(0, 10)
    return iso
  }

  const weeksMap = new Map<string, typeof staffAvailability>()
  for (const entry of staffAvailability) {
    const key = startOfWeek(entry.date)
    if (!weeksMap.has(key)) {
      weeksMap.set(key, [])
    }
    weeksMap.get(key)!.push(entry)
  }

  const weekKeys = [...weeksMap.keys()].sort()
  const weeks = weekKeys.map((key) => ({ key, days: weeksMap.get(key)! }))

  const defaultWeekIndex = (() => {
    const today = new Date().toISOString().slice(0, 10)
    const weekKey = startOfWeek(today)
    const index = weeks.findIndex((w) => w.key === weekKey)
    return index >= 0 ? index : 0
  })()

  const requestedWeekIndex = (() => {
    if (!weekParamValue) return defaultWeekIndex
    const idx = Number.parseInt(weekParamValue, 10)
    if (Number.isNaN(idx)) return defaultWeekIndex
    return Math.min(Math.max(idx, 0), Math.max(weeks.length - 1, 0))
  })()

  const currentWeek = weeks[requestedWeekIndex] ?? { key: '', days: staffAvailability }
  const displayDays = currentWeek.days
  const hasWeekNavigation = weeks.length > 1
  const weekStartIso = currentWeek.key || displayDays[0]?.date || new Date().toISOString().slice(0, 10)
  const weekStartDate = new Date(weekStartIso)
  const todayIso = new Date().toISOString().slice(0, 10)
  const weekColumns = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(weekStartDate.getTime())
    date.setDate(weekStartDate.getDate() + index)
    const iso = date.toISOString().slice(0, 10)
    const match = displayDays.find((day) => day.date === iso)
    if (match) return match
    return {
      date: iso,
      is_today: iso === todayIso,
      slots: [],
    }
  })
  const currentWeekRangeLabel = weekColumns.length
    ? `${formatDayLabel(weekColumns[0].date)} 〜 ${formatDayLabel(weekColumns[weekColumns.length - 1].date)}`
    : null

  const upcomingDays = (() => {
    const availabilityMap = new Map(staffAvailability.map((day) => [day.date, day]))
    const baseDate = new Date()
    baseDate.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }).map((_, index) => {
      const target = new Date(baseDate.getTime())
      target.setDate(baseDate.getDate() + index)
      const iso = target.toISOString().slice(0, 10)
      const existing = availabilityMap.get(iso)
      return {
        date: iso,
        is_today: index === 0,
        slots: existing?.slots ?? [],
      }
    })
  })()

  const buildWeekHref = (index: number) => {
    const urlParams = new URLSearchParams()
    if (index > 0) urlParams.set('week', String(index))
    const search = urlParams.toString()
    return `${buildStaffHref(resolvedParams.id, staff)}${search ? `?${search}` : ''}`
  }

  const buildSlotHref = (slotIso: string) => {
    const urlParams = new URLSearchParams()
    const weekParam = requestedWeekIndex > 0 ? String(requestedWeekIndex) : undefined
    if (weekParam) urlParams.set('week', weekParam)
    urlParams.set('slot', slotIso)
    return `${buildStaffHref(resolvedParams.id, staff)}?${urlParams.toString()}#reserve`
  }

  const selectedSlotInfo = (() => {
    if (!slotParamValue) return null
    const target = Date.parse(slotParamValue)
    if (Number.isNaN(target)) return null
    for (const day of staffAvailability) {
      for (const slot of day.slots) {
        const start = Date.parse(slot.start_at)
        if (!Number.isNaN(start) && Math.abs(start - target) < 60_000) {
          return { day, slot }
        }
      }
    }
    return null
  })()

  const firstOpenSlotInfo = (() => {
    for (const day of staffAvailability) {
      const slot = day.slots.find((item) => item.status === 'open')
      if (slot) return { day, slot }
    }
    return null
  })()

  const chosenSlot = selectedSlotInfo ?? firstOpenSlotInfo
  const defaultSlotLocal = chosenSlot ? toDateTimeLocal(chosenSlot.slot.start_at) : undefined
  const defaultDurationMinutes = chosenSlot
    ? computeSlotDurationMinutes(chosenSlot.slot.start_at, chosenSlot.slot.end_at)
    : undefined
  const selectedSlotLabel = selectedSlotInfo
    ? `${formatDayLabel(selectedSlotInfo.day.date)} ${toTimeLabel(selectedSlotInfo.slot.start_at)}〜${toTimeLabel(selectedSlotInfo.slot.end_at)}`
    : null
  const slotStaffId = selectedSlotInfo?.slot.staff_id || staffId
  const slotStatusMap = {
    open: { label: '◎ 空きあり', className: 'text-state-successText' },
    tentative: { label: '△ 要確認', className: 'text-brand-primaryDark' },
    blocked: { label: '× 満席', className: 'text-neutral-textMuted' },
  } as const

  return (
    <main className="relative min-h-screen bg-neutral-surface">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(147,197,253,0.18),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(196,181,253,0.16),_transparent_50%)]" aria-hidden />
      <div className="relative mx-auto max-w-4xl space-y-6 px-4 py-10 lg:space-y-8">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <Link href={shopHref} className="text-xs font-semibold uppercase tracking-wide text-brand-primary hover:underline">
              {shop.name} に戻る
            </Link>
            <h1 className="text-3xl font-semibold text-neutral-text">{staff.name}</h1>
            {staff.alias ? <p className="text-sm text-neutral-textMuted">{staff.alias}</p> : null}
          </div>
          {ratingLabel ? (
            <div className="text-right text-sm text-neutral-text">
              <div className="font-semibold text-brand-primaryDark">評価 {ratingLabel}</div>
              {reviewLabel ? <div className="text-xs text-neutral-textMuted">{reviewLabel}</div> : null}
            </div>
          ) : null}
        </div>

        <TherapistSchedule
          days={upcomingDays}
          initialSlotIso={selectedSlotInfo?.slot.start_at ?? firstOpenSlotInfo?.slot.start_at}
        />

        <Section
          title="プロフィール"
          subtitle={staff.headline || `${staff.name}の施術スタイルとプロフィール情報`}
          className="border border-neutral-borderLight/70 bg-white/90 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/80"
        >
          <div className="grid gap-6 md:grid-cols-[minmax(0,260px)_1fr] md:items-start">
            <div className="overflow-hidden rounded-card border border-neutral-borderLight bg-neutral-surface">
              {staff.avatar_url ? (
                <SafeImage
                  src={staff.avatar_url}
                  alt={`${staff.name}の写真`}
                  width={480}
                  height={640}
                  className="h-full w-full object-cover"
                  fallbackSrc="/images/placeholder-avatar.svg"
                />
              ) : (
                <div className="flex h-full min-h-[320px] items-center justify-center bg-neutral-surfaceAlt text-3xl font-semibold text-neutral-textMuted">
                  {staff.name.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="space-y-5">
              {specialties.length ? (
                <div className="flex flex-wrap gap-2">
                  {specialties.map((tag) => (
                    <Chip key={tag} variant="accent" className="text-xs">
                      {tag}
                    </Chip>
                  ))}
                </div>
              ) : null}
              {staff.headline ? (
                <p className="text-sm leading-relaxed text-neutral-text">{staff.headline}</p>
              ) : null}

              <Card className="space-y-3 border-neutral-borderLight/80 bg-neutral-surfaceAlt/80 p-4" as="div">
                <h2 className="text-sm font-semibold text-neutral-text">お問い合わせ・予約</h2>
                <div className="flex flex-wrap gap-2 text-xs">
                  {contact.phone ? <Badge variant="outline">電話 {contact.phone}</Badge> : null}
                  {contact.line_id ? <Badge variant="outline">LINE {contact.line_id}</Badge> : null}
                  {contact.reservation_form_url ? (
                    <a
                      href={contact.reservation_form_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-badge border border-brand-primary/40 px-3 py-1 font-semibold text-brand-primaryDark transition hover:border-brand-primary"
                    >
                      公式予約フォーム
                    </a>
                  ) : null}
                  {contact.website_url ? (
                    <a
                      href={contact.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-badge border border-neutral-borderLight px-3 py-1 font-semibold text-neutral-text transition hover:border-brand-primary hover:text-brand-primary"
                    >
                      公式サイトを見る
                    </a>
                  ) : null}
                </div>
                <p className="text-xs text-neutral-textMuted">
                  店舗からの折り返しで予約が確定します。空き枠は変動するため、最新情報は直接お問い合わせください。
                </p>
                <Link
                  href={`${shopHref}#reserve`}
                  className="inline-flex w-fit items-center gap-2 rounded-badge bg-brand-primary px-3 py-1 text-xs font-semibold text-white transition hover:bg-brand-primary/90"
                >
                  予約フォームへ進む
                </Link>
              </Card>
            </div>
          </div>
        </Section>

        {weekColumns.length ? (
          <details className="rounded-section border border-neutral-borderLight/70 bg-white/90 p-4 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-neutral-text">
              <span>詳細な週別スケジュールを見る</span>
              <span className="text-xs font-normal text-neutral-textMuted">週ごとのリストを表示</span>
            </summary>
            <div className="mt-4 space-y-4 text-sm text-neutral-text">
              <p className="text-xs text-neutral-textMuted">表示枠は店舗提供情報に基づきます。</p>
              {hasWeekNavigation && currentWeekRangeLabel ? (
                <div className="flex items-center justify-between text-xs text-neutral-text">
                  <div className="font-semibold">{currentWeekRangeLabel}</div>
                  <div className="flex gap-2">
                    {requestedWeekIndex > 0 ? (
                      <Link
                        href={buildWeekHref(requestedWeekIndex - 1)}
                        className="rounded-badge border border-neutral-borderLight px-3 py-1 transition hover:border-brand-primary hover:text-brand-primary"
                      >
                        前の週
                      </Link>
                    ) : (
                      <span className="rounded-badge border border-neutral-borderLight/60 px-3 py-1 text-neutral-textMuted/70">前の週</span>
                    )}
                    {requestedWeekIndex < weeks.length - 1 ? (
                      <Link
                        href={buildWeekHref(requestedWeekIndex + 1)}
                        className="rounded-badge border border-neutral-borderLight px-3 py-1 transition hover:border-brand-primary hover:text-brand-primary"
                      >
                        次の週
                      </Link>
                    ) : (
                      <span className="rounded-badge border border-neutral-borderLight/60 px-3 py-1 text-neutral-textMuted/70">次の週</span>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
                {weekColumns.map((day) => (
                  <Card key={day.date} className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-neutral-text">{formatDayLabel(day.date)}</div>
                      {(day.is_today || day.date === todayIso) ? <Badge variant="brand">本日</Badge> : null}
                    </div>
                    <div className="space-y-2 text-sm text-neutral-text">
                      {day.slots.map((slot, idx) => {
                        const display = slotStatusMap[slot.status]
                        const isSelected = selectedSlotInfo?.slot.start_at === slot.start_at
                        return (
                          <Link
                            key={`${slot.start_at}-${idx}`}
                            href={buildSlotHref(slot.start_at)}
                            className={`flex items-center justify-between gap-3 rounded-card border px-3 py-2 transition hover:border-brand-primary hover:bg-brand-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                              isSelected
                                ? 'border-brand-primary bg-brand-primary/10 text-brand-primaryDark'
                                : 'border-neutral-borderLight/70 bg-neutral-surfaceAlt text-neutral-text'
                            }`}
                          >
                            <span>
                              {toTimeLabel(slot.start_at)}〜{toTimeLabel(slot.end_at)}
                            </span>
                            <span className={`text-xs font-semibold ${display.className}`}>{display.label}</span>
                          </Link>
                        )
                      })}
                      {day.slots.length === 0 ? (
                        <div className="rounded-card border border-dashed border-neutral-borderLight/70 bg-white/60 px-3 py-6 text-center text-[11px] text-neutral-textMuted">
                          公開された枠はありません
                        </div>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </details>
        ) : null}

        <Card id="reserve" className="space-y-3 border border-neutral-borderLight/70 bg-white/95 p-5 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-neutral-text">WEB予約リクエスト</div>
            <p className="text-xs leading-relaxed text-neutral-textMuted">
              希望枠を送信すると店舗担当者が折り返しご連絡します。返信をもって予約成立となります。
            </p>
          </div>
          {selectedSlotLabel ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-brand-primary/30 bg-brand-primary/5 px-3 py-2 text-xs text-brand-primaryDark">
              <span>選択中の枠: {selectedSlotLabel}</span>
              <Link
                href={buildWeekHref(requestedWeekIndex)}
                className="font-semibold text-brand-primary hover:underline"
              >
                クリア
              </Link>
            </div>
          ) : null}
          <ReservationForm
            shopId={shop.id}
            defaultStart={defaultSlotLocal}
            defaultDurationMinutes={defaultDurationMinutes}
            staffId={slotStaffId}
            tel={contact.phone || null}
            lineId={contact.line_id || null}
            shopName={shop.name}
            allowDemoSubmission={allowDemoSubmission}
          />
        </Card>

        {otherStaff.length ? (
          <Section
            title="他の在籍セラピスト"
            subtitle="気になるセラピストをチェック"
            className="border border-neutral-borderLight/70 bg-white/90 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/80"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {otherStaff.map((member) => (
                <Link
                  key={member.id}
                  href={buildStaffHref(resolvedParams.id, member)}
                  className="flex items-center gap-3 rounded-card border border-neutral-borderLight/70 bg-neutral-surfaceAlt/60 p-3 transition hover:border-brand-primary"
                >
                  <div className="relative h-16 w-16 overflow-hidden rounded-full bg-neutral-surface">
                    <SafeImage
                      src={member.avatar_url || undefined}
                      alt={`${member.name}の写真`}
                      fill
                      className="object-cover"
                      fallbackSrc="/images/placeholder-avatar.svg"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-neutral-text">{member.name}</div>
                    {member.specialties?.length ? (
                      <div className="text-xs text-neutral-textMuted">
                        {member.specialties.slice(0, 2).join(' / ')}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-xs text-brand-primary">詳細 →</span>
                </Link>
              ))}
            </div>
          </Section>
        ) : null}

        <Link
          href="#reserve"
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-primary/30 transition hover:bg-brand-primary/90 md:hidden"
        >
          今すぐ予約する
          <span aria-hidden>→</span>
        </Link>
      </div>
    </main>
  )
}
