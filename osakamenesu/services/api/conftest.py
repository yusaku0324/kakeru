from __future__ import annotations

from pathlib import Path
from typing import Any


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


def _resolve_parts(candidate: Path) -> tuple[str, ...]:
    try:
        return candidate.resolve().parts
    except OSError:
        return candidate.parts


def _coerce_path(value: Any) -> Path:
    if isinstance(value, Path):
        return value
    return Path(str(value))


def _is_unit_test_path(path: Path) -> bool:
    parts = _resolve_parts(path)
    for idx, part in enumerate(parts):
        if part == "app" and idx + 1 < len(parts) and parts[idx + 1] == "tests":
            return True
    return False


def _is_integration_test_path(path: Path) -> bool:
    parts = _resolve_parts(path)
    for idx, part in enumerate(parts):
        if part == "app" and idx + 1 < len(parts) and parts[idx + 1] == "tests_integration":
            return True
    return False


def pytest_ignore_collect(collection_path, path=None, config=None) -> bool:
    if config is None:
        config = path
        path = collection_path
        collection_path = None
    candidate_path = _coerce_path(collection_path or path)
    if _excludes_integration(config) and _is_integration_test_path(candidate_path):
        return True
    if not _selects_integration(config):
        return False
    return _is_unit_test_path(candidate_path)
