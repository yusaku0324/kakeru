'use client'

import type { ReservationCourseOption } from './useReservationForm'

type ReservationCourseSelectorProps = {
  options: ReservationCourseOption[]
  selectedCourseId: string | null
  durationMinutes: number
  minutesOptions: number[]
  onSelectCourse: (courseId: string) => void
  onDurationChange: (minutes: number) => void
}

export default function ReservationCourseSelector({
  options,
  selectedCourseId,
  durationMinutes,
  minutesOptions,
  onSelectCourse,
  onDurationChange,
}: ReservationCourseSelectorProps) {
  if (options.length === 0) {
    return (
      <label className="space-y-2">
        <span className="text-sm font-semibold text-neutral-text">利用時間 *</span>
        <select
          value={durationMinutes}
          onChange={(event) => onDurationChange(Number(event.target.value))}
          className="w-full rounded-[24px] border border-white/60 bg-white/85 px-4 py-3 text-sm text-neutral-text shadow-sm transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
        >
          {minutesOptions.map((mins) => (
            <option key={mins} value={mins}>
              {mins}分
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-neutral-text">コースを選択 *</span>
        <span className="text-xs text-neutral-textMuted">料金は税込表示です</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((course) => {
          const isSelected = selectedCourseId === course.id
          const durationLabel = course.durationMinutes ? `${course.durationMinutes}分` : null
          return (
            <button
              key={course.id}
              type="button"
              onClick={() => onSelectCourse(course.id)}
              aria-pressed={isSelected}
              className={`w-full rounded-[28px] border px-4 py-4 text-left transition ${
                isSelected
                  ? 'border-brand-primary bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-[0_18px_50px_rgba(37,99,235,0.32)]'
                  : 'border-white/70 bg-white/90 text-neutral-text shadow-[0_12px_35px_rgba(21,93,252,0.12)] hover:border-brand-primary/40'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{course.label}</span>
                {course.priceLabel ? (
                  <span
                    className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-brand-primary'}`}
                  >
                    {course.priceLabel}
                  </span>
                ) : null}
              </div>
              {durationLabel ? (
                <div
                  className={`mt-2 text-xs ${isSelected ? 'text-white/80' : 'text-neutral-textMuted'}`}
                >
                  所要目安 {durationLabel}
                </div>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
