"""add missing schema columns

Adds columns that were defined in models but missing from migrations:
- profiles.buffer_minutes
- therapists.photo_embedding
- therapists.photo_embedding_computed_at
- therapists.main_photo_index

Revision ID: 0046_add_missing_schema_columns
Revises: 0045_add_guest_reservation_indexes
Create Date: 2025-12-20
"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "0046_add_missing_schema_columns"
down_revision = "0045_add_guest_reservation_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add buffer_minutes to profiles (idempotent)
    op.execute("""
        ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS buffer_minutes INTEGER NOT NULL DEFAULT 0
    """)

    # Add photo_embedding columns to therapists (idempotent)
    op.execute("""
        ALTER TABLE therapists
        ADD COLUMN IF NOT EXISTS photo_embedding double precision[]
    """)
    op.execute("""
        ALTER TABLE therapists
        ADD COLUMN IF NOT EXISTS photo_embedding_computed_at TIMESTAMP WITH TIME ZONE
    """)
    op.execute("""
        ALTER TABLE therapists
        ADD COLUMN IF NOT EXISTS main_photo_index INTEGER DEFAULT 0
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE therapists DROP COLUMN IF EXISTS main_photo_index")
    op.execute(
        "ALTER TABLE therapists DROP COLUMN IF EXISTS photo_embedding_computed_at"
    )
    op.execute("ALTER TABLE therapists DROP COLUMN IF EXISTS photo_embedding")
    op.execute("ALTER TABLE profiles DROP COLUMN IF EXISTS buffer_minutes")
