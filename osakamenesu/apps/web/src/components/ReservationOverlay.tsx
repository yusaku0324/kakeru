'use client'

import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useHeroImages } from '@/hooks/useHeroImages'
import { ReservationHeroCard } from '@/components/reservation'
import { type TherapistHit } from '@/components/staff/TherapistCard'
import { parsePricingText } from '@/utils/pricing'
import ReservationOverlayBooking from './reservationOverlay/ReservationOverlayBooking'
import ReservationOverlayProfile from './reservationOverlay/ReservationOverlayProfile'
import ReservationOverlayReviews from './reservationOverlay/ReservationOverlayReviews'
import { FALLBACK_STAFF_META, generateDefaultAvailability, injectDefaultStartSlot } from './reservationOverlay/data'
import type { ReservationContactItem } from '@/components/reservation'
import { useReservationOverlayState } from './reservationOverlay/useReservationOverlayState'
import {
  buildLineContactUrl,
  buildReservationContactItems,
} from './reservationOverlay/utils'

export type ReservationOverlayProps = {
  hit: TherapistHit
  onClose: () => void
  tel?: string | null
  lineId?: string | null
  defaultStart?: string | null
  defaultDurationMinutes?: number | null
  allowDemoSubmission?: boolean
  gallery?: string[] | null
  profileDetails?: Array<{ label: string; value: string }>
  profileBio?: string | null
  profileSchedule?: string | null
  profilePricing?: string | null
  profileOptions?: string[] | null
  availabilityDays?: Array<{
    date: string
    is_today?: boolean | null
    slots: Array<{ start_at: string; end_at: string; status: 'open' | 'tentative' | 'blocked' }>
  }> | null
  /** セラピストID（空き状況の再取得に使用） */
  therapistId?: string | null
}

type OverlayTab = 'profile' | 'reviews' | 'booking'

export default function ReservationOverlay({
  hit,
  onClose,
  tel = null,
  lineId = null,
  defaultStart,
  defaultDurationMinutes,
  allowDemoSubmission,
  gallery,
  profileDetails,
  profileBio,
  profileSchedule,
  profilePricing,
  profileOptions,
  availabilityDays,
  therapistId,
}: ReservationOverlayProps) {
  useBodyScrollLock(true)

  const [activeTab, setActiveTab] = useState<OverlayTab>('profile')
  const fallbackMeta = FALLBACK_STAFF_META[hit.name] ?? null

  // Use fallback availability from FALLBACK_STAFF_META, or default availability if not found
  // Always inject defaultStart to ensure the time shown on the card is available in the calendar
  const baseAvailability = fallbackMeta?.availability ?? generateDefaultAvailability()
  const fallbackAvailability = injectDefaultStartSlot(baseAvailability, defaultStart)

  const reservationState = useReservationOverlayState({
    availabilityDays,
    fallbackAvailability,
    defaultStart,
  })
  const { ensureSelection, openForm, closeForm, formOpen } = reservationState

  const { heroImages, heroIndex, showNextHero, showPrevHero } = useHeroImages({
    gallery,
    fallbackGallery: fallbackMeta?.gallery,
    avatar: hit.avatarUrl,
  })

  const specialties = useMemo(
    () => (Array.isArray(hit.specialties) ? hit.specialties.filter(Boolean).slice(0, 6) : []),
    [hit.specialties],
  )

  const contactItems = useMemo<ReservationContactItem[]>(
    () =>
      buildReservationContactItems({
        tel,
        lineId,
        telHref: tel ? `tel:${tel}` : null,
        lineHref: lineId ? buildLineContactUrl(lineId) : null,
      }),
    [lineId, tel],
  )

  const handleClose = useCallback(() => {
    closeForm()
    onClose()
  }, [closeForm, onClose])

  const tabs: Array<{ key: OverlayTab; label: string; helper?: string }> = [
    { key: 'profile', label: 'プロフィール' },
    { key: 'reviews', label: '口コミ' },
    { key: 'booking', label: '空き状況・予約', helper: '候補枠を最大3枠まで選択できます' },
  ]

  const detailItems = useMemo(() => {
    const base: Array<{ label: string; value: string }> = []
    const seen = new Set<string>()
    const append = (item?: { label: string; value: string }) => {
      if (!item?.label || !item.value || seen.has(item.label)) return
      seen.add(item.label)
      base.push(item)
    }
    const primary = Array.isArray(profileDetails) ? profileDetails : []
    const fallback = Array.isArray(fallbackMeta?.details) ? fallbackMeta.details : []
    primary.forEach((item) => append(item))
    fallback.forEach((item) => append(item))
    if (!seen.has('得意な施術') && specialties.length) {
      append({ label: '得意な施術', value: specialties.join(' / ') })
    }
    return base
  }, [profileDetails, fallbackMeta?.details, specialties])

  const reviewSummary = hit.reviewCount
    ? `口コミ ${hit.reviewCount}件のうち評価 ${hit.rating ? hit.rating.toFixed(1) : '---'}★`
    : '口コミデータの集計を準備中です。'

  const summaryBio = profileBio ?? fallbackMeta?.bio ?? hit.headline ?? null
  const summarySchedule = profileSchedule ?? fallbackMeta?.schedule ?? null
  const summaryPricing = profilePricing ?? fallbackMeta?.pricing ?? null
  const optionsList = useMemo(() => {
    const primary = Array.isArray(profileOptions) ? profileOptions.filter(Boolean) : []
    if (primary.length) return primary
    const fallback = Array.isArray(fallbackMeta?.options)
      ? fallbackMeta.options.filter(Boolean)
      : []
    return fallback
  }, [profileOptions, fallbackMeta?.options])

  const pricingSource = profilePricing ?? summaryPricing ?? ''
  const pricingItems = useMemo(() => parsePricingText(pricingSource), [pricingSource])

  const courseOptions = useMemo(
    () =>
      pricingItems.map((item, index) => ({
        id: `course-${index}`,
        label: [item.title, item.duration].filter(Boolean).join(' ').trim(),
        durationMinutes: item.durationMinutes ?? undefined,
        priceLabel: item.price ?? undefined,
      })),
    [pricingItems],
  )


  const handleOpenForm = useCallback(() => {
    setActiveTab('booking')
    openForm()
  }, [openForm, setActiveTab])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (formOpen) {
        closeForm()
      } else {
        handleClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeForm, formOpen, handleClose])

  return (
    <>
      <div className="fixed inset-0 z-[998] overflow-y-auto bg-neutral-950/45 backdrop-blur-sm">
        <div className="relative flex min-h-full items-center justify-center px-4 py-8 sm:px-6 sm:py-14 lg:py-16">
          <div className="absolute inset-0" onClick={handleClose} aria-hidden="true" />
          <div
            className="relative z-10 w-full max-w-5xl overflow-hidden rounded-[40px] border border-white/40 bg-white/55 shadow-[0_50px_150px_rgba(37,99,235,0.38)] backdrop-blur-[36px]"
            role="dialog"
            aria-modal="true"
            aria-label={`${hit.name}の予約詳細`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/90 text-neutral-text shadow-sm shadow-brand-primary/10 transition hover:border-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/40"
              aria-label="予約パネルを閉じる"
            >
              ✕
            </button>
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22)_0%,rgba(37,99,235,0)_65%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.18)_0%,rgba(96,165,250,0)_60%),linear-gradient(135deg,rgba(255,255,255,0.92)_0%,rgba(236,245,255,0.62)_45%,rgba(219,234,254,0.55)_100%)]" />

            <div className="flex max-h-[calc(100vh-8rem)] flex-col overflow-y-auto">
              <div className="w-full space-y-10 p-6 sm:p-8 lg:p-12">
                <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <ReservationHeroCard
                    name={hit.name}
                    images={heroImages}
                    activeIndex={heroIndex}
                    onPrev={showPrevHero}
                    onNext={showNextHero}
                    rating={hit.rating}
                    reviewCount={hit.reviewCount}
                  />

                  <div className="relative flex flex-col gap-5 overflow-hidden rounded-[36px] border border-white/50 bg-white/28 p-6 shadow-[0_32px_90px_rgba(21,93,252,0.28)] backdrop-blur-[26px]">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.22),transparent_58%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.2),transparent_55%),url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22%3E%3Cpath d=%22M0 47h1v1H0zM47 0h1v1h-1z%22 fill=%22%23ffffff29%22/%3E%3C/svg%3E')]" />
                    <div className="relative flex flex-col gap-5">
                      <div className="flex flex-col gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-primary">
                          WEB予約リクエスト
                        </span>
                        <div className="space-y-1">
                          <h2 className="text-2xl font-semibold text-neutral-text sm:text-3xl">
                            {hit.name}
                          </h2>
                          {hit.shopName ? (
                            <p className="text-sm text-neutral-textMuted">
                              {hit.shopAreaName || hit.shopArea || '掲載準備中'}・{hit.shopName}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[24px] border border-white/55 bg-white/45 p-3 text-xs text-neutral-text shadow-[0_16px_40px_rgba(21,93,252,0.22)] backdrop-blur-sm">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-textMuted">
                            評価
                          </div>
                          <div className="mt-1 text-sm font-semibold text-neutral-text">
                            {hit.rating ? `${hit.rating.toFixed(1)} / 5.0` : '準備中'}
                          </div>
                          {hit.reviewCount ? (
                            <div className="text-[11px] text-neutral-textMuted">
                              口コミ {hit.reviewCount}
                            </div>
                          ) : null}
                        </div>
                        <div className="rounded-[24px] border border-white/55 bg-white/45 p-3 text-xs text-neutral-text shadow-[0_16px_40px_rgba(21,93,252,0.22)] backdrop-blur-sm">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-textMuted">
                            出勤予定
                          </div>
                          <div className="mt-1 text-sm font-semibold text-neutral-text">
                            {summarySchedule ?? '確認中です。フォームからお問い合わせください。'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleOpenForm}
                        className="mt-auto inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(37,99,235,0.25)] transition hover:from-brand-primary/90 hover:to-brand-secondary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/40"
                      >
                        予約フォームを開く
                      </button>
                    </div>
                  </div>
                </section>

                <section className="space-y-6 rounded-[32px] border border-white/60 bg-white/92 p-1.5 shadow-[0_20px_70px_rgba(21,93,252,0.18)]">
                  <div className="flex flex-wrap items-center gap-2 rounded-[28px] bg-white/85 p-2">
                    {tabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab.key)
                          if (tab.key === 'booking') ensureSelection()
                        }}
                        className={clsx(
                          'flex-1 rounded-[24px] px-4 py-2 text-sm font-semibold transition sm:flex-none',
                          tab.key === activeTab
                            ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-[0_12px_35px_rgba(37,99,235,0.22)]'
                            : 'text-neutral-text hover:bg-white',
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {tabs.find((tab) => tab.key === activeTab)?.helper ? (
                    <p className="px-4 text-[11px] text-neutral-textMuted">
                      {tabs.find((tab) => tab.key === activeTab)?.helper}
                    </p>
                  ) : null}

                  {activeTab === 'profile' ? (
                    <ReservationOverlayProfile
                      hit={hit}
                      summaryBio={summaryBio}
                      specialties={specialties}
                      detailItems={detailItems}
                      optionsList={optionsList}
                      summarySchedule={summarySchedule}
                      pricingItems={pricingItems}
                    />
                  ) : null}

                  {activeTab === 'reviews' ? (
                    <ReservationOverlayReviews
                      hit={hit}
                      reviewSummary={reviewSummary}
                      specialties={specialties}
                      onOpenForm={handleOpenForm}
                    />
                  ) : null}

                  {activeTab === 'booking' ? (
                    <ReservationOverlayBooking
                      hit={hit}
                      tel={tel}
                      lineId={lineId}
                      defaultStart={defaultStart}
                      defaultDurationMinutes={defaultDurationMinutes}
                      allowDemoSubmission={allowDemoSubmission}
                      contactItems={contactItems}
                      courseOptions={courseOptions}
                      onOpenForm={handleOpenForm}
                      state={reservationState}
                      therapistId={therapistId ?? hit.therapistId ?? hit.staffId ?? null}
                    />
                  ) : null}
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>


    </>
  )
}
