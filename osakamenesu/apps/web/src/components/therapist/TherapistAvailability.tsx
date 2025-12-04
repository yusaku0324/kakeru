import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/Badge'
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react'

interface AvailabilitySlot {
  starts_at: string
  ends_at: string
  is_available: boolean
  rejected_reasons?: string[]
}

interface AvailabilityProps {
  availability: {
    slots: AvailabilitySlot[]
    phase: 'explore' | 'narrow' | 'book'
    window: {
      days: number
      slot_granularity_minutes: number
    }
  }
  therapistId: string
  shopSlug?: string
  onSelectSlot?: (slot: AvailabilitySlot) => void
}

export default function TherapistAvailability({
  availability,
  therapistId,
  shopSlug,
  onSelectSlot
}: AvailabilityProps) {
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [groupedSlots, setGroupedSlots] = useState<Record<string, AvailabilitySlot[]>>({})

  useEffect(() => {
    // Group slots by date
    const grouped: Record<string, AvailabilitySlot[]> = {}

    availability.slots.forEach(slot => {
      const date = new Date(slot.starts_at).toLocaleDateString('ja-JP')
      if (!grouped[date]) {
        grouped[date] = []
      }
      grouped[date].push(slot)
    })

    setGroupedSlots(grouped)

    // Set initial selected date
    const dates = Object.keys(grouped)
    if (dates.length > 0 && !selectedDate) {
      setSelectedDate(dates[0])
    }
  }, [availability.slots, selectedDate])

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const formatDateHeader = (dateString: string) => {
    const [year, month, day] = dateString.split('/')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const weekday = date.toLocaleDateString('ja-JP', { weekday: 'short' })
    return `${month}/${day} (${weekday})`
  }

  const getPhaseMessage = () => {
    switch (availability.phase) {
      case 'explore':
        return '空き状況を確認中です'
      case 'narrow':
        return '時間帯を選択してください'
      case 'book':
        return '予約可能な時間帯です'
      default:
        return ''
    }
  }

  const dates = Object.keys(groupedSlots)
  const currentDateIndex = dates.indexOf(selectedDate)

  return (
    <Card>
      <div className="p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">空き状況</h2>
          <p className="text-sm text-gray-600">{getPhaseMessage()}</p>
        </div>

        {/* Date selector */}
        {dates.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (currentDateIndex > 0) {
                    setSelectedDate(dates[currentDateIndex - 1])
                  }
                }}
                disabled={currentDateIndex === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="text-center">
                <div className="text-lg font-medium">
                  {formatDateHeader(selectedDate)}
                </div>
                <div className="text-xs text-gray-500">
                  {groupedSlots[selectedDate]?.filter(s => s.is_available).length || 0} 枠空き
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (currentDateIndex < dates.length - 1) {
                    setSelectedDate(dates[currentDateIndex + 1])
                  }
                }}
                disabled={currentDateIndex === dates.length - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Time slots grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {groupedSlots[selectedDate]?.map((slot, index) => (
                <Button
                  key={index}
                  variant={slot.is_available ? "outline" : "ghost"}
                  size="sm"
                  disabled={!slot.is_available}
                  onClick={() => slot.is_available && onSelectSlot?.(slot)}
                  className={`${
                    !slot.is_available ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTime(slot.starts_at)}
                </Button>
              ))}
            </div>

            {/* Date navigation */}
            <div className="mt-4 flex justify-center">
              <div className="flex gap-1">
                {dates.slice(0, 7).map((date, index) => (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`w-8 h-8 rounded-full text-xs ${
                      date === selectedDate
                        ? 'bg-primary text-white'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {date.split('/')[2]}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* No availability message */}
        {dates.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>現在、空き枠がありません</p>
          </div>
        )}

        {/* Additional info */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>表示期間: {availability.window.days}日間</span>
            <Badge variant="outline" className="text-xs">
              {availability.window.slot_granularity_minutes}分単位
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  )
}
