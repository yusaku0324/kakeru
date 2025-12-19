'use client'

import ReservationSelectedSlotsNotice from './reservation/ReservationSelectedSlotsNotice'
import ReservationPersonalInfoFields from './reservation/ReservationPersonalInfoFields'
import ReservationCourseSelector from './reservation/ReservationCourseSelector'
import ReservationNotesPreferences from './reservation/ReservationNotesPreferences'
import ReservationSubmissionDetails from './reservation/ReservationSubmissionDetails'
import { ConflictErrorBanner } from './reservation/ConflictErrorBanner'
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
    isVerifying,
    canSubmit,
    disabled,
    minutesOptions,
    toasts,
    removeToast,
    hasContactChannels,
    conflictError,
    dismissConflictError,
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
    <div className="space-y-5">
      <ConflictErrorBanner error={conflictError} onDismiss={dismissConflictError} />

      <ReservationSelectedSlotsNotice slots={props.selectedSlots} />

      {errors.desiredStart ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-red-50/50 px-4 py-3 text-xs font-medium text-red-600">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {errors.desiredStart}
        </div>
      ) : null}

      {profileNotice ? (
        <div className="flex items-center gap-2 rounded-2xl border border-brand-primary/30 bg-gradient-to-r from-brand-primary/10 to-brand-primary/5 px-4 py-3 text-xs font-medium text-brand-primary">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {profileNotice}
        </div>
      ) : null}

      <div className="grid gap-5">
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

      {/* Submit Button with enhanced styling */}
      <div className="relative pt-2">
        <div className="pointer-events-none absolute inset-x-0 -top-4 h-12 bg-gradient-to-t from-white/80 to-transparent" />
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className="group relative inline-flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-primary to-brand-secondary px-6 py-4 text-base font-bold text-white shadow-[0_12px_36px_rgba(37,99,235,0.35)] transition-all duration-300 hover:shadow-[0_16px_48px_rgba(37,99,235,0.45)] hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-[0_12px_36px_rgba(37,99,235,0.35)]"
        >
          {/* Animated background shine */}
          <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

          {isVerifying ? (
            <>
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>空き状況を確認中...</span>
            </>
          ) : isPending ? (
            <>
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>送信中...</span>
            </>
          ) : canSubmit ? (
            <>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>予約リクエストを送信</span>
              <svg className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </>
          ) : (
            <>
              <svg className="h-5 w-5 opacity-60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span>デモ環境では送信できません</span>
            </>
          )}
        </button>

        {canSubmit && (
          <p className="mt-3 text-center text-[10px] text-neutral-textMuted">
            送信後、店舗スタッフが確認次第ご連絡いたします
          </p>
        )}
      </div>
    </div>
  )
}
