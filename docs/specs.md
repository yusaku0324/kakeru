# Specs workflow

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
