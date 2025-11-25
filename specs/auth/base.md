# Auth Base Spec

Scope: authentication/authorization across guest-facing site and store/admin dashboards. Lightweight overview to guide diff specs.

## Current auth flows (high level)
- Site (guest → member): guests browse without login; sign-in/signup provides an account for booking history/profile; authenticated sessions needed for mypage/reservations.
- Dashboard (store/admin): staff sign in to manage shops/therapists/shifts/reservations; access is restricted to dashboard-scoped identities.
- Magic-link / email-based auth: used for quick login/reset in some flows; typically issues session cookies on success.
- Social/LINE or token-based flows: available for certain guest interactions; session tokens/cookies maintain continuity per channel.

## Key components (high level)
- Account models: customer `User` accounts for site; staff/admin accounts linked to shops/therapists for dashboard access.
- Credentials & sessions: cookie-backed web sessions; optional short-lived tokens for APIs; dashboard sessions should be scoped separately from site sessions when split.
- Identity providers: email/password or magic-link; LINE/other social channels for lightweight guest identification; admin accounts may rely on password-based login.
- Access boundaries: site routes vs. dashboard routes guarded separately; authorization enforces role/ownership per shop/therapist/resource.

## Notes
- This base spec is intentionally coarse; per-issue behavior belongs in `specs/auth/diffs/`.
- Clean-architecture refactors (e.g., separating admin/site auth services) should be captured in diff specs to track scope and rollout.
