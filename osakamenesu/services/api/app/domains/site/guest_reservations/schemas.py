"""Request/Response schemas for guest reservations API."""

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from pydantic import BaseModel, model_validator

from ....models import now_utc


class GuestReservationPayload(BaseModel):
    shop_id: UUID
    therapist_id: UUID | None = None
    start_at: datetime
    end_at: datetime | None = None
    duration_minutes: int | None = None
    planned_extension_minutes: int | None = 0
    course_id: UUID | None = None
    price: float | None = None
    payment_method: str | None = None
    contact_info: dict[str, Any] | None = None
    guest_token: str | None = None
    user_id: UUID | None = None
    notes: str | None = None
    base_staff_id: UUID | None = None

    @model_validator(mode="after")
    def _validate_timing_sources(self) -> "GuestReservationPayload":
        if (
            self.end_at is None
            and self.duration_minutes is None
            and self.course_id is None
        ):
            raise ValueError("one of end_at, duration_minutes, course_id is required")
        return self


class GuestReservationHoldPayload(BaseModel):
    shop_id: UUID
    therapist_id: UUID
    start_at: datetime
    end_at: datetime | None = None
    duration_minutes: int | None = None
    planned_extension_minutes: int | None = 0
    course_id: UUID | None = None
    price: float | None = None
    payment_method: str | None = None
    contact_info: dict[str, Any] | None = None
    guest_token: str | None = None
    user_id: UUID | None = None
    notes: str | None = None
    base_staff_id: UUID | None = None

    @model_validator(mode="after")
    def _validate_timing_sources(self) -> "GuestReservationHoldPayload":
        if (
            self.end_at is None
            and self.duration_minutes is None
            and self.course_id is None
        ):
            raise ValueError("one of end_at, duration_minutes, course_id is required")
        return self


class GuestReservationResponse(BaseModel):
    id: UUID
    status: str
    shop_id: UUID
    therapist_id: UUID | None
    start_at: datetime
    end_at: datetime
    duration_minutes: int | None = None
    reserved_until: datetime | None = None
    course_id: UUID | None = None
    price: float | None = None
    payment_method: str | None = None
    contact_info: dict[str, Any] | None = None
    guest_token: str | None = None
    user_id: UUID | None = None
    notes: str | None = None
    base_staff_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    debug: dict[str, Any] | None = None


def serialize_reservation(
    reservation: Any, debug: dict[str, Any] | None = None
) -> GuestReservationResponse:
    """Serialize a GuestReservation model to response."""
    status_val = reservation.status
    if hasattr(status_val, "value"):
        status_val = status_val.value
    return GuestReservationResponse(
        id=reservation.id,
        status=status_val,
        shop_id=reservation.shop_id,
        therapist_id=reservation.therapist_id,
        start_at=reservation.start_at,
        end_at=reservation.end_at,
        duration_minutes=reservation.duration_minutes,
        reserved_until=getattr(reservation, "reserved_until", None),
        course_id=reservation.course_id,
        price=reservation.price,
        payment_method=reservation.payment_method,
        contact_info=reservation.contact_info,
        guest_token=reservation.guest_token,
        user_id=reservation.user_id,
        notes=reservation.notes,
        base_staff_id=reservation.base_staff_id,
        created_at=reservation.created_at,
        updated_at=reservation.updated_at,
        debug=debug,
    )


def make_rejected_response(
    payload: GuestReservationPayload | GuestReservationHoldPayload,
    debug: dict[str, Any] | None,
    user_id: UUID | None = None,
) -> GuestReservationResponse:
    """Create a rejected reservation response."""
    return GuestReservationResponse(
        id=UUID(int=0),
        status="rejected",
        shop_id=payload.shop_id,
        therapist_id=payload.therapist_id,
        start_at=payload.start_at,
        end_at=payload.end_at
        or (payload.start_at + timedelta(minutes=payload.duration_minutes or 0)),
        duration_minutes=payload.duration_minutes,
        reserved_until=None,
        course_id=payload.course_id,
        price=payload.price,
        payment_method=payload.payment_method,
        contact_info=payload.contact_info,
        guest_token=payload.guest_token,
        user_id=user_id,
        notes=payload.notes,
        base_staff_id=payload.base_staff_id,
        created_at=now_utc(),
        updated_at=now_utc(),
        debug=debug,
    )
