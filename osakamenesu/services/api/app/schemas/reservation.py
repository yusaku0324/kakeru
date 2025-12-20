"""Reservation schemas."""

from .base import (
    BaseModel,
    Field,
    List,
    Optional,
    UUID,
    datetime,
    re,
    field_validator,
    model_validator,
    RESERVATION_SLOT_STATUS_SET,
    ReservationSlotStatusLiteral,
    ReservationStatusLiteral,
)


class ReservationCustomerInput(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    line_id: Optional[str] = None
    remark: Optional[str] = None

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("name is required")
        normalized = value.strip()
        if len(normalized) > 80:
            raise ValueError("name must be 80 characters or fewer")
        return normalized

    @field_validator("phone")
    @classmethod
    def _validate_phone(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("phone is required")
        normalized = value.strip()
        digits = re.sub(r"\D+", "", normalized)
        if len(digits) < 10 or len(digits) > 13:
            raise ValueError("phone must include 10-13 numeric digits")
        return normalized

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class ReservationCustomer(ReservationCustomerInput):
    id: Optional[UUID] = None


class ReservationPreferredSlotBase(BaseModel):
    desired_start: datetime
    desired_end: datetime
    status: ReservationSlotStatusLiteral = "open"

    @field_validator("status")
    @classmethod
    def _validate_status(cls, value: str) -> ReservationSlotStatusLiteral:
        if value not in RESERVATION_SLOT_STATUS_SET:
            raise ValueError("invalid slot status")
        return value  # type: ignore[return-value]

    @model_validator(mode="after")
    def _validate_range(self) -> "ReservationPreferredSlotBase":
        if self.desired_end <= self.desired_start:
            raise ValueError("desired_end must be after desired_start")
        return self


class ReservationPreferredSlotInput(ReservationPreferredSlotBase):
    pass


class ReservationPreferredSlot(ReservationPreferredSlotBase):
    id: UUID
    created_at: datetime


class ReservationStatusEvent(BaseModel):
    status: ReservationStatusLiteral
    changed_at: datetime
    changed_by: Optional[str] = None
    note: Optional[str] = None


class Reservation(BaseModel):
    id: UUID
    status: ReservationStatusLiteral
    shop_id: UUID
    staff_id: Optional[UUID] = None
    menu_id: Optional[UUID] = None
    channel: Optional[str] = None
    desired_start: datetime
    desired_end: datetime
    notes: Optional[str] = None
    customer: ReservationCustomer
    status_history: List[ReservationStatusEvent] = Field(default_factory=list)
    marketing_opt_in: Optional[bool] = None
    created_at: datetime
    updated_at: datetime
    preferred_slots: List[ReservationPreferredSlot] = Field(default_factory=list)


class ReservationCreateRequest(BaseModel):
    shop_id: UUID
    staff_id: Optional[UUID] = None
    menu_id: Optional[UUID] = None
    channel: Optional[str] = None
    desired_start: datetime
    desired_end: datetime
    notes: Optional[str] = None
    customer: ReservationCustomerInput
    marketing_opt_in: Optional[bool] = None
    preferred_slots: Optional[List[ReservationPreferredSlotInput]] = None


class ReservationUpdateRequest(BaseModel):
    status: Optional[ReservationStatusLiteral] = None
    staff_id: Optional[UUID] = None
    notes: Optional[str] = None
    response_message: Optional[str] = None
    keep_customer_contacted: Optional[bool] = None


class ReservationAdminSummary(BaseModel):
    id: UUID
    shop_id: UUID
    shop_name: str
    status: ReservationStatusLiteral
    desired_start: datetime
    desired_end: datetime
    channel: Optional[str] = None
    notes: Optional[str] = None
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ReservationAdminList(BaseModel):
    total: int
    items: list[ReservationAdminSummary]


class ReservationAdminUpdate(BaseModel):
    status: Optional[ReservationStatusLiteral] = None
    notes: Optional[str] = None
