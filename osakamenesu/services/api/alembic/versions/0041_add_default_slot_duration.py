"""add default_slot_duration_minutes to profiles

Adds default_slot_duration_minutes column to profiles table to allow shops
to customize the duration of booking slots (60, 90, 120 minutes, etc).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0041_add_default_slot_duration"
down_revision = "0040_add_shop_managers_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "profiles",
        sa.Column(
            "default_slot_duration_minutes",
            sa.Integer(),
            nullable=True,
            comment="Default slot duration in minutes (60, 90, 120, etc)",
        ),
    )


def downgrade() -> None:
    op.drop_column("profiles", "default_slot_duration_minutes")
