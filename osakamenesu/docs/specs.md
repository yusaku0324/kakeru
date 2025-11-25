# Specs workflow (matching domain pilot)

- Base spec: `specs/matching/base.md` captures current guest matching behavior at a high level.
- Diff specs: `specs/matching/diffs/<issue>-<slug>.md` record per-issue changes without rewriting the base.
- Tag catalog: `docs/matching-tags.md` lists available matching tags and how they are used.

## Naming rules
- Use filenames `specs/matching/diffs/<issue-number>-<short-kebab-slug>.md` (e.g., `141-guest-matching-log.md`).
- Include both `Issue: #<number>` and the full GitHub issue URL in the Links section of each diff spec.

## Matching domain overview
- `specs/matching/base.md` — current guest matching flow and scoring inputs/weights.
- `specs/matching/diffs/141-guest-matching-log.md` — search + selection logging via `GuestMatchLog` (best-effort, non-blocking).
- `specs/matching/diffs/142-profile-tags.md` — therapist profile tags surfaced to matching/scoring and documented in `docs/matching-tags.md`.
- `specs/matching/diffs/143-score-alignment.md` — backend scoring aligned with frontend weights and tag fits.
- `specs/matching/diffs/144-similar-therapist-api.md` — planned similar-therapist recommendation endpoint (not yet implemented).
- `docs/matching-tags.md` — canonical tag definitions/options for matching.

## How to use diff specs
- For every matching-related issue, add or update a diff spec with the sections **Current behavior**, **Change (diff)**, **Non-goals**, and **Links**.
- Keep the base spec concise; refresh it occasionally after major merges, but most details should live in the diff specs and git history.
- Link the relevant diff spec from the GitHub issue/PR so reviewers and Codex can track intent vs. implementation.

## Checklist to paste into issues/PRs
- [ ] Update or add a diff spec under `specs/matching/diffs/`
- [ ] Ensure Current / Change / Non-goals / Links are filled
- [ ] Link the diff spec from the GitHub issue or PR description
