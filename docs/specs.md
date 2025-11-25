# Specs workflow

## Naming rules
- Use filenames `specs/<domain>/diffs/<issue-number>-<short-kebab-slug>.md`.
- Include both `Issue: #<number>` and the full GitHub issue URL in the Links section of each diff spec.

## Auth domain
- Base: `specs/auth/base.md` — current site vs. dashboard auth flows, account models, and auth methods at a high level.
- Diffs: `specs/auth/diffs/` — add per-issue diffs with the standard sections for auth changes.
- Filename examples: `specs/auth/diffs/85-magic-link-auth.md`, `specs/auth/diffs/88-split-admin-site-auth.md`, `specs/auth/diffs/136-auth-clean-architecture.md`.
- Rule: for every auth-related issue/PR, create or update the corresponding diff spec, fill Current / Change / Non-goals / Links, and link it from the issue/PR.

## Checklist for issues/PRs
- [ ] Update or add a diff spec under `specs/<domain>/diffs/`
- [ ] Ensure Current / Change / Non-goals / Links are filled
- [ ] Link the diff spec from the GitHub issue or PR description
