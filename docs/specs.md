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
- `specs/matching/diffs/144-similar-therapist-api.md` — similar-therapist recommendation endpoint spec.
- `docs/matching-tags.md` — canonical tag definitions/options for matching.

## Reservations domain overview

- `specs/reservations/base.md` — current guest/store reservation flow and core endpoints at a high level.
- `specs/reservations/diffs/` — add per-issue diff specs here using the Current/Change/Non-goals/Links format when reservation issues/PRs are opened.

## Speckit

- Location: `specs/speckit/<domain>/` (matching, reservations, auth).
- Purpose: executable happy-path scenarios aligned with the Markdown base/diff specs in `specs/<domain>/`.
- Naming: one YAML per scenario (e.g., `specs/speckit/matching/search.yaml`, `specs/speckit/auth/login-magic-link.yaml`).
- Usage:
  - Validate: `speckit validate specs/speckit`
  - Run vs dev API: `speckit run <file> --base-url http://localhost:8000`
  - CI (future): add a lightweight job to run `speckit validate specs/speckit` and optionally `speckit check specs/speckit --base-url $DEV_API`.
- Domains covered in this scaffold:
  - Matching: `/api/guest/matching/search`, `/api/guest/matching/similar`
  - Reservations: availability lookup + reservation create (happy path)
  - Auth: magic-link request/verify (dashboard scope)

## Checklist for issues/PRs

- [ ] Update or add a diff spec under `specs/<domain>/diffs/` (sections: Current / Change / Non-goals / Links with Issue# + URL)
- [ ] If endpoints change, update/add speckit scenarios under `specs/speckit/<domain>/`
- [ ] Link the relevant diff spec from the GitHub issue/PR description
