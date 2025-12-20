"""Ops (operations) schemas."""

from .base import BaseModel, Field, List, Optional, datetime


class OpsQueueStats(BaseModel):
    pending: int = Field(ge=0)
    lag_seconds: float = Field(ge=0.0)
    oldest_created_at: Optional[datetime] = None
    next_attempt_at: Optional[datetime] = None


class OpsOutboxChannelSummary(BaseModel):
    channel: str
    pending: int = Field(ge=0)


class OpsOutboxSummary(BaseModel):
    channels: List[OpsOutboxChannelSummary] = Field(default_factory=list)


class OpsSlotsSummary(BaseModel):
    pending_total: int = Field(ge=0)
    pending_stale: int = Field(ge=0)
    confirmed_next_24h: int = Field(ge=0)
    window_start: datetime
    window_end: datetime
