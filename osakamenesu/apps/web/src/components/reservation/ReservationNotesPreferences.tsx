'use client'

import type { ReservationFormState } from './useReservationForm'

type ReservationNotesPreferencesProps = {
  notes: string
  marketingOptIn: boolean
  rememberProfile: boolean
  onChange: <K extends keyof ReservationFormState>(key: K, value: ReservationFormState[K]) => void
  onToggleRemember: (checked: boolean) => void
}

export default function ReservationNotesPreferences({
  notes,
  marketingOptIn,
  rememberProfile,
  onChange,
  onToggleRemember,
}: ReservationNotesPreferencesProps) {
  return (
    <>
      <label className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-neutral-text">ご要望・指名など</span>
          <span className="text-xs text-neutral-textMuted">任意</span>
        </div>
        <textarea
          value={notes}
          onChange={(event) => onChange('notes', event.target.value)}
          className="w-full rounded-[24px] border border-white/60 bg-white/85 px-4 py-3 text-sm text-neutral-text shadow-sm transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          rows={3}
          placeholder="指名やオプションの希望などがあればご記入ください"
        />
      </label>

      <div className="flex flex-col gap-3 text-xs text-neutral-text">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={rememberProfile}
            onChange={(event) => onToggleRemember(event.target.checked)}
            className="h-4 w-4 accent-brand-primary"
          />
          次回のために連絡先情報を保存する
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(event) => onChange('marketingOptIn', event.target.checked)}
            className="h-4 w-4 accent-brand-primary"
          />
          お得な情報をメールで受け取る（任意）
        </label>
      </div>
    </>
  )
}
