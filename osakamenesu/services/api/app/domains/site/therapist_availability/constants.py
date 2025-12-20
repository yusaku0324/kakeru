"""Constants for therapist availability module."""

ACTIVE_RESERVATION_STATUSES = ("pending", "confirmed", "reserved")

# reserved_until が NULL の場合、created_at からこの時間が経過したら期限切れとみなす
DEFAULT_HOLD_TTL_MINUTES = 15
