# Diff Spec: Similar therapist recommendation API (#144)

## Current behavior (as of main)
- There is no endpoint to fetch "similar therapists"; guests only see matches from their own search query.
- Recommendations rely on manual browsing; similarity to a chosen therapist is not exposed.

## Change in this issue (diff)
- Planned (not yet implemented): add a read-only endpoint (e.g., `GET /api/guest/matching/similar?therapist_id=...` or `/api/therapists/{id}/similar`) that returns a small list of similar therapists with similarity scores.
- Planned: compute similarity using existing profile signals (mood/style/look/contact/hobby tags, price level, shop/area proximity) and the same scoring breakdown shape used in matching responses.
- Planned: response shape mirrors matching candidates (therapist/shop ids, name, tags, optional availability plus score/breakdown) so the frontend can reuse components.

## Non-goals
- No personalization by guest history or account data; results are content-based.
- No curated or admin-managed lists in this issue; results are computed, not hand-picked.
- Does not alter booking or availability logic; similarity is informational and does not reserve slots.

## Links
- Issue: #144 (https://github.com/osakamenesu/kakeru/issues/144)
- Status: planned; no implementing PR yet
