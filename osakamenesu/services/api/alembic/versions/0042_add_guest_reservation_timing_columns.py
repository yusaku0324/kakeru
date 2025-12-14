"""add timing columns to guest_reservations

Revision ID: 0042_add_guest_reservation_timing_columns
Revises: 0041_add_default_slot_duration
Create Date: 2025-12-14
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0042_add_guest_reservation_timing_columns"
down_revision = "0041_add_default_slot_duration"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "guest_reservations",
        sa.Column(
            "planned_extension_minutes",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "guest_reservations",
        sa.Column(
            "buffer_minutes",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("guest_reservations", "buffer_minutes")
    op.drop_column("guest_reservations", "planned_extension_minutes")
