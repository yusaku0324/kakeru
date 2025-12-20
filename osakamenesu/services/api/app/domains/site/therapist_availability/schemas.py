"""Pydantic schemas for therapist availability API."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class AvailabilitySummaryItem(BaseModel):
    date: date
    has_available: bool


class AvailabilitySummaryResponse(BaseModel):
    therapist_id: UUID
    items: list[AvailabilitySummaryItem]


# ステータス定義: open=予約可, tentative=要確認, blocked=予約不可
AvailabilitySlotStatus = Literal["open", "tentative", "blocked"]


class AvailabilitySlot(BaseModel):
    start_at: datetime = Field(..., description="ISO datetime of the available start")
    end_at: datetime = Field(..., description="ISO datetime of the available end")
    status: AvailabilitySlotStatus = Field(
        default="open",
        description="Slot status: open=available, tentative=needs confirmation, blocked=unavailable",
    )


class AvailabilitySlotsResponse(BaseModel):
    therapist_id: UUID
    date: date
    slots: list[AvailabilitySlot]


class SlotVerificationResponse(BaseModel):
    """スロット検証結果"""

    therapist_id: UUID
    start_at: datetime
    end_at: datetime
    status: AvailabilitySlotStatus
    verified_at: datetime = Field(..., description="Verification timestamp in JST")
    is_available: bool = Field(..., description="True if slot can be booked")
