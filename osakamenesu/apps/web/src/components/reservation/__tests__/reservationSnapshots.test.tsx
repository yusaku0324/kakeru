import { render } from '@testing-library/react'
import type { Dispatch, SetStateAction } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  ReservationBookingSection,
  ReservationInfoCard,
  RESERVATION_STATUS_BADGE_CLASSES,
  type NormalizedDay,
  type ReservationContactItem,
} from '@/components/reservation'
import { getJaFormatter } from '@/utils/date'

const sampleContactItems: ReservationContactItem[] = [
  { key: 'tel', label: '電話予約', value: 'TEL 0120-123-456', helper: '24時間受付' },
  { key: 'line', label: 'LINE相談', value: 'ID salon-line', helper: '空き状況の確認に' },
]

const dayFormatter = getJaFormatter('day')
const timeFormatter = getJaFormatter('time')

const noopSetFormTab: Dispatch<SetStateAction<'schedule' | 'info'>> = () => undefined
const noopSetSchedulePage: Dispatch<SetStateAction<number>> = () => undefined

const timeline = [
  { key: '10:00', label: '10:00' },
  { key: '11:00', label: '11:00' },
  { key: '12:00', label: '12:00' },
]

const availabilityDays: NormalizedDay[] = [
  {
    date: '2024-11-10',
    label: '11/10(日)',
    isToday: true,
    slots: [
      {
        start_at: '2024-11-10T10:00:00+09:00',
        end_at: '2024-11-10T11:00:00+09:00',
        status: 'open',
        timeKey: '10:00',
      },
      {
        start_at: '2024-11-10T11:00:00+09:00',
        end_at: '2024-11-10T12:00:00+09:00',
        status: 'tentative',
        timeKey: '11:00',
      },
    ],
  },
]

describe('reservation UI snapshots', () => {
  it('renders ReservationInfoCard consistently', () => {
    const { container } = render(
      <ReservationInfoCard
        name="凛花 れい"
        shopDisplayName="梅田 / Re salon"
        summaryBio="透明感のある癒し施術が得意です。"
        summarySchedule="11時〜翌3時で受付"
        summaryPricing="60分 14,000円〜（指名料別）"
        optionsList={['オイルケア', 'ヘッドスパ']}
        specialties={['ヘッド', 'ホットストーン']}
        reviewSummary="口コミ 23件 / 評価 4.9★"
        detailItems={[
          { label: '経験年数', value: '3年' },
          { label: '得意エリア', value: '梅田・心斎橋' },
        ]}
        contactItems={sampleContactItems}
        onOpenForm={vi.fn()}
      />,
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders ReservationBookingSection layout for dashboard reuse', () => {
    const { container } = render(
      <ReservationBookingSection
        currentScheduleDays={availabilityDays}
        timeline={timeline}
        selectedSlots={[
          {
            startAt: '2024-11-10T10:00:00+09:00',
            endAt: '2024-11-10T11:00:00+09:00',
            date: '2024-11-10',
            status: 'open',
          },
        ]}
        dayFormatter={dayFormatter}
        timeFormatter={timeFormatter}
        statusBadgeClasses={RESERVATION_STATUS_BADGE_CLASSES}
        scheduleRangeLabel="11/10(日)〜11/16(土)"
        schedulePage={0}
        schedulePageCount={2}
        hasAvailability
        formTab="schedule"
        setFormTab={noopSetFormTab}
        setSchedulePage={noopSetSchedulePage}
        onToggleSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onEnsureSelection={() => []}
        variant="inline"
      />,
    )

    expect(container.firstChild).toMatchSnapshot()
  })
})
