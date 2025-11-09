from __future__ import annotations

from pathlib import Path
from py.path import local


def _normalize_markexpr(config) -> str:
    expr = getattr(config.option, "markexpr", "") or ""
    return expr.replace(" ", "").lower()


def _selects_integration(config) -> bool:
    expr = _normalize_markexpr(config)
    if not expr:
        return False
    if "notintegration" in expr:
        return False
    return "integration" in expr


def _excludes_integration(config) -> bool:
    expr = _normalize_markexpr(config)
    return "notintegration" in expr


def _is_unit_test_path(path: local) -> bool:
    candidate = Path(str(path))
    try:
        parts = candidate.resolve().parts
    except OSError:
        parts = candidate.parts
    for idx, part in enumerate(parts):
        if part == "app" and idx + 1 < len(parts) and parts[idx + 1] == "tests":
            return True
    return False


def _is_integration_test_path(path: local) -> bool:
    candidate = Path(str(path))
    try:
        parts = candidate.resolve().parts
    except OSError:
        parts = candidate.parts
    for idx, part in enumerate(parts):
        if part == "app" and idx + 1 < len(parts) and parts[idx + 1] == "tests_integration":
            return True
    return False


def pytest_ignore_collect(path: local, config) -> bool:
    if _excludes_integration(config) and _is_integration_test_path(path):
        return True
    if not _selects_integration(config):
        return False
    return _is_unit_test_path(path)
