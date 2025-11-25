# Spec Summary: Matching (search v2 / similar)

## APIs
- GET/POST /api/guest/matching/search -> { items: MatchingSearchItem[], total: number }
- GET /api/guest/matching/similar -> { base_staff_id, items: SimilarTherapistItem[] }

## Scoring (search v2)
- Components (0..1, missing => 0.5):
  - photo_score = photo_similarity (base present: embedding cosine; absent: 0.5)
  - tag_score = 0.25*mood + 0.20*style + 0.30*look + 0.10*contact + 0.15*hobby
    - single-tag: query empty =>0.5; query non-empty & cand null =>0.0; match =>1.0; else 0.0
    - hobby: both empty =>0.5; one empty =>0.0; else Jaccard
  - price_score: diff to desired rank -> (0,0.6,0.2,0) else 0.5
  - age_score: 1 - diff/15 else 0.5
- Final: score = 0.60*photo + 0.25*tag + 0.10*price + 0.05*age (clamp 0..1)
- Sort recommended: score desc -> availability -> id; other/unknown sort: preserve existing order (no throw)

## Responses
- Always {items, total}; score/photo_similarity clamped 0..1; empty allowed when input missing or errors.
- Similar: filters by shop/availability/min_score; score/tag_similarity/photo_similarity (0..1), exclude base.

## Error handling (fail-soft)
- area/date missing, search_service error: 200 + empty.
- base_staff_id missing/embedding absent: no 5xx; photo_similarity fallback 0.5.
- Unknown sort: no exception; treat as recommended or default order.

## Links
- Specs: specs/matching/search.yaml, specs/matching/similar.yaml, specs/matching/core.yaml
- Tests: services/api/app/tests/test_guest_matching.py (search/similar), apps/web/e2e/match-chat.spec.ts
