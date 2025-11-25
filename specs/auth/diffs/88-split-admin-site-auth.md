# Diff Spec: Split admin/site auth (#88)

## Current behavior (as of main)
- Site and dashboard may share overlapping session/cookie handling, risking scope bleed between customer and staff experiences.
- Admin/dashboard login uses dedicated credentials but relies on shared middleware/components with site auth.
- Authorization checks exist per route but the auth boundary between site and admin is not cleanly separated.

## Change in this issue (diff)
- Separate auth realms for site vs. dashboard: distinct session cookies/tokens and middleware guards per surface.
- Ensure dashboard routes accept only dashboard-scoped identities; site routes continue to use customer sessions.
- Clarify logout/session invalidation paths so ending one realm does not affect the other.

## Non-goals
- No introduction of SSO between admin and site in this issue.
- No new role model or permission matrix beyond existing admin/staff/customer roles.
- No UI redesign of login screens; scope is backend/auth boundary.

## Links
- Issue: #88 (https://github.com/yusaku0324/kakeru/issues/88)
