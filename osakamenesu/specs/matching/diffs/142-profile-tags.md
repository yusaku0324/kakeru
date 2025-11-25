# Diff Spec: Therapist profile tags (#142)

## Current behavior (as of main)
- Therapist profiles now carry `moodTag`, `styleTag`, `lookType`, `contactStyle`, and optional `hobbyTags` alongside existing fields.
- Matching responses expose these tags so the UI and scoring can consume them.
- Scoring uses mood/style/look tags when provided; missing tags fall back to neutral values.

## Change in this issue (diff)
- Implemented tag fields across persistence and API contracts; populated them through admin/profile inputs while keeping them optional for existing data.
- Surfaced tags in matching candidate payloads so frontend can display and weight them consistently.
- Fed the new tags into backend scoring to match the frontend `computeMatchingScore` inputs.

## Non-goals
- No mandatory tagging or migration that blocks publish; empty tags remain valid.
- Contact style and hobby tags are metadata only for now and are not yet weighted.
- No new UI or analytics for tag management beyond existing editors.

## Links
- Issue: #142
- Issue URL: https://github.com/osakamenesu/kakeru/issues/142
- Related scoring alignment: #143 https://github.com/osakamenesu/kakeru/issues/143
