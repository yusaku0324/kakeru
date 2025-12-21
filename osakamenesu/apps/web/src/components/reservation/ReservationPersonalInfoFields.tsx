'use client'

import type { ReservationFormErrors, ReservationFormState } from './useReservationForm'

type ReservationPersonalInfoFieldsProps = {
  form: ReservationFormState
  errors: ReservationFormErrors
  onChange: <K extends keyof ReservationFormState>(key: K, value: ReservationFormState[K]) => void
  inputClass: (hasError: boolean) => string
}

export default function ReservationPersonalInfoFields({
  form,
  errors,
  onChange,
  inputClass,
}: ReservationPersonalInfoFieldsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-2">
        <span className="text-sm font-semibold text-neutral-text">お名前 *</span>
        <input
          id="reservation-name"
          value={form.name}
          onChange={(event) => onChange('name', event.target.value)}
          className={inputClass(Boolean(errors.name))}
          placeholder="例: 山田 太郎"
          required
          autoFocus
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'reservation-name-error' : undefined}
        />
        {errors.name ? (
          <p id="reservation-name-error" className="flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600">
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {errors.name}
          </p>
        ) : null}
      </label>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-neutral-text">お電話番号 *</span>
        <input
          id="reservation-phone"
          type="tel"
          value={form.phone}
          onChange={(event) => onChange('phone', event.target.value)}
          className={inputClass(Boolean(errors.phone))}
          placeholder="090-1234-5678"
          required
          autoComplete="tel"
          inputMode="tel"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? 'reservation-phone-error' : undefined}
        />
        {errors.phone ? (
          <p id="reservation-phone-error" className="flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600">
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {errors.phone}
          </p>
        ) : null}
      </label>

      <label className="space-y-2 md:col-span-2">
        <span className="text-sm font-semibold text-neutral-text">メールアドレス</span>
        <input
          id="reservation-email"
          value={form.email}
          onChange={(event) => onChange('email', event.target.value)}
          className={inputClass(Boolean(errors.email))}
          placeholder="example@mail.com"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'reservation-email-error' : undefined}
        />
        {errors.email ? (
          <p id="reservation-email-error" className="flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600">
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {errors.email}
          </p>
        ) : null}
      </label>
    </div>
  )
}
