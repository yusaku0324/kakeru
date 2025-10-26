import Image from 'next/image'
import { notFound } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Metadata } from 'next'
import { createHash } from 'crypto'
import Gallery from '@/components/Gallery'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Section } from '@/components/ui/Section'
import ShopReviews from '@/components/ShopReviews'
import { buildApiUrl, resolveApiBases } from '@/lib/api'
import { SAMPLE_SHOPS, type SampleShop } from '@/lib/sampleShops'

type Props = { params: { id: string }; searchParams?: Record<string, string | string[] | undefined> }

type MediaImage = { url: string; kind?: string | null; caption?: string | null }
type Contact = {
  phone?: string | null
  line_id?: string | null
  website_url?: string | null
  reservation_form_url?: string | null
  sns?: Array<{ platform: string; url: string; label?: string | null }> | null
}
type MenuItem = {
  id: string
  name: string
  description?: string | null
  duration_minutes?: number | null
  price: number
  currency?: string | null
  is_reservable_online?: boolean | null
  tags?: string[] | null
}
type Promotion = {
  label: string
  description?: string | null
  expires_at?: string | null
  highlight?: string | null
}
export type StaffSummary = {
  id: string
  name: string
  alias?: string | null
  avatar_url?: string | null
  headline?: string | null
  rating?: number | null
  review_count?: number | null
  specialties?: string[] | null
}
type AvailabilitySlot = { start_at: string; end_at: string; status: 'open' | 'tentative' | 'blocked'; staff_id?: string | null; menu_id?: string | null }
type AvailabilityDay = { date: string; is_today?: boolean | null; slots: AvailabilitySlot[] }
type AvailabilityCalendar = { shop_id: string; generated_at: string; days: AvailabilityDay[] }
type ReviewAspectKey = 'therapist_service' | 'staff_response' | 'room_cleanliness'
type ReviewAspect = { score: number; note?: string | null }
type ReviewAspects = Partial<Record<ReviewAspectKey, ReviewAspect>>
type HighlightedReview = {
  review_id?: string | null
  title: string
  body: string
  score: number
  visited_at?: string | null
  author_alias?: string | null
  aspects?: ReviewAspects | null
}
type ReviewSummary = {
  average_score?: number | null
  review_count?: number | null
  highlighted?: HighlightedReview[] | null
  aspect_averages?: Partial<Record<ReviewAspectKey, number>> | null
  aspect_counts?: Partial<Record<ReviewAspectKey, number>> | null
}
type DiaryEntry = {
  id?: string | null
  title?: string | null
  body: string
  photos?: string[] | null
  hashtags?: string[] | null
  published_at?: string | null
}

export type ShopDetail = {
  id: string
  slug?: string | null
  name: string
  area: string
  area_name?: string | null
  min_price: number
  max_price: number
  description?: string | null
  catch_copy?: string | null
  photos?: MediaImage[] | null
  contact?: Contact | null
  menus?: MenuItem[] | null
  staff?: StaffSummary[] | null
  availability_calendar?: AvailabilityCalendar | null
  badges?: string[] | null
  today_available?: boolean | null
  service_tags?: string[] | null
  metadata?: Record<string, unknown> | null
  store_name?: string | null
  promotions?: Promotion[] | null
  ranking_reason?: string | null
  reviews?: ReviewSummary | null
  diary_count?: number | null
  has_diaries?: boolean | null
  diaries?: DiaryEntry[] | null
}

async function fetchShop(id: string): Promise<ShopDetail> {
  const targets = resolveApiBases()
  const endpoint = `/api/v1/shops/${id}`

  for (const base of targets) {
    try {
      const r = await fetch(buildApiUrl(base, endpoint), { cache: 'no-store' })
      if (r.ok) return (await r.json()) as ShopDetail
      if (r.status === 404) continue
    } catch (error) {
      // try next base
    }
  }

  const fallback = SAMPLE_SHOPS.find((shop) => shop.id === id || shop.slug === id)
  if (fallback) return convertSampleShop(fallback)

  notFound()
}

function uuidFromString(input: string): string {
  const hash = createHash('sha1').update(input).digest('hex')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
}

function convertSampleShop(sample: SampleShop): ShopDetail {
  const staff = (sample.staff || []).map((member, index) => {
    const sourceId = member.id || `${sample.id}-staff-${index}`
    return {
      id: sourceId,
      name: member.name,
      alias: member.alias ?? null,
      avatar_url: member.avatar_url ?? null,
      headline: member.headline ?? null,
      rating: member.rating ?? null,
      review_count: member.review_count ?? null,
      specialties: member.specialties ?? null,
    }
  })

  const staffIdMap = new Map<string, string>()
  staff.forEach((member, index) => {
    const sourceId = sample.staff?.[index]?.id || `${sample.id}-staff-${index}`
    staffIdMap.set(sourceId, member.id)
  })

  const availability_calendar = sample.availability_calendar
    ? {
        shop_id: sample.id,
        generated_at: sample.availability_calendar.generated_at,
        days: sample.availability_calendar.days.map((day) => ({
          date: day.date,
          is_today: day.is_today ?? null,
          slots: day.slots.map((slot) => ({
            start_at: slot.start_at,
            end_at: slot.end_at,
            status: slot.status,
            staff_id: slot.staff_id ? staffIdMap.get(slot.staff_id) || slot.staff_id : null,
            menu_id: slot.menu_id ?? null,
          })),
        })),
      }
    : null

  return {
    id: sample.id,
    slug: sample.slug ?? sample.id,
    name: sample.name,
    area: sample.area,
    area_name: sample.area_name ?? null,
    min_price: sample.min_price,
    max_price: sample.max_price,
    description: sample.description ?? null,
    catch_copy: sample.catch_copy ?? null,
    photos: sample.photos?.map((photo) => ({ url: photo.url })) ?? null,
    contact: sample.contact ?? null,
    menus: sample.menus?.map((menu, index) => ({
      id: menu.id || uuidFromString(`menu:${sample.id}:${index}`),
      name: menu.name,
      description: menu.description ?? null,
      duration_minutes: menu.duration_minutes ?? null,
      price: menu.price,
      currency: 'JPY',
      is_reservable_online: true,
      tags: menu.tags ?? null,
    })) ?? null,
    staff,
    availability_calendar,
    badges: sample.badges ?? null,
    today_available: sample.today_available ?? null,
    service_tags: sample.service_tags ?? null,
    metadata: sample.metadata ?? null,
    store_name: sample.store_name ?? null,
    promotions: sample.promotions ?? null,
    ranking_reason: sample.ranking_reason ?? null,
    reviews: sample.reviews ?? null,
    diary_count: sample.diary_count ?? null,
    has_diaries: sample.has_diaries ?? null,
    diaries: sample.diaries ?? null,
  }
}

const formatYen = (n: number) => `¥${Number(n).toLocaleString('ja-JP')}`
const dayFormatter = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })

function uniquePhotos(photos?: MediaImage[] | null): string[] {
  if (!Array.isArray(photos)) return []
  const seen = new Set<string>()
  const urls: string[] = []
  for (const img of photos) {
    if (img?.url && !seen.has(img.url)) {
      urls.push(img.url)
      seen.add(img.url)
    }
  }
  return urls
}

function shorten(text?: string | null, max = 160): string | undefined {
  if (!text) return undefined
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function parseBooleanParam(value?: string | string[] | null): boolean {
  if (!value) return false
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return false
  const normalized = raw.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

const ReservationForm = dynamic(() => import('@/components/ReservationForm'), { ssr: false })

function toDateTimeLocal(iso?: string | null) {
  if (!iso) return undefined
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return undefined
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
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

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return dayFormatter.format(date)
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const shop = await fetchShop(params.id)
  const photos = uniquePhotos(shop.photos)
  const badges = shop.badges || []
  const contact = shop.contact || {}
  const phone = contact.phone || null
  const lineId = contact.line_id || null
  const menus = Array.isArray(shop.menus) ? shop.menus : []
  const staff = Array.isArray(shop.staff) ? shop.staff : []
  const availability = shop.availability_calendar?.days || []
  const slotParamValue = (() => {
    if (!searchParams) return undefined
    const value = searchParams.slot
    if (Array.isArray(value)) return value[0]
    return value
  })()
  const diaries = Array.isArray(shop.diaries) ? shop.diaries : []
  const selectedSlot = (() => {
    if (!slotParamValue) return null
    const target = Date.parse(slotParamValue)
    if (Number.isNaN(target)) return null
    for (const day of availability) {
      if (!day?.slots) continue
      for (const slot of day.slots) {
        const start = Date.parse(slot.start_at)
        if (!Number.isNaN(start) && Math.abs(start - target) < 60_000) {
          return slot
        }
      }
    }
    return null
  })()

  const forceReviewsFetch = parseBooleanParam(searchParams?.force_reviews ?? null)
  const allowDemoSubmission = parseBooleanParam(searchParams?.force_demo_submit ?? null)

  const firstOpenSlot = (() => {
    for (const day of availability) {
      if (!day?.slots) continue
      const openSlot = day.slots.find((slot) => slot.status === 'open')
      if (openSlot) return openSlot
    }
    return null
  })()

  const defaultSlotLocal = (() => {
    const slot = selectedSlot || firstOpenSlot
    return slot ? toDateTimeLocal(slot.start_at) : undefined
  })()

  const defaultDurationMinutes = (() => {
    const slot = selectedSlot || firstOpenSlot
    if (!slot) return undefined
    const start = new Date(slot.start_at)
    const end = new Date(slot.end_at)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined
    const diff = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
    return diff || undefined
  })()

  const availabilityUpdatedLabel = shop.availability_calendar?.generated_at
    ? formatDayLabel(shop.availability_calendar.generated_at)
    : null

  const contactLinks = [
    contact.phone ? { label: `TEL: ${contact.phone}`, href: `tel:${contact.phone}` } : null,
    contact.reservation_form_url
      ? { label: 'WEB予約フォーム', href: contact.reservation_form_url, external: true }
      : null,
    contact.website_url
      ? { label: '公式サイトを見る', href: contact.website_url, external: true }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string; external?: boolean }>

  const slotStatusMap: Record<AvailabilitySlot['status'], { label: string; className: string }> = {
    open: { label: '◎ 空きあり', className: 'text-state-successText' },
    tentative: { label: '△ 要確認', className: 'text-brand-primaryDark' },
    blocked: { label: '× 満席', className: 'text-neutral-textMuted' },
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 pb-24">
      <section className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <Card className="overflow-hidden p-0">
          {photos.length > 0 ? (
            <Gallery photos={photos} altBase={shop.name} />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center bg-neutral-surfaceAlt text-neutral-textMuted">
              画像準備中
            </div>
          )}
        </Card>
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-wide text-neutral-textMuted">
              <span>{shop.area_name || shop.area}</span>
              {shop.store_name ? (
                <span className="rounded-badge bg-neutral-surfaceAlt px-2 py-0.5 text-[11px] text-neutral-text">
                  {shop.store_name}
                </span>
              ) : null}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-text">{shop.name}</h1>
            {shop.catch_copy ? (
              <p className="text-sm leading-relaxed text-neutral-textMuted">{shop.catch_copy}</p>
            ) : null}
            {badges.length ? (
              <div className="flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <Badge key={badge} variant="brand">
                    {badge}
                  </Badge>
                ))}
              </div>
            ) : null}
            {shop.service_tags?.length ? (
              <div className="flex flex-wrap gap-2">
                {shop.service_tags.slice(0, 6).map((tag) => (
                  <Chip key={tag} variant="neutral">
                    {tag}
                  </Chip>
                ))}
              </div>
            ) : null}
            {shop.ranking_reason ? (
              <p className="text-xs text-brand-primaryDark">{shop.ranking_reason}</p>
            ) : null}
          </div>

          <Card className="space-y-2 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-textMuted">
              料金目安 (60分)
            </div>
            <div className="text-2xl font-semibold text-brand-primaryDark">
              {formatYen(shop.min_price)}{' '}
              <span className="text-sm text-neutral-textMuted">〜 {formatYen(shop.max_price)}</span>
            </div>
            <p className="text-xs leading-relaxed text-neutral-textMuted">
              表示料金は掲載時点の目安です。最新の割引や延長料金は直接店舗へお問い合わせください。
            </p>
          </Card>

          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-neutral-text">お問い合わせ</div>
              {shop.today_available ? <Badge variant="success">本日空きあり</Badge> : null}
            </div>
            <div className="space-y-2 text-sm text-neutral-text">
              {contactLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center gap-1 text-brand-primaryDark underline-offset-2 hover:underline"
                >
                  {item.label}
                </a>
              ))}
              {contact.line_id ? (
                <div>
                  LINE:{' '}
                  <span className="rounded-badge bg-neutral-surfaceAlt px-2 py-0.5 font-mono text-[12px] text-neutral-text">
                    {contact.line_id}
                  </span>
                </div>
              ) : null}
              {!contactLinks.length && !contact.line_id ? (
                <p className="text-xs text-neutral-textMuted">店舗への直接連絡先は掲載準備中です。</p>
              ) : null}
            </div>
            {contact.sns?.length ? (
              <div className="flex flex-wrap gap-2 text-sm">
                {contact.sns.map((sns) => (
                  <a
                    key={sns.url}
                    href={sns.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-badge border border-brand-primary/20 bg-brand-primary/10 px-2 py-0.5 text-[12px] font-medium text-brand-primaryDark hover:bg-brand-primary/15"
                  >
                    {sns.label || sns.platform}
                  </a>
                ))}
              </div>
            ) : null}
          </Card>

          {Array.isArray(shop.promotions) && shop.promotions.length ? (
            <Card className="space-y-3 p-4">
              <div className="text-sm font-semibold text-neutral-text">キャンペーン / 特典</div>
              <ul className="space-y-2 text-sm text-neutral-text">
                {shop.promotions.slice(0, 3).map((promo, index) => (
                  <li key={`${promo.label}-${index}`} className="rounded-card border border-brand-primary/20 bg-brand-primary/5 p-3">
                    <div className="font-semibold text-brand-primaryDark">{promo.label}</div>
                    {promo.description ? (
                      <p className="text-xs text-neutral-textMuted">{promo.description}</p>
                    ) : null}
                    {promo.expires_at ? (
                      <p className="text-[11px] text-neutral-textMuted mt-1">終了予定: {promo.expires_at}</p>
                    ) : null}
                    {promo.highlight ? (
                      <Badge variant="outline" className="mt-2">
                        {promo.highlight}
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {diaries.length ? (
            <Section
              title="写メ日記"
              subtitle={shop.diary_count ? `公開 ${shop.diary_count}件` : undefined}
              className="shadow-none border border-neutral-borderLight bg-neutral-surface"
            >
              <div className="grid gap-3 md:grid-cols-2">
                {diaries.slice(0, 4).map((diary, idx) => (
                  <Card key={diary.id ?? idx} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-neutral-text">{diary.title || '写メ日記'}</div>
                        {diary.published_at ? (
                          <span className="text-[11px] text-neutral-textMuted">{formatDayLabel(diary.published_at)}</span>
                        ) : null}
                      </div>
                      {diary.photos?.length ? (
                        <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-neutral-surfaceAlt">
                          <Image
                            src={diary.photos[0]}
                            alt={diary.title || '写メ日記'}
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className="object-cover"
                          />
                        </div>
                      ) : null}
                      <p className="text-sm leading-relaxed text-neutral-textMuted whitespace-pre-line">
                        {shorten(diary.body, 180)}
                      </p>
                      {diary.hashtags?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {diary.hashtags.slice(0, 6).map((tag) => (
                            <Chip key={tag} variant="neutral" className="text-[11px]">
                              #{tag}
                            </Chip>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            </Section>
          ) : null}

          <Card className="space-y-3 p-4">
            <div className="text-sm font-semibold text-neutral-text">WEB予約リクエスト</div>
            <p className="text-xs leading-relaxed text-neutral-textMuted">
              送信内容をもとに担当者が折り返しご連絡します。返信をもって予約成立となります。
            </p>
            <ReservationForm
              shopId={shop.id}
              defaultStart={defaultSlotLocal}
              defaultDurationMinutes={defaultDurationMinutes}
              staffId={selectedSlot?.staff_id ?? undefined}
              tel={phone}
              lineId={lineId}
              shopName={shop.name}
              allowDemoSubmission={allowDemoSubmission}
            />
          </Card>
        </div>
      </section>

      {(shop.description || shop.catch_copy) ? (
        <Section
          title="店舗紹介"
          subtitle={shop.catch_copy && shop.description ? shop.catch_copy : undefined}
          className="shadow-none border border-neutral-borderLight bg-neutral-surface"
        >
          {shop.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-text">{shop.description}</p>
          ) : (
            <p className="text-sm text-neutral-textMuted">{shop.catch_copy}</p>
          )}
        </Section>
      ) : null}

      {shop.reviews ? (
        <Section
          title="口コミ"
          subtitle={shop.reviews.review_count ? `公開件数 ${shop.reviews.review_count}件` : undefined}
          className="shadow-none border border-neutral-borderLight bg-neutral-surface"
          actions={shop.reviews.average_score ? <Badge variant="brand">平均 {shop.reviews.average_score.toFixed(1)}★</Badge> : undefined}
        >
          <ShopReviews shopId={shop.id} summary={shop.reviews} forceRemoteFetch={forceReviewsFetch} />
        </Section>
      ) : null}

      {menus.length ? (
        <Section
          title="メニュー"
          subtitle="編集部が確認した代表的なコースと料金"
          className="shadow-none border border-neutral-borderLight bg-neutral-surface"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {menus.map((menu) => (
              <Card key={menu.id} className="space-y-3 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-base font-semibold text-neutral-text">{menu.name}</div>
                  <div className="text-sm font-medium text-brand-primaryDark">{formatYen(menu.price)}</div>
                </div>
                {menu.duration_minutes ? (
                  <div className="text-xs text-neutral-textMuted">所要時間: 約{menu.duration_minutes}分</div>
                ) : null}
                {menu.description ? (
                  <p className="text-sm leading-relaxed text-neutral-textMuted">{shorten(menu.description, 140)}</p>
                ) : null}
                {menu.tags?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {menu.tags.map((tag) => (
                      <Chip key={tag} variant="subtle">
                        {tag}
                      </Chip>
                    ))}
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      {staff.length ? (
        <Section
          title="在籍スタッフ"
          subtitle="プロフィールは取材または店舗提供の最新情報です"
          className="shadow-none border border-neutral-borderLight bg-neutral-surface"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {staff.map((member) => (
              <Card key={member.id} className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  {member.avatar_url ? (
                    <Image
                      src={member.avatar_url}
                      alt={`${member.name}の写真`}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-surfaceAlt text-xs text-neutral-textMuted">
                      NO PHOTO
                    </div>
                  )}
                  <div>
                    <div className="text-base font-semibold text-neutral-text">{member.name}</div>
                    {member.alias ? (
                      <div className="text-xs text-neutral-textMuted">{member.alias}</div>
                    ) : null}
                    {member.rating ? (
                      <div className="mt-1 flex items-center gap-2 text-xs text-neutral-textMuted">
                        <Badge variant="outline">{member.rating.toFixed(1)}★</Badge>
                        {member.review_count ? <span>({member.review_count}件)</span> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                {member.headline ? (
                  <p className="text-sm leading-relaxed text-neutral-textMuted">{shorten(member.headline, 120)}</p>
                ) : null}
                {member.specialties?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {member.specialties.slice(0, 6).map((tag) => (
                      <Chip key={tag} variant="subtle">
                        {tag}
                      </Chip>
                    ))}
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      {availability.length ? (
        <Section
          title="出勤・空き状況"
          subtitle={
            availabilityUpdatedLabel
              ? `最終更新: ${availabilityUpdatedLabel}`
              : '最新の出勤枠は店舗提供情報に基づきます'
          }
          className="shadow-none border border-neutral-borderLight bg-neutral-surface"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {availability.slice(0, 4).map((day) => (
              <Card key={day.date} className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-neutral-text">{formatDayLabel(day.date)}</div>
                  {day.is_today ? <Badge variant="brand">本日</Badge> : null}
                </div>
                {day.slots?.length ? (
                  <ul className="space-y-2 text-sm text-neutral-text">
                    {day.slots.slice(0, 4).map((slot, idx) => {
                      const display = slotStatusMap[slot.status]
                      return (
                        <li
                          key={`${slot.start_at}-${idx}`}
                          className="flex items-center justify-between gap-3 rounded-card border border-neutral-borderLight/70 bg-neutral-surfaceAlt px-3 py-2"
                        >
                          <span>
                            {toTimeLabel(slot.start_at)}〜{toTimeLabel(slot.end_at)}
                          </span>
                          <span className={`text-xs font-semibold ${display.className}`}>{display.label}</span>
                        </li>
                      )
                    })}
                    {day.slots.length > 4 ? (
                      <li className="text-xs text-neutral-textMuted">他にも空き枠があります。店舗までお問い合わせください。</li>
                    ) : null}
                  </ul>
                ) : (
                  <div className="text-xs text-neutral-textMuted">公開された出勤枠はありません。</div>
                )}
              </Card>
            ))}
          </div>
        </Section>
      ) : null}
    </main>
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shop = await fetchShop(params.id)
  const title = `${shop.name} - 大阪メンエス.com`
  const descParts = [shop.area, `${formatYen(shop.min_price)}〜${formatYen(shop.max_price)}`]
  if (shop.catch_copy) descParts.unshift(shop.catch_copy)
  if (shop.store_name) descParts.unshift(shop.store_name)
  if (shop.description) descParts.push(shorten(shop.description, 120) || '')
  const description = descParts.filter(Boolean).join(' / ')
  const images = uniquePhotos(shop.photos).slice(0, 1)
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images,
    },
  }
}

export { fetchShop }
