"""merge heads reservations and shifts

Revision ID: 0033_merge_heads
Revises: 0032_add_therapist_shifts_table
Create Date: 2025-11-26 11:00:00

Note: This was a merge migration. Now it's just a continuation since
0030 was rebased to follow 0023 directly (fixing therapists table dependency).
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0033_merge_heads"
# Changed: no longer a merge - 0030→0031→0032 now follows 0023 linearly
down_revision = "0032_add_therapist_shifts_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No-op merge migration to unify heads.
    pass


def downgrade() -> None:
    # No-op downgrade.
    pass
