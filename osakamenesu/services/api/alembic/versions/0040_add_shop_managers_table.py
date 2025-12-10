"""add shop_managers table

Creates the shop_managers table to associate dashboard users with shops.
Enables authorization checks for dashboard access per shop.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "0040_add_shop_managers_table"
down_revision = "0039_add_user_id_to_guest_reservations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shop_managers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "shop_id",
            UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(32), nullable=False, server_default="owner"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_shop_managers_shop_id", "shop_managers", ["shop_id"])
    op.create_index("ix_shop_managers_user_id", "shop_managers", ["user_id"])
    op.create_unique_constraint(
        "uq_shop_managers_shop_user", "shop_managers", ["shop_id", "user_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_shop_managers_shop_user", "shop_managers", type_="unique")
    op.drop_index("ix_shop_managers_user_id", table_name="shop_managers")
    op.drop_index("ix_shop_managers_shop_id", table_name="shop_managers")
    op.drop_table("shop_managers")
