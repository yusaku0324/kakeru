# Project Constitution: osakamenesu - matching & reservations

## Purpose
- Build guest-facing matching/reservation flows that never crash, even with missing inputs or partial data.
- Keep specs (Speckit YAML + markdown) aligned with backend and frontend implementations.
- Prefer fail-soft behavior (200 + empty) over 4xx/5xx unless input is clearly invalid and caller must be notified.

## Principles
- Clarity first: single source of truth for each domain spec, referenced from .specify and specs/*.yaml.
- Fail-soft UX: API should avoid crashing; return empty lists when inputs are missing, and log errors.
- Safety in scoring: always clamp scores to 0..1, treat missing data as neutral (0.5), never throw.
- Incremental rollout: start with matching/search v2 and similar; reservations v1; auth base/diffs.
- Test alignment: keep pytest, playwright, and spec files in sync; add seeds/mocks for predictable results.

## Scope
- Guest matching: /api/guest/matching/search (v2 scoring with photo/tag/price/age) and /similar.
- Reservations v1: guest create/cancel/detail, status pending/confirmed/cancelled, duplicate slot guard.
- Auth base/diffs: login flows and magic-link separation (issues 85/88/136).

## Non-negotiables
- Responses: matching search always returns `{items, total}` (empty allowed), scores/photo_similarity in 0..1.
- Error handling: missing area/date or search errors must not produce 5xx; prefer empty responses.
- Embeddings: when present, use for photo_similarity; when absent, fallback to 0.5.
- Sorting: unknown sort values must not throw; recommended uses v2 score; others preserve existing order.
- Logging: best-effort logging must never break main flow.

## Collaboration
- Use /speckit.* commands for new specs and plans; keep .specify up to date.
- Link to source specs (specs/matching/*.yaml, docs/specs.md) from .specify artifacts.
- Seed/mocks: provide minimal data or mocks so UI/E2E can show results without crashing.

## Tooling
- specify-cli installed via uv; .specify managed in repo.
- speckit validate: TODO once binary/source is available; prepare scripts to run against specs/matching/search.yaml and similar.yaml.
