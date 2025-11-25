# Diff Spec: Therapist profile tags (#142)

## Current behavior (as of main)
- Therapist profiles carry `moodTag`, `styleTag`, `lookType`, `talkLevel`, `contactStyle`, and optional `hobbyTags` alongside existing fields (see `docs/matching-tags.md`).
- Matching responses expose these tags so the UI and scoring can consume them; talk and contact styles are returned for display even when not weighted.
- Scoring uses mood/style/look/talk tags when provided; missing tags fall back to neutral values to avoid penalizing sparse data.

## Change in this issue (diff)
- Added tag fields across persistence and API contracts and populated them through admin/profile inputs while keeping them optional for existing data.
- Surfaced tags in matching candidate payloads so frontend can display and weight them consistently.
- Fed the new tags into backend scoring (mood/style/look/talk) to match the frontend `computeMatchingScore` inputs; contact/hobby remain display-only for now.
- Documented the tag catalog in `docs/matching-tags.md`.

## Non-goals
- No mandatory tagging or migration that blocks publish; empty tags remain valid.
- Contact style and hobby tags are metadata only for now and are not yet weighted.
- No new UI or analytics for tag management beyond existing editors.

## Links
- Issue: #142 (https://github.com/osakamenesu/kakeru/issues/142)
- Implemented by: #146, #147, #149
- Tag catalog: `docs/matching-tags.md`
