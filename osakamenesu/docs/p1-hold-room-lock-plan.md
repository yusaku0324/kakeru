# P1 plan: holds (TTL) / room_count / DB locking

This document is **planning-only**. It captures current behavior and a minimal vertical-slice plan for P1.

## Current state (facts)

### Reservation statuses

- Shop-side reservation status:
  - Defined in `osakamenesu/services/api/app/enums.py` (`ReservationStatusLiteral`)
  - Values: `pending`, `confirmed`, `declined`, `cancelled`, `expired`
- Guest reservation status:
  - Defined in `osakamenesu/services/api/app/enums.py` (`GuestReservationStatusLiteral`)
  - Values: `draft`, `pending`, `confirmed`, `cancelled`, `no_show`

### Which statuses block availability (SoT today)

- Blocking statuses are defined in `osakamenesu/services/api/app/domains/site/therapist_availability.py`
  - `ACTIVE_RESERVATION_STATUSES = ("pending", "confirmed")`
  - Used in `_fetch_reservations()` and `has_overlapping_reservation()`

### DB locking (today)

- Reservation overlap check supports row locking via `SELECT ... FOR UPDATE`:
  - `has_overlapping_reservation(..., lock=True)` in `osakamenesu/services/api/app/domains/site/therapist_availability.py`
  - It applies `stmt.with_for_update()` to a `GuestReservation` query (if supported by DB)
- Guest reservation create uses the lock path:
  - `is_available(..., lock=True)` from `osakamenesu/services/api/app/domains/site/guest_reservations.py`
- No Postgres advisory lock usage was found under `osakamenesu/services/api/app` (grep: `advisory`)

## P1 spec (what we want to lock-in)

### Holds (TTL)

Spec file:

- `specs/reservations/holds.yaml`

Key points:

- Add guest reservation statuses: `reserved` and `expired`
- Holds are `reserved` with `reserved_until` (TTL minutes from `created_at`)
- `reserved` blocks availability just like `pending`/`confirmed`
- Add idempotency expectations (Idempotency-Key) for hold creation

### Room_count (design only in P1 plan)

Spec file:

- `specs/availability/core.yaml` (`p1_room_count`)

Rule:

- For a shop, overlapping blocking reservations must not exceed `room_count`
- Overlap definition is half-open: `[start_at, end_at)`

## Implementation plan (vertical slices)

### Slice 1: Holds (reserved/expired) + TTL semantics (no room_count yet)

DB changes (planned):

- Add `GuestReservation.reserved_until TIMESTAMPTZ NULL`
- Add `GuestReservation.idempotency_key TEXT NULL` (unique-ish scope to be decided)
- Extend `GuestReservationStatusLiteral` to include `reserved`, `expired`

Runtime behavior:

- New path (or flag on existing create) to create `reserved` holds
- `therapist_availability` treats `reserved` as blocking
- Expiry should be enforced on read (deterministic) and by async cleanup (best-effort)

### Slice 2: Enforce room_count (application-level)

DB change (planned):

- `profiles.room_count INT NOT NULL DEFAULT 1`

Implementation approach:

- Count overlapping blocking reservations for the shop in the same transaction
- Reject if count >= room_count
- Keep the overlap definition consistent with `_overlaps()` / SQL overlap query

### Slice 3: Stronger concurrency guarantees (later)

Options:

- Postgres `pg_advisory_xact_lock` per (shop_id + time bucket) to serialize reservations
- DB-level exclusion constraints (EXCLUDE USING gist on tstzrange) when ready

## Tests plan (write-up only)

- Holds:
  - `reserved` blocks availability like `pending`/`confirmed`
  - TTL expiry causes it to stop blocking (expired does not block)
- room_count:
  - room_count=2 allows 2 overlaps but rejects the 3rd
- Idempotency:
  - same key + same payload returns the same hold
  - same key + different payload rejects

## Checklist for P1 delivery

- [ ] Spec updated (holds + availability core)
- [ ] Migration plan written (reserved_until, idempotency_key, room_count)
- [ ] Locking strategy chosen for Slice 1 (row-lock vs advisory lock)
- [ ] Tests cover reserved/expired + blocking rules
- [ ] Runbook note: time zone invariants remain JST-based
