"""Add therapist_shifts table

Revision ID: 0032_add_therapist_shifts_table
Revises: 0031_add_guest_reservations_table
Create Date: 2025-11-26
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0032_add_therapist_shifts_table"
down_revision = "0031_add_guest_reservations_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    therapist_shift_status = postgresql.ENUM(
        "available", "busy", "off", name="therapist_shift_status"
    )
    therapist_shift_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "therapist_shifts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("therapist_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "break_slots", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "availability_status",
            therapist_shift_status,
            nullable=False,
            server_default="available",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.PrimaryKeyConstraint("id", name="pk_therapist_shifts"),
        sa.UniqueConstraint(
            "therapist_id", "start_at", "end_at", name="uq_therapist_shifts_slot"
        ),
    )
    op.create_index(
        "ix_therapist_shifts_therapist_id", "therapist_shifts", ["therapist_id"]
    )
    op.create_index("ix_therapist_shifts_shop_id", "therapist_shifts", ["shop_id"])
    op.create_index("ix_therapist_shifts_date", "therapist_shifts", ["date"])
    op.create_index(
        "ix_therapist_shifts_status", "therapist_shifts", ["availability_status"]
    )


def downgrade() -> None:
    op.drop_index("ix_therapist_shifts_status", table_name="therapist_shifts")
    op.drop_index("ix_therapist_shifts_date", table_name="therapist_shifts")
    op.drop_index("ix_therapist_shifts_shop_id", table_name="therapist_shifts")
    op.drop_index("ix_therapist_shifts_therapist_id", table_name="therapist_shifts")
    op.drop_table("therapist_shifts")
    therapist_shift_status = postgresql.ENUM(
        "available", "busy", "off", name="therapist_shift_status"
    )
    therapist_shift_status.drop(op.get_bind(), checkfirst=True)
