"""add user_id to guest_reservations

Adds user_id foreign key to guest_reservations table to support
authenticated user reservations alongside anonymous guest_token.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "0039_add_user_id_to_guest_reservations"
down_revision = "0038_add_therapist_matching_tags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "guest_reservations",
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_guest_reservations_user_id",
        "guest_reservations",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_guest_reservations_user_id", table_name="guest_reservations")
    op.drop_column("guest_reservations", "user_id")
