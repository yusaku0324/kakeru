"""add composite indexes to guest_reservations

Revision ID: 0045_add_guest_reservation_indexes
Revises: 0044_add_profile_room_count
Create Date: 2025-12-20
"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "0045_add_guest_reservation_indexes"
down_revision = "0044_add_profile_room_count"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Composite indexes for common query patterns
    op.create_index(
        "ix_guest_reservations_therapist_start",
        "guest_reservations",
        ["therapist_id", "start_at"],
    )
    op.create_index(
        "ix_guest_reservations_shop_start",
        "guest_reservations",
        ["shop_id", "start_at"],
    )
    op.create_index(
        "ix_guest_reservations_status_reserved_until",
        "guest_reservations",
        ["status", "reserved_until"],
    )
    op.create_index(
        "ix_guest_reservations_user_start",
        "guest_reservations",
        ["user_id", "start_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_guest_reservations_user_start", table_name="guest_reservations")
    op.drop_index(
        "ix_guest_reservations_status_reserved_until", table_name="guest_reservations"
    )
    op.drop_index("ix_guest_reservations_shop_start", table_name="guest_reservations")
    op.drop_index(
        "ix_guest_reservations_therapist_start", table_name="guest_reservations"
    )
