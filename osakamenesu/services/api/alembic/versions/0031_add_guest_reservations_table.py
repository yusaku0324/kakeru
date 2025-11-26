"""add guest reservations table

Revision ID: 0031_add_guest_reservations_table
Revises: 0030_add_guest_match_logs
Create Date: 2025-11-26 12:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = "0031_add_guest_reservations_table"
down_revision = "0030_add_guest_match_logs"
branch_labels = None
depends_on = None


def upgrade():
    # Create enum if not exists to avoid duplicate-object errors on reruns
    op.execute(
        """
        DO $$
        BEGIN
            CREATE TYPE guest_reservation_status AS ENUM ('draft', 'pending', 'confirmed', 'cancelled', 'no_show');
        EXCEPTION WHEN duplicate_object THEN NULL; END$$;
        """
    )
    guest_status = postgresql.ENUM(
        "draft",
        "pending",
        "confirmed",
        "cancelled",
        "no_show",
        name="guest_reservation_status",
        create_type=False,
    )

    op.create_table(
        "guest_reservations",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False
        ),
        sa.Column(
            "shop_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "therapist_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("therapists.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("payment_method", sa.String(length=64), nullable=True),
        sa.Column("contact_info", postgresql.JSONB(), nullable=True),
        sa.Column("guest_token", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", guest_status, nullable=False, server_default="pending"),
        sa.Column("base_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "therapist_id",
            "start_at",
            "end_at",
            name="uq_guest_reservations_therapist_slot",
        ),
    )

    op.create_index("ix_guest_reservations_shop_id", "guest_reservations", ["shop_id"])
    op.create_index(
        "ix_guest_reservations_therapist_id", "guest_reservations", ["therapist_id"]
    )
    op.create_index(
        "ix_guest_reservations_start_at", "guest_reservations", ["start_at"]
    )
    op.create_index("ix_guest_reservations_end_at", "guest_reservations", ["end_at"])
    op.create_index("ix_guest_reservations_status", "guest_reservations", ["status"])
    op.create_index(
        "ix_guest_reservations_base_staff_id", "guest_reservations", ["base_staff_id"]
    )


def downgrade():
    op.drop_index(
        "ix_guest_reservations_base_staff_id", table_name="guest_reservations"
    )
    op.drop_index("ix_guest_reservations_status", table_name="guest_reservations")
    op.drop_index("ix_guest_reservations_end_at", table_name="guest_reservations")
    op.drop_index("ix_guest_reservations_start_at", table_name="guest_reservations")
    op.drop_index("ix_guest_reservations_therapist_id", table_name="guest_reservations")
    op.drop_index("ix_guest_reservations_shop_id", table_name="guest_reservations")
    op.drop_table("guest_reservations")
    op.execute("DROP TYPE IF EXISTS guest_reservation_status")
