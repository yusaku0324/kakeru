#!/usr/bin/env python3
"""Fail fast when build/test artifacts accidentally get committed."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


DEFAULT_PATTERNS = [
    "*.log",
    "apps/web/test-results/**",
    "apps/web/.next/**",
    "apps/web/e2e-output/**",
    "apps/web/build-storybook.log",
    "apps/web/chromatic*.log",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Detect unwanted artifacts")
    parser.add_argument(
        "--patterns",
        nargs="*",
        default=None,
        help="Glob patterns of tracked files that should fail the check",
    )
    return parser.parse_args()


def list_tracked_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files"],
        check=True,
        stdout=subprocess.PIPE,
        text=True,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def matches(file_path: str, patterns: list[str]) -> bool:
    path = Path(file_path)
    for pattern in patterns:
        if path.match(pattern):
            return True
    return False


def main() -> int:
    args = parse_args()
    patterns = args.patterns or DEFAULT_PATTERNS
    tracked = list_tracked_files()
    offenders = [path for path in tracked if matches(path, patterns)]
    if offenders:
        print("Found tracked artifacts that should be ignored:")
        for offending in offenders:
            print(f"  • {offending}")
        print("Please remove these files or add them to .gitignore before committing.")
        return 1
    print("Artifact check passed (no unwanted files tracked).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
