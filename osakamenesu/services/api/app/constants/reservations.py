from __future__ import annotations

from typing import Literal, Tuple

ReservationStatusLiteral = Literal["pending", "confirmed", "declined", "cancelled", "expired"]
ReservationSlotStatusLiteral = Literal["open", "tentative", "blocked"]

RESERVATION_STATUS_VALUES: Tuple[str, ...] = ("pending", "confirmed", "declined", "cancelled", "expired")
RESERVATION_STATUS_SET = set(RESERVATION_STATUS_VALUES)

DEFAULT_RESERVATION_STATUS: ReservationStatusLiteral = "pending"

RESERVATION_SLOT_STATUS_VALUES: Tuple[str, ...] = ("open", "tentative", "blocked")
RESERVATION_SLOT_STATUS_SET = set(RESERVATION_SLOT_STATUS_VALUES)

__all__ = [
    "ReservationStatusLiteral",
    "ReservationSlotStatusLiteral",
    "RESERVATION_STATUS_VALUES",
    "RESERVATION_STATUS_SET",
    "RESERVATION_SLOT_STATUS_VALUES",
    "RESERVATION_SLOT_STATUS_SET",
    "DEFAULT_RESERVATION_STATUS",
]
