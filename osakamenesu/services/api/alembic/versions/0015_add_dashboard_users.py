"""Add dashboard users table"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0015_add_dashboard_users"
down_revision = "0014_add_profile_slug"
branch_labels = None
depends_on = None


dashboard_user_status = postgresql.ENUM(
    "pending",
    "active",
    "suspended",
    name="dashboard_user_status",
    create_type=False,
)


def upgrade() -> None:
    op.execute(
        sa.text(
            """
DO $$
BEGIN
    CREATE TYPE dashboard_user_status AS ENUM ('pending', 'active', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;
"""
        )
    )

    op.create_table(
        "dashboard_users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("status", dashboard_user_status, nullable=False, server_default="pending"),
        sa.Column("invited_by", sa.String(length=160), nullable=True),
        sa.Column("invited_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("profile_id", name="uq_dashboard_users_profile"),
        sa.UniqueConstraint("email", name="uq_dashboard_users_email"),
    )
    op.create_index("ix_dashboard_users_profile_id", "dashboard_users", ["profile_id"], unique=False)
    op.create_index("ix_dashboard_users_status", "dashboard_users", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_dashboard_users_status", table_name="dashboard_users")
    op.drop_index("ix_dashboard_users_profile_id", table_name="dashboard_users")
    op.drop_table("dashboard_users")
    op.execute(
        sa.text(
            """
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'dashboard_user_status'
    ) THEN
        DROP TYPE dashboard_user_status;
    END IF;
END $$;
"""
        )
    )
