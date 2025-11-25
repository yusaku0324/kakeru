# Diff Spec: Log guest matching preferences and selections (#141)

## Current behavior (as of main)
- `GuestMatchLog` table and `_log_matching` helper persist search payloads and ranked candidates (keyed by guest token when available) without blocking responses.
- Stored fields include area/date/budget, mood/talk/style/look prefs, free_text, and candidate arrays (top + other) with scores/breakdowns.
- When a guest selects a therapist/slot, selection ids and slot details are appended to the same log entry to close the loop.
- Logging tolerates missing optional fields and failures; matching responses still return.

## Change in this issue (diff)
- Added `guest_match_logs` schema + helper to capture search payloads, ranking results, and subsequent selections for analytics/tuning.
- Wired matching entry points to invoke logging on search and on selection using the request token/guest token for correlation.
- Kept logging non-blocking and tolerant to partial payloads to avoid impacting user flow.

## Non-goals
- No PII beyond an anonymized guest token; do not store emails or phone numbers.
- No real-time analytics dashboards in this issue.
- No change to search ranking or response payload besides optional logging.

## Links
- Issue: #141 (https://github.com/osakamenesu/kakeru/issues/141)
- Implemented by: #148, #149
- Schema reference: `osakamenesu/services/api/app/models.py` (GuestMatchLog)
