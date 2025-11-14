#!/usr/bin/env python3
"""
Utility to extract cookie key/value pairs from an HTTP headers file.

Designed for CI usage where a previous curl command wrote response headers to a
temporary file. The script reads the file, collects any `Set-Cookie` headers,
and prints a semicolon separated list suitable for `Cookie` headers or
Playwright's `E2E_SITE_COOKIE` environment variable.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--headers",
        required=True,
        type=Path,
        help="Path to the file that contains HTTP response headers.",
    )
    return parser.parse_args()


def extract_cookie_pairs(headers_path: Path) -> list[str]:
    if not headers_path.is_file():
        raise FileNotFoundError(f"Headers file not found: {headers_path}")

    pairs: list[str] = []
    with headers_path.open("r", encoding="utf-8") as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line.lower().startswith("set-cookie:"):
                continue
            value_part = line.split(":", 1)[1].strip()
            if not value_part:
                continue
            cookie_pair = value_part.split(";", 1)[0].strip()
            if cookie_pair:
                pairs.append(cookie_pair)
    return pairs


def main() -> int:
    args = parse_arguments()
    try:
        cookie_pairs = extract_cookie_pairs(args.headers)
    except Exception as exc:  # pragma: no cover - defensive logging
        print(f"Error parsing headers: {exc}", file=sys.stderr)
        return 1

    if not cookie_pairs:
        print("No Set-Cookie headers found", file=sys.stderr)
        return 1

    print("; ".join(cookie_pairs))
    return 0


if __name__ == "__main__":
    sys.exit(main())
