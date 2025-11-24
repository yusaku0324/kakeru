import type { ReservationSelectedSlot } from './useReservationForm'

type ReservationSelectedSlotsNoticeProps = {
  slots?: ReservationSelectedSlot[]
}

export default function ReservationSelectedSlotsNotice({
  slots,
}: ReservationSelectedSlotsNoticeProps) {
  if (!slots?.length) return null

  return (
    <div className="rounded-[20px] border border-brand-primary/30 bg-brand-primary/5 px-4 py-3 text-sm text-brand-primary">
      <div className="text-xs font-semibold">フォーム送信時に以下の候補枠を店舗へ共有します</div>
      <ul className="mt-2 space-y-1 text-xs">
        {slots.map((slot, index) => {
          const start = new Date(slot.startAt)
          const end = new Date(slot.endAt)
          return (
            <li key={slot.startAt}>
              {index + 1}.{' '}
              {start.toLocaleDateString('ja-JP', {
                month: 'numeric',
                day: 'numeric',
                weekday: 'short',
              })}{' '}
              {start.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}
              〜
              {end.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}
              （{slot.status === 'open' ? '即予約可' : '要確認'}）
            </li>
          )
        })}
      </ul>
    </div>
  )
}
