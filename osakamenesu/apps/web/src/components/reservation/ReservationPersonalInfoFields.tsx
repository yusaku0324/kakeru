'use client'

import type { ReservationFormErrors, ReservationFormState } from './useReservationForm'

type ReservationPersonalInfoFieldsProps = {
  form: ReservationFormState
  errors: ReservationFormErrors
  onChange: <K extends keyof ReservationFormState>(key: K, value: ReservationFormState[K]) => void
  inputClass: (hasError: boolean) => string
}

// Validation check functions
function isValidName(name: string): boolean {
  return name.trim().length >= 1 && name.trim().length <= 80
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[-\s]/g, '')
  return /^\d{10,13}$/.test(digits)
}

function isValidEmail(email: string): boolean {
  if (!email) return false // Empty is not "valid" (just optional)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function ValidationCheckmark() {
  return (
    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" aria-hidden="true">
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </span>
  )
}

export default function ReservationPersonalInfoFields({
  form,
  errors,
  onChange,
  inputClass,
}: ReservationPersonalInfoFieldsProps) {
  const nameValid = isValidName(form.name) && !errors.name
  const phoneValid = isValidPhone(form.phone) && !errors.phone
  const emailValid = isValidEmail(form.email) && !errors.email

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-2">
        <span className="text-sm font-semibold text-neutral-text">お名前 *</span>
        <div className="relative">
          <input
            id="reservation-name"
            value={form.name}
            onChange={(event) => onChange('name', event.target.value)}
            className={`${inputClass(Boolean(errors.name))} ${nameValid ? 'pr-10' : ''}`}
            placeholder="例: 山田 太郎"
            required
            autoFocus
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'reservation-name-error' : undefined}
          />
          {nameValid && <ValidationCheckmark />}
        </div>
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
        <div className="relative">
          <input
            id="reservation-phone"
            type="tel"
            value={form.phone}
            onChange={(event) => onChange('phone', event.target.value)}
            className={`${inputClass(Boolean(errors.phone))} ${phoneValid ? 'pr-10' : ''}`}
            placeholder="090-1234-5678"
            required
            autoComplete="tel"
            inputMode="tel"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'reservation-phone-error' : undefined}
          />
          {phoneValid && <ValidationCheckmark />}
        </div>
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
        <div className="relative">
          <input
            id="reservation-email"
            value={form.email}
            onChange={(event) => onChange('email', event.target.value)}
            className={`${inputClass(Boolean(errors.email))} ${emailValid ? 'pr-10' : ''}`}
            placeholder="example@mail.com"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'reservation-email-error' : undefined}
          />
          {emailValid && <ValidationCheckmark />}
        </div>
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
