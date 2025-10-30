#!/usr/bin/env python3
"""Utility to render a simple key: value env file for Cloud Run deployments."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Iterable, Tuple


def parse_spec(spec: str) -> Tuple[str, str]:
    """Return (output_key, source_env_name)."""
    if "=" in spec:
        key, env_name = spec.split("=", 1)
    else:
        key = env_name = spec
    return key, env_name


def collect_values(
    specs: Iterable[str],
    *,
    optional: bool = False,
) -> dict[str, str]:
    """Resolve environment values for the provided key specs."""
    values: dict[str, str] = {}
    for spec in specs:
        key, env_name = parse_spec(spec)
        value = os.environ.get(env_name, "")
        if not value:
            if optional or value == "":
                # Skip optional or empty values silently.
                continue
            print(f"::error::{env_name} is not set for env file generation.", file=sys.stderr)
            sys.exit(1)
        values[key] = value
    return values


def main() -> None:
    parser = argparse.ArgumentParser(description="Write key: value pairs to an env file.")
    parser.add_argument("--output", required=True, help="Target file path")
    parser.add_argument(
        "--key",
        action="append",
        default=[],
        help="Required key specification (KEY or KEY=ENV_NAME)",
    )
    parser.add_argument(
        "--optional-key",
        action="append",
        default=[],
        help="Optional key specification (only written if value is non-empty)",
    )
    args = parser.parse_args()

    pairs: dict[str, str] = {}
    pairs.update(collect_values(args.key))
    pairs.update(collect_values(args.optional_key, optional=True))

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        "".join(f"{k}: {json.dumps(v, ensure_ascii=False)}\n" for k, v in pairs.items()),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
