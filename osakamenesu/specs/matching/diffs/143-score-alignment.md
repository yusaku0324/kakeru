# Diff Spec: Matching score alignment (#143)

## Current behavior (as of main)
- Backend `_score_candidate` matches frontend `computeMatchingScore` weights and defaults.
- Missing tags or preferences default to a neutral 0.5 so incomplete data is not penalized.
- API responses include a breakdown (`core`, `priceFit`, `moodFit`, `talkFit`, `styleFit`, `lookFit`, `availability`) used for ranking and debugging.

## Change in this issue (diff)
- Replaced earlier heuristic scoring with the shared weighted formula: core 0.4, price 0.15, mood 0.15, talk 0.1, style 0.1, look 0.05, availability 0.05 (now active in backend).
- Normalized component inputs to 0–1 (core/availability) and tag-fit scores based on guest preference weights and therapist tags.
- Synced backend results with the frontend helper to avoid drift between API ordering and client-side previews.

## Non-goals
- No ML or embedding-based ranking yet; remains rule/weight driven.
- No changes to search filters or availability computation feeding the core score.
- Response shape is unchanged beyond the existing breakdown fields.

## Links
- Issue: #143
- Issue URL: https://github.com/osakamenesu/kakeru/issues/143
- Frontend helper: `osakamenesu/apps/web/src/features/matching/computeMatchingScore.ts`
