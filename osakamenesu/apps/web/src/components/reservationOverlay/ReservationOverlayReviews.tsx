import type { TherapistHit } from '@/components/staff/TherapistCard'

type ReservationOverlayReviewsProps = {
  hit: TherapistHit
  reviewSummary: string
  specialties: string[]
  onOpenForm: () => void
}

export default function ReservationOverlayReviews({
  hit,
  reviewSummary,
  specialties,
  onOpenForm,
}: ReservationOverlayReviewsProps) {
  return (
    <div className="space-y-6 px-4 pb-6 text-sm text-neutral-text">
      <div className="rounded-[32px] bg-gradient-to-br from-[#f6f9ff] via-white to-white p-6 shadow-[0_24px_80px_rgba(37,99,235,0.16)] ring-1 ring-white/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-neutral-text">口コミハイライト</h3>
            <p className="text-xs text-neutral-textMuted">人気の理由をピックアップしました</p>
          </div>
          {hit.rating ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-3 py-1 text-[11px] font-semibold text-brand-primary">
              ★ {hit.rating.toFixed(1)}
              {hit.reviewCount ? (
                <span className="text-[10px] font-medium text-neutral-textMuted">/{hit.reviewCount}件</span>
              ) : null}
            </span>
          ) : null}
        </div>
        <p className="mt-4 leading-relaxed">{reviewSummary}</p>
        {specialties.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {specialties.map((tag) => (
              <span
                key={`review-${tag}`}
                className="inline-flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold text-brand-primary"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-[0_18px_60px_rgba(21,93,252,0.16)]">
        <h4 className="text-base font-semibold text-neutral-text">最近寄せられた声</h4>
        <ul className="mt-4 space-y-4 text-sm leading-relaxed text-neutral-text">
          <li>
            <span className="font-semibold text-brand-primaryDark">丁寧な対応:</span>{' '}
            施術中も細やかに声を掛けてくれて安心できたというコメントが多く寄せられています。
          </li>
          <li>
            <span className="font-semibold text-brand-primaryDark">技術力の高さ:</span>{' '}
            リンパケアやストレッチなど、複数の手技を組み合わせた施術が好評です。
          </li>
          <li>
            <span className="font-semibold text-brand-primaryDark">サロンの雰囲気:</span>{' '}
            ゆったりした音楽と照明でリラックスできたとの声が目立ちます。
          </li>
        </ul>
        <button
          type="button"
          onClick={onOpenForm}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(37,99,235,0.25)] transition hover:from-brand-primary/90 hover:to-brand-secondary/90"
        >
          予約フォームへ進む
        </button>
      </div>
    </div>
  )
}
