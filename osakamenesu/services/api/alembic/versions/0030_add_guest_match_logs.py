"""add guest_match_logs table"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0030_add_guest_match_logs"
down_revision = "2b1da46b88f9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "guest_match_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("guest_token", sa.String(length=128), nullable=True, index=True),
        sa.Column("area", sa.String(length=80), nullable=True, index=True),
        sa.Column("date", sa.Date(), nullable=True, index=True),
        sa.Column("budget_level", sa.String(length=16), nullable=True),
        sa.Column("mood_pref", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("talk_pref", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("style_pref", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("look_pref", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("free_text", sa.Text(), nullable=True),
        sa.Column("top_matches", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("other_candidates", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("selected_therapist_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("selected_shop_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("selected_slot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_guest_match_logs_created_at", "guest_match_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_guest_match_logs_created_at", table_name="guest_match_logs")
    op.drop_table("guest_match_logs")
