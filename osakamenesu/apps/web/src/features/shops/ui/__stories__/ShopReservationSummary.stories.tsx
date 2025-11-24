'use client'

import { useState } from 'react'

import { ShopReservationSummary } from '@/features/shops/ui/ShopReservationSummary'
import type { AvailabilityDay } from '@/features/shops/model'

const INITIAL_AVAILABILITY = [
  {
    date: '2024-12-24',
    slots: [
      { start_at: '2024-12-24T10:00', end_at: '2024-12-24T11:00', status: 'open' as const },
      { start_at: '2024-12-24T13:00', end_at: '2024-12-24T14:00', status: 'tentative' as const },
    ],
  },
] satisfies AvailabilityDay[]

function ShopReservationSummaryPreview() {
  const [availability, setAvailability] = useState<AvailabilityDay[]>(INITIAL_AVAILABILITY)

  const updateSlots = (
    dayIndex: number,
    slotIndex: number,
    key: 'start_at' | 'end_at' | 'status',
    value: string,
  ) => {
    setAvailability((prev) =>
      prev.map((day, idx) =>
        idx === dayIndex
          ? {
              ...day,
              slots: day.slots.map((slot, sIdx) =>
                sIdx === slotIndex ? { ...slot, [key]: value } : slot,
              ),
            }
          : day,
      ),
    )
  }

  return (
    <ShopReservationSummary
      availability={availability}
      onAddDay={() =>
        setAvailability((prev) => [
          ...prev,
          { date: new Date().toISOString().slice(0, 10), slots: [] },
        ])
      }
      onDeleteDay={(index) => setAvailability((prev) => prev.filter((_, idx) => idx !== index))}
      onUpdateDate={(index, value) =>
        setAvailability((prev) =>
          prev.map((day, idx) => (idx === index ? { ...day, date: value } : day)),
        )
      }
      onAddSlot={(index) =>
        setAvailability((prev) =>
          prev.map((day, idx) =>
            idx === index
              ? {
                  ...day,
                  slots: [...day.slots, { start_at: '', end_at: '', status: 'open' as const }],
                }
              : day,
          ),
        )
      }
      onUpdateSlot={updateSlots}
      onRemoveSlot={(dayIndex, slotIndex) =>
        setAvailability((prev) =>
          prev.map((day, idx) =>
            idx === dayIndex
              ? { ...day, slots: day.slots.filter((_, sIdx) => sIdx !== slotIndex) }
              : day,
          ),
        )
      }
      onSaveDay={(date, slots) => {
        console.info('[story] save day', { date, slots })
        return Promise.resolve(true)
      }}
    />
  )
}

const meta = {
  title: 'Features/Shops/ShopReservationSummary',
  component: ShopReservationSummary,
  parameters: {
    layout: 'centered',
  },
}

export default meta

export const Default = {
  render: () => <ShopReservationSummaryPreview />,
}
