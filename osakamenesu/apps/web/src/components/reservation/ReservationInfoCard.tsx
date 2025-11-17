'use client'

import clsx from 'clsx'

export type ReservationDetailItem = {
  label: string
  value: string
}

export type ReservationContactItem = {
  key: string
  label: string
  value: string
  helper: string
  href?: string
}

type ReservationInfoCardProps = {
  name: string
  shopDisplayName?: string | null
  summaryBio: string | null
  summarySchedule: string | null
  summaryPricing: string | null
  optionsList: string[]
  specialties: string[]
  reviewSummary: string
  detailItems: ReservationDetailItem[]
  contactItems: ReservationContactItem[]
  onOpenForm: () => void
}

export function ReservationInfoCard({
  name,
  shopDisplayName,
  summaryBio,
  summarySchedule,
  summaryPricing,
  optionsList,
  specialties,
  reviewSummary,
  detailItems,
  contactItems,
  onOpenForm,
}: ReservationInfoCardProps) {
  return (
    <div className="relative flex flex-col gap-5 overflow-hidden rounded-[36px] border border-white/50 bg-white/28 p-6 shadow-[0_32px_90px_rgba(21,93,252,0.28)] backdrop-blur-[26px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.22),transparent_58%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.2),transparent_55%),url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22%3E%3Cpath d=%22M0 47h1v1H0zM47 0h1v1h-1z%22 fill=%22%23ffffff29%22/%3E%3C/svg%3E')]" />

      <div className="relative flex flex-col gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-primary">
          WEB予約リクエスト
        </span>
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-neutral-text sm:text-3xl">{name}</h2>
          {shopDisplayName ? (
            <p className="text-sm text-neutral-textMuted">{shopDisplayName}</p>
          ) : null}
        </div>
        <p className="text-[11px] font-medium text-neutral-textMuted">{reviewSummary}</p>
      </div>

      <div className="grid gap-6">
        <div className="rounded-[32px] bg-gradient-to-br from-[#e8f2ff] via-white to-white p-6 shadow-[0_24px_80px_rgba(37,99,235,0.18)] ring-1 ring-white/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-neutral-text">プロフィール</h3>
              <p className="text-xs text-neutral-textMuted">得意分野や基本情報をまとめています</p>
            </div>
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
            </div>
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
                        ✦ {option}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <InfoPanel
            title="出勤予定"
            body={summarySchedule ?? '最新スケジュールはお問い合わせください。'}
          />
          <InfoPanel
            title="コース料金"
            body={summaryPricing ?? '最新価格はフォームよりお問い合わせください。'}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {contactItems.map((item) => (
          <div
            key={item.key}
            className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 text-sm shadow-sm shadow-brand-primary/10"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-textMuted">
              <span>{item.label}</span>
              <span>{item.helper}</span>
            </div>
            {item.href ? (
              <a
                href={item.href}
                className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary underline-offset-2 hover:underline"
              >
                {item.value}
              </a>
            ) : (
              <div className="mt-2 text-sm font-semibold text-neutral-text">{item.value}</div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenForm}
        className="relative mt-2 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(37,99,235,0.25)] transition hover:from-brand-primary/90 hover:to-brand-secondary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/40"
      >
        予約フォームを開く
      </button>
    </div>
  )
}

function InfoPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[32px] bg-gradient-to-br from-white via-white to-[#f5f8ff] p-6 shadow-[0_18px_60px_rgba(37,99,235,0.16)] ring-1 ring-white/60">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-textMuted">
        {title}
      </div>
      <p className="mt-3 text-sm leading-6 text-neutral-text">{body}</p>
    </div>
  )
}
