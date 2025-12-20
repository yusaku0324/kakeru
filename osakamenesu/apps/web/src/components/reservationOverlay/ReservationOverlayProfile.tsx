import { ProfileTagList } from '@/components/staff/ProfileTagList'
import type { TherapistHit } from '@/components/staff/TherapistCard'

type ReservationOverlayProfileProps = {
  hit: TherapistHit
  summaryBio: string | null
  specialties: string[]
  detailItems: Array<{ label: string; value: string }>
  optionsList: string[]
  summarySchedule: string | null
  pricingItems: Array<{ title: string; duration: string | null; price: string | null }>
}

export default function ReservationOverlayProfile({
  hit,
  summaryBio,
  specialties,
  detailItems,
  optionsList,
  summarySchedule,
  pricingItems,
}: ReservationOverlayProfileProps) {
  return (
    <div className="space-y-6 px-4 pb-6 text-sm text-neutral-text">
      <div className="grid gap-6">
        <div className="rounded-[32px] bg-gradient-to-br from-[#e8f2ff] via-white to-white p-6 shadow-[0_24px_80px_rgba(37,99,235,0.18)] ring-1 ring-white/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-neutral-text">プロフィール</h3>
              <p className="text-xs text-neutral-textMuted">得意分野や基本情報をまとめています</p>
            </div>
            {hit.reviewCount ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-3 py-1 text-[11px] font-semibold text-brand-primary">
                <span aria-hidden="true">★</span> {hit.rating ? hit.rating.toFixed(1) : '--'} / {hit.reviewCount}件
              </span>
            ) : null}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 text-sm leading-relaxed text-neutral-text shadow-sm shadow-brand-primary/10">
                {summaryBio ?? 'プロフィール情報は順次掲載予定です。'}
              </div>
              {specialties.length ? (
                <div className="flex flex-wrap gap-2">
                  {specialties.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold text-brand-primary"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <ProfileTagList
                mood_tag={hit.mood_tag}
                style_tag={hit.style_tag}
                look_type={hit.look_type}
                contact_style={hit.contact_style}
                hobby_tags={hit.hobby_tags}
              />
            </div>
            {detailItems.length || optionsList.length ? (
              <div className="grid gap-3">
                {detailItems.map((item) => (
                  <div
                    key={`${item.label}-${item.value}`}
                    className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 text-sm font-semibold text-neutral-text shadow-sm shadow-brand-primary/10"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-textMuted">
                      {item.label}
                    </div>
                    <div className="mt-1 text-sm">{item.value}</div>
                  </div>
                ))}
                {optionsList.length ? (
                  <div className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 text-sm shadow-sm shadow-brand-primary/10">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-textMuted">
                      オプション・対応メニュー
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      {optionsList.map((option) => (
                        <span
                          key={`option-${option}`}
                          className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-3 py-1 font-semibold text-brand-primary"
                        >
                          <span aria-hidden="true">✦</span> {option}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[32px] bg-gradient-to-br from-white via-white to-[#f1f6ff] p-6 shadow-[0_18px_60px_rgba(37,99,235,0.16)] ring-1 ring-white/60">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
              出勤予定
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-text">
              {summarySchedule ?? '最新スケジュールはお問い合わせください。'}
            </p>
          </div>
          <div className="rounded-[32px] bg-gradient-to-br from-[#f5faff] via-white to-white p-6 shadow-[0_18px_60px_rgba(37,99,235,0.16)] ring-1 ring-white/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
                  コース料金
                </div>
                <p className="mt-1 text-[11px] text-neutral-textMuted">
                  サロンの代表的なコースをご覧ください
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-3 py-1 text-[11px] font-semibold text-brand-primary">
                料金の目安
              </span>
            </div>
            {pricingItems.length ? (
              <ul className="mt-4 space-y-3">
                {pricingItems.map(({ title, duration, price }, index) => (
                  <li
                    key={`${title}-${price ?? index}`}
                    className="flex items-center justify-between gap-3 rounded-[24px] bg-white/90 px-4 py-3 text-sm font-semibold text-neutral-text shadow-sm shadow-brand-primary/10"
                  >
                    <div className="space-y-0.5">
                      <div>{title}</div>
                      {duration ? (
                        <div className="text-xs font-medium text-neutral-textMuted">{duration}</div>
                      ) : null}
                    </div>
                    {price ? (
                      <div className="text-base font-semibold text-brand-primary">{price}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-neutral-textMuted">料金情報はお問い合わせください。</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
