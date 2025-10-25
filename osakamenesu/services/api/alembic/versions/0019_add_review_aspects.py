"""add aspect scores to reviews

Revision ID: 0019_add_review_aspects
Revises: 0018_add_therapist_favorites
Create Date: 2025-04-27 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "0019_add_review_aspects"
down_revision = "0018_add_therapist_favorites"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "reviews",
        sa.Column(
            "aspect_scores",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.alter_column("reviews", "aspect_scores", server_default=None)


def downgrade() -> None:
    op.drop_column("reviews", "aspect_scores")
