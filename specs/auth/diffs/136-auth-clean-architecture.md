# Diff Spec: Auth clean architecture refactor (#136)

## Current behavior (as of main)
- Auth logic spans routers/services with limited separation between admin/site concerns.
- Session/token handling is coupled to framework-specific middleware in multiple places.
- Shared models and helpers make it hard to reason about auth boundaries and to test in isolation.

## Change in this issue (diff)
- Extract auth flows into clearer layers (domain/services/adapters) with explicit boundaries for admin vs. site.
- Consolidate session/token issuance/verification into reusable components with tests.
- Reduce framework coupling in auth entry points to enable easier evolution (e.g., new IdPs or login methods).

## Non-goals
- No changes to user/role semantics or permission rules beyond structural refactor.
- No new IdP integrations or MFA in this issue.
- No UI/UX changes to login flows.

## Links
- Issue: #136 (https://github.com/yusaku0324/kakeru/issues/136)
