import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeekAvailabilityGrid } from '../WeekAvailabilityGrid'
import type { AvailabilityDay, CalendarTime, AvailabilityStatus } from '../types'

/**
 * WeekAvailabilityGrid コンポーネントのUI表示テスト
 *
 * 検証内容:
 * - status値に対して正しいアイコン（◎/×/△）が表示されるか
 * - data-testid属性が正しく設定されるか
 */

const mockTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tokyo',
})

// Use a far future date to avoid booking deadline filtering
const FUTURE_DATE = '2099-12-15'
const FUTURE_DATE_LABEL = '12/15(月)'

const createMockDays = (statuses: AvailabilityStatus[]): AvailabilityDay[] => {
  const slots = statuses.map((status, index) => ({
    start_at: `${FUTURE_DATE}T${10 + index}:00:00+09:00`,
    end_at: `${FUTURE_DATE}T${11 + index}:00:00+09:00`,
    status,
    timeKey: `${10 + index}:00`,
  }))

  return [
    {
      date: FUTURE_DATE,
      label: FUTURE_DATE_LABEL,
      isToday: false,
      slots,
    },
  ]
}

const createMockTimeline = (count: number): CalendarTime[] => {
  return Array.from({ length: count }, (_, i) => ({
    key: `${10 + i}:00`,
    label: `${10 + i}:00`,
  }))
}

describe('WeekAvailabilityGrid - Status Icon Rendering', () => {
  it('open status のスロットに ◎ アイコンが表示される', () => {
    const days = createMockDays(['open'])
    const timeline = createMockTimeline(1)

    render(
      <WeekAvailabilityGrid
        days={days}
        timeline={timeline}
        selected={[]}
        onToggle={vi.fn()}
        timeFormatter={mockTimeFormatter}
      />
    )

    // ◎ アイコンが表示されていることを確認
    expect(screen.getByText('◎')).toBeInTheDocument()
    // slot-available testid が存在
    expect(screen.getByTestId('slot-available')).toBeInTheDocument()
  })

  it('blocked status のスロットに × アイコンが表示される', () => {
    const days = createMockDays(['blocked'])
    const timeline = createMockTimeline(1)

    render(
      <WeekAvailabilityGrid
        days={days}
        timeline={timeline}
        selected={[]}
        onToggle={vi.fn()}
        timeFormatter={mockTimeFormatter}
      />
    )

    // × アイコンが表示されていることを確認
    expect(screen.getByText('×')).toBeInTheDocument()
    // slot-blocked testid が存在
    expect(screen.getByTestId('slot-blocked')).toBeInTheDocument()
  })

  it('tentative status のスロットに △ アイコンが表示される', () => {
    const days = createMockDays(['tentative'])
    const timeline = createMockTimeline(1)

    render(
      <WeekAvailabilityGrid
        days={days}
        timeline={timeline}
        selected={[]}
        onToggle={vi.fn()}
        timeFormatter={mockTimeFormatter}
      />
    )

    // △ アイコンが表示されていることを確認
    expect(screen.getByText('△')).toBeInTheDocument()
    // slot-pending testid が存在
    expect(screen.getByTestId('slot-pending')).toBeInTheDocument()
  })

  it('複数statusが混在する場合、それぞれ正しいアイコンが表示される', () => {
    const days = createMockDays(['open', 'blocked', 'tentative'])
    const timeline = createMockTimeline(3)

    render(
      <WeekAvailabilityGrid
        days={days}
        timeline={timeline}
        selected={[]}
        onToggle={vi.fn()}
        timeFormatter={mockTimeFormatter}
      />
    )

    // 全てのアイコンが表示されている
    expect(screen.getByText('◎')).toBeInTheDocument()
    expect(screen.getByText('×')).toBeInTheDocument()
    expect(screen.getByText('△')).toBeInTheDocument()

    // testidの数を確認
    expect(screen.getByTestId('slot-available')).toBeInTheDocument()
    expect(screen.getByTestId('slot-blocked')).toBeInTheDocument()
    expect(screen.getByTestId('slot-pending')).toBeInTheDocument()
  })
})

describe('WeekAvailabilityGrid - data-testid Attributes', () => {
  it('open スロットは data-testid="slot-available" を持つ', () => {
    const days = createMockDays(['open'])
    const timeline = createMockTimeline(1)

    render(
      <WeekAvailabilityGrid
        days={days}
        timeline={timeline}
        selected={[]}
        onToggle={vi.fn()}
        timeFormatter={mockTimeFormatter}
      />
    )

    const slot = screen.getByTestId('slot-available')
    expect(slot).toBeInTheDocument()
    expect(slot.tagName).toBe('BUTTON') // クリック可能
  })

  it('blocked スロットは data-testid="slot-blocked" を持つ', () => {
    const days = createMockDays(['blocked'])
    const timeline = createMockTimeline(1)

    render(
      <WeekAvailabilityGrid
        days={days}
        timeline={timeline}
        selected={[]}
        onToggle={vi.fn()}
        timeFormatter={mockTimeFormatter}
      />
    )

    const slot = screen.getByTestId('slot-blocked')
    expect(slot).toBeInTheDocument()
    expect(slot.tagName).toBe('DIV') // クリック不可
  })

  it('tentative スロットは data-testid="slot-pending" を持つ', () => {
    const days = createMockDays(['tentative'])
    const timeline = createMockTimeline(1)

    render(
      <WeekAvailabilityGrid
        days={days}
        timeline={timeline}
        selected={[]}
        onToggle={vi.fn()}
        timeFormatter={mockTimeFormatter}
      />
    )

    const slot = screen.getByTestId('slot-pending')
    expect(slot).toBeInTheDocument()
    expect(slot.tagName).toBe('BUTTON') // クリック可能
  })
})

describe('WeekAvailabilityGrid - Accessibility', () => {
  it('open スロットに適切なaria-labelが設定される', () => {
    const days = createMockDays(['open'])
    const timeline = createMockTimeline(1)

    render(
      <WeekAvailabilityGrid
        days={days}
        timeline={timeline}
        selected={[]}
        onToggle={vi.fn()}
        timeFormatter={mockTimeFormatter}
      />
    )

    const slot = screen.getByTestId('slot-available')
    const ariaLabel = slot.getAttribute('aria-label')
    expect(ariaLabel).toContain('◎')
    expect(ariaLabel).toContain('予約可')
  })

  it('blocked スロットに予約不可のsr-onlyテキストがある', () => {
    const days = createMockDays(['blocked'])
    const timeline = createMockTimeline(1)

    render(
      <WeekAvailabilityGrid
        days={days}
        timeline={timeline}
        selected={[]}
        onToggle={vi.fn()}
        timeFormatter={mockTimeFormatter}
      />
    )

    // sr-only クラスの要素に「予約不可」テキストがある
    expect(screen.getByText(/予約不可です/)).toBeInTheDocument()
  })
})
