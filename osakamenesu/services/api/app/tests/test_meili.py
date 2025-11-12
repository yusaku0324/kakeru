import os
import sys
from pathlib import Path

_HELPER_DIR = Path(__file__).resolve().parent
if str(_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_HELPER_DIR))

from _path_setup import configure_paths
import types

import pytest

# Ensure app package is importable when tests run from repo root
ROOT = configure_paths(Path(__file__))

# Provide minimal settings stub for import-time configuration
dummy_settings_module = types.ModuleType("app.settings")


class _DummySettings:
    def __init__(self) -> None:
        self.meili_host = os.environ.get("MEILI_HOST", "http://localhost:7700")
        self.meili_master_key = os.environ.get("MEILI_MASTER_KEY", "dev_key")


dummy_settings_module.Settings = _DummySettings  # type: ignore[attr-defined]
dummy_settings_module.settings = _DummySettings()
sys.modules.setdefault("app.settings", dummy_settings_module)

from app import meili


def test_ensure_indexes_if_needed_runs_once(monkeypatch):
    call_count = {"value": 0}

    def fake_ensure():
        call_count["value"] += 1
        meili._indexes_ensured = True

    monkeypatch.setattr(meili, "ensure_indexes", fake_ensure)
    meili._indexes_ensured = False

    meili.ensure_indexes_if_needed()
    meili.ensure_indexes_if_needed()

    assert call_count["value"] == 1


def test_ensure_indexes_if_needed_resets_on_failure(monkeypatch):
    def failing_ensure():
        raise RuntimeError("ensure failure")

    monkeypatch.setattr(meili, "ensure_indexes", failing_ensure)
    meili._indexes_ensured = False

    with pytest.raises(RuntimeError):
        meili.ensure_indexes_if_needed()

    assert meili._indexes_ensured is False
