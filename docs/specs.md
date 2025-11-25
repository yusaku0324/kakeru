# Specs workflow

- Matching base: `specs/matching/base.md` (current guest matching flow and scoring at a high level).
- Matching diffs: `specs/matching/diffs/<issue>-<slug>.md` (per-issue changes; Current / Change / Non-goals / Links).
- Tag catalog: `docs/matching-tags.md` (matching tag definitions and scoring relevance).
- Reservations base: `specs/reservations/base.md` (current reservation/search/cancel flow overview).
- Reservations diffs: `specs/reservations/diffs/` (add per-issue diffs with the same format when reservation issues/PRs open).

## Naming rules
- Use filenames `specs/<domain>/diffs/<issue-number>-<short-kebab-slug>.md` (e.g., `specs/matching/diffs/141-guest-matching-log.md`).
- Include both `Issue: #<number>` and the full GitHub issue URL in the Links section of each diff spec.

## Matching domain overview
- `specs/matching/base.md` — current guest matching flow and scoring inputs/weights.
- `specs/matching/diffs/141-guest-matching-log.md` — search + selection logging via `GuestMatchLog` (best-effort, non-blocking).
- `specs/matching/diffs/142-profile-tags.md` — therapist profile tags surfaced to matching/scoring and documented in `docs/matching-tags.md`.
- `specs/matching/diffs/143-score-alignment.md` — backend scoring aligned with frontend weights and tag fits.
- `specs/matching/diffs/144-similar-therapist-api.md` — planned similar-therapist recommendation endpoint (not yet implemented).
- `docs/matching-tags.md` — canonical tag definitions/options for matching.

## Reservations domain overview
- `specs/reservations/base.md` — current guest/store reservation flow and core endpoints at a high level.
- `specs/reservations/diffs/` — add per-issue diff specs here using the Current/Change/Non-goals/Links format when reservation issues/PRs are opened.

## Checklist to paste into issues/PRs
- [ ] Update or add a diff spec under `specs/<domain>/diffs/`
- [ ] Ensure Current / Change / Non-goals / Links are filled
- [ ] Link the diff spec from the GitHub issue or PR description
