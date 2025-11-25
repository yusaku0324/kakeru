# Spec Summary: Reservations v1

## APIs
- POST /api/guest/reservations -> create (status confirmed/pending configurable, duplicate slot guard)
- POST /api/guest/reservations/{id}/cancel -> cancel, idempotent, returns {ok,status}
- GET /api/guest/reservations/{id} -> detail, 404 if missing

## Entities
- GuestReservation: id (string PK), guest_id/token, profile_id, therapist_id, status (pending/confirmed/cancelled), start_at/end_at, price/menu/contact_info/notes, created_at/updated_at, unique (therapist_id,start_at,end_at)

## Rules
- Duplicate same therapist+slot -> 409 (or 400). Cancel is idempotent.
- Create returns confirmed (v1) unless approval flow added later.

## Error handling
- Missing id -> 404 (detail/cancel). Other errors should not crash main flow.

## Links
- Specs: specs/reservations/core.yaml
- Tests: services/api/app/tests/test_guest_reservations.py
