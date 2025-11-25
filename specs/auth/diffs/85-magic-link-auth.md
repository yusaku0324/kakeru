# Diff Spec: Magic-link authentication (#85)

## Current behavior (as of main)
- Email-based magic links are limited/lightweight; delivery/reliability is not guaranteed for all environments.
- Session cookies/tokens back user login; fallback flows (password/LINE/social) exist depending on entry point.
- Dashboard/store login uses separate credentials; magic-link is primarily for site users.

## Change in this issue (diff)
- Implement production-grade email delivery for magic-link login/reset, with signed, time-bound URLs.
- Provide guest/member login via magic link that issues the same site session tokens used by standard login.
- Add basic UX/error handling for expired or invalid links without blocking other auth flows.

## Non-goals
- No multi-factor auth or device binding in this issue.
- No changes to dashboard/admin auth flows beyond respecting existing session cookies.
- No redesign of user model or roles.

## Links
- Issue: #85 (https://github.com/yusaku0324/kakeru/issues/85)
