"""Base schema imports and constants."""

from __future__ import annotations

import re
from datetime import datetime, date
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    conint,
    constr,
    field_validator,
    model_validator,
)

from ..constants import (
    RESERVATION_SLOT_STATUS_SET,
    ReservationSlotStatusLiteral,
    ReservationStatusLiteral,
)

# Review aspect keys
REVIEW_ASPECT_KEYS = ("therapist_service", "staff_response", "room_cleanliness")
ReviewAspectKey = Literal["therapist_service", "staff_response", "room_cleanliness"]

# Re-export commonly used types
__all__ = [
    "BaseModel",
    "EmailStr",
    "Field",
    "conint",
    "constr",
    "field_validator",
    "model_validator",
    "datetime",
    "date",
    "Any",
    "Dict",
    "List",
    "Literal",
    "Optional",
    "UUID",
    "re",
    "RESERVATION_SLOT_STATUS_SET",
    "ReservationSlotStatusLiteral",
    "ReservationStatusLiteral",
    "REVIEW_ASPECT_KEYS",
    "ReviewAspectKey",
]
