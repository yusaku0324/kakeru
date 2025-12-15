"""add room_count to profiles

Revision ID: 0044_add_profile_room_count
Revises: 0043_add_guest_reservation_hold_fields
Create Date: 2025-12-15
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0044_add_profile_room_count"
down_revision = "0043_add_guest_reservation_hold_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "profiles",
        sa.Column(
            "room_count",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )


def downgrade() -> None:
    op.drop_column("profiles", "room_count")
