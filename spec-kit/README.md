# Spec Kit (dev tool)

Spec Kit is an OSS toolkit from GitHub that supports spec-driven development. We keep it dev-only and opt-in.

## Install (local only)

Install the `specify` CLI via `uv`:

```bash
# persistent install (recommended)
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

# one-time run
uvx --from git+https://github.com/github/spec-kit.git specify --help
```

This does not affect production builds or CI. It is a local helper for writing/reading specs.

## Config / specs

- Sample spec: `specs/sample-therapist-home.md`
- No project-wide config yet; we will add one when formal specs are introduced.

## Quick use

```bash
specify --help
specify check specs/sample-therapist-home.md
```
