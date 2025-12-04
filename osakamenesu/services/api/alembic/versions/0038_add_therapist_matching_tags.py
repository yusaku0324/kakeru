"""add matching tags to therapists table

Adds mood_tag, style_tag, look_type, contact_style, talk_level, hobby_tags,
price_rank, and age columns to therapists table for recommendation scoring.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY

# revision identifiers, used by Alembic.
revision = "0038_add_therapist_matching_tags"
down_revision = "0034_add_guest_match_log_phase_step_entry"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add matching tag columns to therapists table
    op.add_column(
        "therapists",
        sa.Column(
            "mood_tag",
            sa.String(length=32),
            nullable=True,
            comment="Mood tag (e.g., gentle, energetic)",
        ),
    )
    op.add_column(
        "therapists",
        sa.Column(
            "style_tag",
            sa.String(length=32),
            nullable=True,
            comment="Service style tag (e.g., soft, firm)",
        ),
    )
    op.add_column(
        "therapists",
        sa.Column(
            "look_type",
            sa.String(length=32),
            nullable=True,
            comment="Appearance type (e.g., cute, elegant)",
        ),
    )
    op.add_column(
        "therapists",
        sa.Column(
            "contact_style",
            sa.String(length=32),
            nullable=True,
            comment="Contact style (e.g., light, deep)",
        ),
    )
    op.add_column(
        "therapists",
        sa.Column(
            "talk_level",
            sa.String(length=32),
            nullable=True,
            comment="Conversation level (e.g., chatty, quiet)",
        ),
    )
    op.add_column(
        "therapists",
        sa.Column(
            "hobby_tags",
            ARRAY(sa.String(length=32)),
            nullable=True,
            comment="Hobby/interest tags",
        ),
    )
    op.add_column(
        "therapists",
        sa.Column(
            "price_rank",
            sa.Integer(),
            nullable=True,
            comment="Price tier (1-5)",
        ),
    )
    op.add_column(
        "therapists",
        sa.Column(
            "age",
            sa.Integer(),
            nullable=True,
            comment="Age for matching",
        ),
    )

    # Create indexes for commonly queried tag columns
    op.create_index("ix_therapists_mood_tag", "therapists", ["mood_tag"])
    op.create_index("ix_therapists_style_tag", "therapists", ["style_tag"])
    op.create_index("ix_therapists_look_type", "therapists", ["look_type"])
    op.create_index("ix_therapists_contact_style", "therapists", ["contact_style"])
    op.create_index("ix_therapists_talk_level", "therapists", ["talk_level"])


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_therapists_talk_level", table_name="therapists")
    op.drop_index("ix_therapists_contact_style", table_name="therapists")
    op.drop_index("ix_therapists_look_type", table_name="therapists")
    op.drop_index("ix_therapists_style_tag", table_name="therapists")
    op.drop_index("ix_therapists_mood_tag", table_name="therapists")

    # Drop columns
    op.drop_column("therapists", "age")
    op.drop_column("therapists", "price_rank")
    op.drop_column("therapists", "hobby_tags")
    op.drop_column("therapists", "talk_level")
    op.drop_column("therapists", "contact_style")
    op.drop_column("therapists", "look_type")
    op.drop_column("therapists", "style_tag")
    op.drop_column("therapists", "mood_tag")
