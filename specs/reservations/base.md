# Reservations Base Spec

Scope: guest-facing booking flow and store/staff operations at a high level. Kept lightweight so per-issue diffs can extend it.

## Guest reservation flow (current)
- Discover/search: guests browse shops/therapists, filter by area/date/time/course, and view open slots.
- Slot selection: from search results or profile pages, guests pick a therapist and time window shown as available.
- Confirmation: guests provide contact/basic info (or use existing session), review price/course, and submit to create a reservation.
- Follow-up: guests can revisit reservation details and cancel when allowed; cancellations respect shop policy windows.

## Store / therapist operations (current)
- Shift/availability setup: shops register therapist shifts and open/blocked slots so availability can be computed.
- Reservation oversight: staff dashboards list upcoming bookings, allow manual creation/adjustment, and record cancellations.
- Notifications: shops/therapists receive booking/cancel alerts through configured channels (email/LINE/slack) to act on changes.

## Core endpoints / UI entry points (current, high level)
- Availability lookup (e.g., list open slots for shop/therapist/date) used by search and profile pages.
- Reservation creation endpoint backing the “reserve/confirm” UI flow.
- Reservation detail/cancel endpoints to fetch status and perform guest-initiated cancellation.
- Admin/store tools to manage shifts and bookings (manual add/edit/cancel) surfaced in dashboard UIs.

## Notes
- This base spec is intentionally coarse: consult diff specs under `specs/reservations/diffs/` for per-issue changes.
- Matching/tag-driven ranking lives in the matching domain; reservations focus on availability, booking, and lifecycle states.
