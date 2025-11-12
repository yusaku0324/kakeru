from __future__ import annotations

import os
import sys
from pathlib import Path


def _detect_service_root(current: Path) -> Path:
    resolved = current.resolve()
    for candidate in [resolved.parent] + list(resolved.parents):
        if (candidate / "requirements.txt").exists() and (candidate / "start.sh").exists():
            return candidate
    return resolved.parent


def configure_paths(current_file: Path) -> Path:
    service_root = _detect_service_root(current_file)
    project_root = service_root.parent if (service_root.parent / "services").exists() else service_root
    os.chdir(project_root)
    service_root_str = str(service_root)
    if service_root_str not in sys.path:
        sys.path.insert(0, service_root_str)
    return project_root
