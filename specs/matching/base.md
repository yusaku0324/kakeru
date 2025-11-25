# Matching Base Spec

Scope: guest-facing matching flow and scoring, kept lightweight so diffs can extend it.

## Guest Matching Flow (current)
- Primary endpoint `POST /api/guest/matching/search` (used by the search form and the chat-style entry) accepts guest preferences and returns ordered therapist candidates.
- Inputs (rough): area or shop ids, date/time window, optional course or therapist id, budget level (`low`/`mid`/`high`), optional weighted preferences for mood/style/look/talk/contact/hobby plus free-text notes; may include a guest token for continuity.
- Output: list of therapist candidates sorted by `score`; each item includes therapist id/name, shop id/name, available slots (start/end), profile tags (`moodTag`/`styleTag`/`lookType`/`contactStyle`/`hobbyTags`), and a `breakdown` of score components for transparency.
- Matching requests are best-effort logged to `guest_match_logs` with payload, candidates, and (when chosen) selected therapist/slot for analytics/tuning.

## Scoring (current)
- Core availability score (0–1) comes from search filters (area/time/booking constraints) and is shared between frontend and backend callers.
- Total score mirrors `apps/web/src/features/matching/computeMatchingScore.ts` weights: core 0.4, price fit 0.15, mood fit 0.15, talk fit 0.1, style fit 0.1, look fit 0.05, availability 0.05; missing data defaults to a neutral 0.5.
- Tag usage: therapist profiles include `moodTag`, `styleTag`, `lookType`, `talkLevel`, `contactStyle`, and optional `hobbyTags`; guest prefs can express weights per tag. Mood/style/look/talk influence scoring; contact/hobby are present for display/future scoring.
- Response `breakdown` echoes component scores to help debugging and frontend display.

## Related Notes
- Conversation/onboarding flows map their answers into the same search payload before calling the endpoint.
- Additional behaviors (logging, similar-therapist recommendations) are defined incrementally in diff specs under `specs/matching/diffs/`.
