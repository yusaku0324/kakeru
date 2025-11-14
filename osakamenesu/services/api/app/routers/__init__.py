"""Backward-compatible router module exports with lazy loading."""

from importlib import import_module
from typing import Any

_MODULE_MAP = {
    "favorites": "app.domains.site.favorites",
    "shops": "app.domains.site.shops",
    "admin": "app.domains.admin.router",
    "profiles": "app.domains.admin.profiles",
    "reservations": "app.domains.admin.reservations",
    "dashboard_shops": "app.domains.dashboard.shops.router",
    "dashboard_therapists": "app.domains.dashboard.therapists.router",
    "dashboard_notifications": "app.domains.dashboard.notifications.router",
    "auth": "app.domains.auth.router",
}

__all__ = list(_MODULE_MAP.keys())


def __getattr__(name: str) -> Any:
    try:
        module_path = _MODULE_MAP[name]
    except KeyError as exc:  # pragma: no cover - defensive
        raise AttributeError(name) from exc
    return import_module(module_path)
