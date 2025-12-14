"""add hold fields to guest_reservations

Revision ID: 0043_add_guest_reservation_hold_fields
Revises: 0042_add_guest_reservation_timing_columns
Create Date: 2025-12-14
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0043_add_guest_reservation_hold_fields"
down_revision = "0042_add_guest_reservation_timing_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Postgres enum values are append-only. Add new values idempotently.
    op.execute(
        """
        DO $$
        BEGIN
            ALTER TYPE guest_reservation_status ADD VALUE 'reserved';
        EXCEPTION WHEN duplicate_object THEN NULL; END$$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            ALTER TYPE guest_reservation_status ADD VALUE 'expired';
        EXCEPTION WHEN duplicate_object THEN NULL; END$$;
        """
    )

    op.add_column(
        "guest_reservations",
        sa.Column("reserved_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "guest_reservations",
        sa.Column("idempotency_key", sa.String(length=255), nullable=True),
    )
    op.create_index(
        "ux_guest_reservations_idempotency_key",
        "guest_reservations",
        ["idempotency_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ux_guest_reservations_idempotency_key",
        table_name="guest_reservations",
    )
    op.drop_column("guest_reservations", "idempotency_key")
    op.drop_column("guest_reservations", "reserved_until")
    # NOTE: Postgres enum values cannot be removed safely in a downgrade.
