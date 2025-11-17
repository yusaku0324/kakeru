#!/usr/bin/env python3
"""Ensure commands are executed via `doppler run -- ...`."""

from __future__ import annotations

import os
import sys


REQUIRED_VARS = [
    "DOPPLER_PROJECT",
    "DOPPLER_CONFIG",
]

OPTIONAL_VARS = [
    "DOPPLER_ENVIRONMENT",
    "DOPPLER_ENVIRONMENT_NAME",
    "DOPPLER_CONFIG_ID",
]


def main() -> int:
    missing = [name for name in REQUIRED_VARS if not os.environ.get(name)]
    if missing:
        print(
            "このコマンドは Doppler 経由で実行してください。",
            file=sys.stderr,
        )
        print(
            "例: doppler run --project osakamenesu --config dev_web -- <command>",
            file=sys.stderr,
        )
        print(f"欠落している環境変数: {', '.join(missing)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
