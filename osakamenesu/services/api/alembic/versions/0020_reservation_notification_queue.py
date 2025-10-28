"""add reservation notification queue tables

Revision ID: 0020_reservation_notification_queue
Revises: 0019_add_review_aspects
Create Date: 2025-11-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "0020_reservation_notification_queue"
down_revision = "0019_add_review_aspects"
branch_labels = None
depends_on = None


CHANNEL_ENUM_NAME = "reservation_notification_channel"
STATUS_ENUM_NAME = "reservation_notification_status"
ATTEMPT_ENUM_NAME = "reservation_notification_attempt_status"


CHANNEL_ENUM_VALUES = ("email", "slack", "line", "log")
STATUS_ENUM_VALUES = ("pending", "in_progress", "succeeded", "failed", "cancelled")
ATTEMPT_ENUM_VALUES = ("success", "failure")


def _ensure_enum(name: str, *values: str) -> sa.Enum:
    values_sql = ", ".join(f"'{value}'" for value in values)
    op.execute(
        sa.text(
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{name}') THEN
                    CREATE TYPE {name} AS ENUM ({values_sql});
                END IF;
            END
            $$;
            """
        )
    )
    return postgresql.ENUM(*values, name=name, create_type=False, _create_events=False)


def upgrade() -> None:
    channel_enum = _ensure_enum(CHANNEL_ENUM_NAME, *CHANNEL_ENUM_VALUES)
    status_enum = _ensure_enum(STATUS_ENUM_NAME, *STATUS_ENUM_VALUES)
    attempt_enum = _ensure_enum(ATTEMPT_ENUM_NAME, *ATTEMPT_ENUM_VALUES)

    op.create_table(
        "reservation_notification_deliveries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "reservation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reservations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("channel", channel_enum, nullable=False),
        sa.Column("status", status_enum, nullable=False, server_default="pending"),
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
        sa.Column("status", attempt_enum, nullable=False),
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

    op.execute(sa.text(f"DROP TYPE IF EXISTS {ATTEMPT_ENUM_NAME};"))
    op.execute(sa.text(f"DROP TYPE IF EXISTS {STATUS_ENUM_NAME};"))
    op.execute(sa.text(f"DROP TYPE IF EXISTS {CHANNEL_ENUM_NAME};"))
