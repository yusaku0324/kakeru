from __future__ import annotations

from http import HTTPStatus
from typing import Any


class AdminServiceError(Exception):
    """Domain-level error that surfaces an HTTP status for routers to map."""

    def __init__(self, status_code: int | HTTPStatus, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = int(status_code)
        self.detail = detail


__all__ = ["AdminServiceError"]
