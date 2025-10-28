"""add reservation notification queue tables

Revision ID: 0020_reservation_notif_queue
Revises: 0019_add_review_aspects
Create Date: 2025-11-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import table, column
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "0020_reservation_notif_queue"
down_revision = "0019_add_review_aspects"
branch_labels = None
depends_on = None


CHANNEL_KEYS = ("email", "slack", "line", "log")
STATUS_KEYS = ("pending", "in_progress", "succeeded", "failed", "cancelled")
ATTEMPT_STATUS_KEYS = ("success", "failure")


def upgrade() -> None:
    op.create_table(
        "reservation_notification_channels",
        sa.Column("key", sa.String(length=32), primary_key=True, nullable=False),
        sa.Column("label", sa.String(length=64), nullable=False),
    )
    op.bulk_insert(
        table(
            "reservation_notification_channels",
            column("key", sa.String),
            column("label", sa.String),
        ),
        [{"key": key, "label": key.capitalize()} for key in CHANNEL_KEYS],
    )

    op.create_table(
        "reservation_notification_statuses",
        sa.Column("key", sa.String(length=32), primary_key=True, nullable=False),
        sa.Column("label", sa.String(length=64), nullable=False),
    )
    op.bulk_insert(
        table(
            "reservation_notification_statuses",
            column("key", sa.String),
            column("label", sa.String),
        ),
        [{"key": key, "label": key.replace("_", " ").capitalize()} for key in STATUS_KEYS],
    )

    op.create_table(
        "reservation_notification_attempt_statuses",
        sa.Column("key", sa.String(length=16), primary_key=True, nullable=False),
        sa.Column("label", sa.String(length=64), nullable=False),
    )
    op.bulk_insert(
        table(
            "reservation_notification_attempt_statuses",
            column("key", sa.String),
            column("label", sa.String),
        ),
        [{"key": key, "label": key.capitalize()} for key in ATTEMPT_STATUS_KEYS],
    )

    op.create_table(
        "reservation_notification_deliveries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "reservation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reservations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "channel",
            sa.String(length=32),
            sa.ForeignKey("reservation_notification_channels.key", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=32),
            sa.ForeignKey("reservation_notification_statuses.key", ondelete="RESTRICT"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )

    op.create_index(
        "ix_reservation_notification_deliveries_reservation_id",
        "reservation_notification_deliveries",
        ["reservation_id"],
        unique=False,
    )
    op.create_index(
        "ix_reservation_notification_deliveries_channel",
        "reservation_notification_deliveries",
        ["channel"],
        unique=False,
    )
    op.create_index(
        "ix_reservation_notification_deliveries_status",
        "reservation_notification_deliveries",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_reservation_notification_deliveries_next_attempt_at",
        "reservation_notification_deliveries",
        ["next_attempt_at"],
        unique=False,
    )

    op.create_table(
        "reservation_notification_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "delivery_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reservation_notification_deliveries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=16),
            sa.ForeignKey("reservation_notification_attempt_statuses.key", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("response_status", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("attempted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    op.create_index(
        "ix_reservation_notification_attempts_delivery_id",
        "reservation_notification_attempts",
        ["delivery_id"],
        unique=False,
    )
    op.create_index(
        "ix_reservation_notification_attempts_status",
        "reservation_notification_attempts",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_reservation_notification_attempts_attempted_at",
        "reservation_notification_attempts",
        ["attempted_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_reservation_notification_attempts_attempted_at",
        table_name="reservation_notification_attempts",
    )
    op.drop_index(
        "ix_reservation_notification_attempts_status",
        table_name="reservation_notification_attempts",
    )
    op.drop_index(
        "ix_reservation_notification_attempts_delivery_id",
        table_name="reservation_notification_attempts",
    )
    op.drop_table("reservation_notification_attempts")

    op.drop_index(
        "ix_reservation_notification_deliveries_next_attempt_at",
        table_name="reservation_notification_deliveries",
    )
    op.drop_index(
        "ix_reservation_notification_deliveries_status",
        table_name="reservation_notification_deliveries",
    )
    op.drop_index(
        "ix_reservation_notification_deliveries_channel",
        table_name="reservation_notification_deliveries",
    )
    op.drop_index(
        "ix_reservation_notification_deliveries_reservation_id",
        table_name="reservation_notification_deliveries",
    )
    op.drop_table("reservation_notification_deliveries")

    op.drop_table("reservation_notification_attempt_statuses")
    op.drop_table("reservation_notification_statuses")
    op.drop_table("reservation_notification_channels")
