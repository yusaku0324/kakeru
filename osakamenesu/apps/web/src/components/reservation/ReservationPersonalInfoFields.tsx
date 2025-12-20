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
          <p id="reservation-name-error" className="text-xs text-red-500">
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
          <p id="reservation-phone-error" className="text-xs text-red-500">
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
          <p id="reservation-email-error" className="text-xs text-red-500">
            {errors.email}
          </p>
        ) : null}
      </label>
    </div>
  )
}
