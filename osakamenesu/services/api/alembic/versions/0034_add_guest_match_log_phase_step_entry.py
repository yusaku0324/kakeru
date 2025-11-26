"""add phase/step_index/entry_source to guest_match_logs"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0034_add_guest_match_log_phase_step_entry"
down_revision = "0033_merge_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "guest_match_logs", sa.Column("phase", sa.String(length=32), nullable=True)
    )
    op.add_column(
        "guest_match_logs", sa.Column("step_index", sa.Integer(), nullable=True)
    )
    op.add_column(
        "guest_match_logs",
        sa.Column("entry_source", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("guest_match_logs", "entry_source")
    op.drop_column("guest_match_logs", "step_index")
    op.drop_column("guest_match_logs", "phase")
