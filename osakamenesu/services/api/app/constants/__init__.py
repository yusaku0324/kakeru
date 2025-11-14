"""Application-wide constant definitions."""

from .reservations import (
    DEFAULT_RESERVATION_STATUS,
    RESERVATION_SLOT_STATUS_SET,
    RESERVATION_SLOT_STATUS_VALUES,
    RESERVATION_STATUS_SET,
    RESERVATION_STATUS_VALUES,
    ReservationSlotStatusLiteral,
    ReservationStatusLiteral,
)

__all__ = [
    "DEFAULT_RESERVATION_STATUS",
    "ReservationStatusLiteral",
    "ReservationSlotStatusLiteral",
    "RESERVATION_STATUS_SET",
    "RESERVATION_STATUS_VALUES",
    "RESERVATION_SLOT_STATUS_SET",
    "RESERVATION_SLOT_STATUS_VALUES",
]
