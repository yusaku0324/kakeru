# Sample Spec — Therapist Home

## Intent
- Validate the therapist-facing home shows today’s work and bookings.
- Keep this as a sample for Spec Kit; not wired to runtime yet.

## Actors
- Therapist (authenticated)

## Preconditions
- Therapist user/session exists.
- At least one reservation for the therapist today (JST).
- At least one shift/availability entry for today (JST), or a synthetic shift is produced.

## Flow
1. User opens `/app/therapist/home`.
2. App calls `/api/therapist/home-summary`.
3. Response includes:
   - `today` (JST window)
   - `reservations[]` for today
   - `shifts[]` for today (availability or synthetic)
4. UI renders:
   - “今日の予約” list with ≥1 entry.
   - “今日の出勤予定” list with ≥1 entry.

## Acceptance
- Page renders without 401/500.
- Today window is JST 00:00–23:59 (UTC-converted for queries).
- `primary_provider` optional; no lazy-load required.
- Synthetic shift acceptable when reservations exist but no slots match.
