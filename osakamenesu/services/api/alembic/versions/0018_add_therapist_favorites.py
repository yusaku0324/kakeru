"""add therapist favorites table

Revision ID: 0018_add_therapist_favorites
Revises: 0017_add_session_scope
Create Date: 2025-10-26 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "0018_add_therapist_favorites"
down_revision = "0017_add_session_scope"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    has_table = inspector.has_table("user_therapist_favorites")
    if not has_table:
        op.create_table(
            "user_therapist_favorites",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "therapist_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("therapists.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("NOW()"),
            ),
            sa.UniqueConstraint(
                "user_id",
                "therapist_id",
                name="uq_user_therapist_favorites_user_therapist",
            ),
        )

    refreshed = sa.inspect(bind)
    if refreshed.has_table("user_therapist_favorites"):
        existing_indexes = {ix["name"] for ix in refreshed.get_indexes("user_therapist_favorites")}
    else:
        existing_indexes = set()

    if "ix_user_therapist_favorites_user_id" not in existing_indexes:
        op.create_index(
            "ix_user_therapist_favorites_user_id",
            "user_therapist_favorites",
            ["user_id"],
            unique=False,
        )

    if "ix_user_therapist_favorites_therapist_id" not in existing_indexes:
        op.create_index(
            "ix_user_therapist_favorites_therapist_id",
            "user_therapist_favorites",
            ["therapist_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("user_therapist_favorites"):
        existing_indexes = {ix["name"] for ix in inspector.get_indexes("user_therapist_favorites")}
        if "ix_user_therapist_favorites_therapist_id" in existing_indexes:
            op.drop_index("ix_user_therapist_favorites_therapist_id", table_name="user_therapist_favorites")
        if "ix_user_therapist_favorites_user_id" in existing_indexes:
            op.drop_index("ix_user_therapist_favorites_user_id", table_name="user_therapist_favorites")
        op.drop_table("user_therapist_favorites")
