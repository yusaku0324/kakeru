# Diff Spec: Log guest matching preferences and selections (#141)

## Current behavior (as of main)
- Backend matching now records search payloads and results in `guest_match_logs` (created with `GuestMatchLog` model and migration), keyed by guest token when available.
- Stored fields include area/date/budget, mood/talk/style/look prefs, free_text, top matches and other candidates with scores.
- When a guest selects a therapist/slot, selection ids/slot details are appended to the same log entry.
- Logging is best-effort; matching responses are not blocked by log write failures.

## Change in this issue (diff)
- Ensure all guest matching entry points invoke the logging helper so searches and selections land in `guest_match_logs` consistently.
- Keep logging non-blocking and tolerant to missing optional fields; prioritize capturing enough context for analytics/tuning.

## Non-goals
- No PII beyond an anonymized guest token; do not store emails or phone numbers.
- No real-time analytics dashboards in this issue.
- No change to search ranking or response payload besides optional logging.

## Links
- Issue: #141
- Issue URL: https://github.com/osakamenesu/kakeru/issues/141
- Schema reference: `osakamenesu/services/api/app/models.py` (GuestMatchLog)
