from __future__ import annotations

from typing import Literal, Tuple

ReservationStatusLiteral = Literal["pending", "confirmed", "declined", "cancelled", "expired"]

RESERVATION_STATUS_VALUES: Tuple[str, ...] = ("pending", "confirmed", "declined", "cancelled", "expired")
RESERVATION_STATUS_SET = set(RESERVATION_STATUS_VALUES)

DEFAULT_RESERVATION_STATUS: ReservationStatusLiteral = "pending"

__all__ = [
    "ReservationStatusLiteral",
    "RESERVATION_STATUS_VALUES",
    "RESERVATION_STATUS_SET",
    "DEFAULT_RESERVATION_STATUS",
]
