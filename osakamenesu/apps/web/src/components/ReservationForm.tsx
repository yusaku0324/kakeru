'use client'

import ReservationSelectedSlotsNotice from './reservation/ReservationSelectedSlotsNotice'
import ReservationPersonalInfoFields from './reservation/ReservationPersonalInfoFields'
import ReservationCourseSelector from './reservation/ReservationCourseSelector'
import ReservationNotesPreferences from './reservation/ReservationNotesPreferences'
import ReservationSubmissionDetails from './reservation/ReservationSubmissionDetails'
import {
  useReservationForm,
  type UseReservationFormProps,
  type ReservationFormState,
} from './reservation/useReservationForm'
import { ToastContainer } from './useToast'

type ReservationFormProps = UseReservationFormProps

type FieldChangeHandler = <K extends keyof ReservationFormState>(
  key: K,
  value: ReservationFormState[K],
) => void

export default function ReservationForm(props: ReservationFormProps) {
  const normalizedCourseOptions = props.courseOptions ?? []
  const hookProps = { ...props, courseOptions: normalizedCourseOptions }
  const {
    form,
    errors,
    rememberProfile,
    profileNotice,
    contactCount,
    lastSuccess,
    lastReservationId,
    lastPayload,
    summaryText,
    isPending,
    canSubmit,
    disabled,
    minutesOptions,
    toasts,
    removeToast,
    hasContactChannels,
    actions: { handleChange, toggleRemember, handleCourseSelect, submit, copySummary },
  } = useReservationForm(hookProps)

  const inputBaseClass =
    'w-full rounded-full bg-white/85 px-4 py-3 text-sm text-neutral-text shadow-sm transition focus:outline-none'
  const inputClass = (hasError: boolean) =>
    `${inputBaseClass} ${
      hasError
        ? 'border border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200/70'
        : 'border border-white/60 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30'
    }`

  return (
    <div className="space-y-6">
      <ReservationSelectedSlotsNotice slots={props.selectedSlots} />

      {errors.desiredStart ? (
        <div className="rounded-[18px] border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-600">
          {errors.desiredStart}
        </div>
      ) : null}

      {profileNotice ? (
        <div className="rounded-[18px] border border-brand-primary/40 bg-brand-primary/10 px-4 py-2 text-xs text-brand-primary">
          {profileNotice}
        </div>
      ) : null}

      <div className="grid gap-4">
        <ReservationPersonalInfoFields
          form={form}
          errors={errors}
          onChange={handleChange as FieldChangeHandler}
          inputClass={inputClass}
        />

        <ReservationCourseSelector
          options={normalizedCourseOptions}
          selectedCourseId={form.courseId}
          durationMinutes={form.durationMinutes}
          minutesOptions={minutesOptions}
          onSelectCourse={handleCourseSelect}
          onDurationChange={(value) => handleChange('durationMinutes', value)}
        />

        <ReservationNotesPreferences
          notes={form.notes}
          marketingOptIn={form.marketingOptIn}
          rememberProfile={rememberProfile}
          onChange={handleChange as FieldChangeHandler}
          onToggleRemember={toggleRemember}
        />
      </div>

      <ReservationSubmissionDetails
        contactCount={contactCount}
        lastSuccess={lastSuccess}
        lastReservationId={lastReservationId}
        shopId={props.shopId}
        tel={props.tel}
        lineId={props.lineId}
        shopName={props.shopName}
        lastPayload={lastPayload}
        summaryText={summaryText}
        copySummary={copySummary}
        canSubmit={canSubmit}
        hasContactChannels={hasContactChannels}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <button
        type="button"
        onClick={submit}
        disabled={disabled}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-primary/30 transition hover:from-brand-primary/90 hover:to-brand-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden>📮</span>
        {isPending ? '送信中…' : canSubmit ? '予約リクエストを送信' : 'デモ環境では送信できません'}
      </button>
    </div>
  )
}
