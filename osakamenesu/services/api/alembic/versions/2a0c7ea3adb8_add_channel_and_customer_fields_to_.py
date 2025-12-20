"""add channel and customer fields to guest_reservations

Revision ID: 2a0c7ea3adb8
Revises: 0046_add_missing_schema_columns
Create Date: 2025-12-21 07:10:50.285981
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2a0c7ea3adb8"
down_revision = "0046_add_missing_schema_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add channel and customer fields to guest_reservations
    op.add_column(
        "guest_reservations", sa.Column("channel", sa.String(length=32), nullable=True)
    )
    op.add_column(
        "guest_reservations",
        sa.Column("customer_name", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "guest_reservations",
        sa.Column("customer_phone", sa.String(length=40), nullable=True),
    )
    op.add_column(
        "guest_reservations",
        sa.Column("customer_email", sa.String(length=160), nullable=True),
    )
    op.create_index(
        op.f("ix_guest_reservations_channel"),
        "guest_reservations",
        ["channel"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_guest_reservations_channel"), table_name="guest_reservations"
    )
    op.drop_column("guest_reservations", "customer_email")
    op.drop_column("guest_reservations", "customer_phone")
    op.drop_column("guest_reservations", "customer_name")
    op.drop_column("guest_reservations", "channel")
