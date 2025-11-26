"""merge heads reservations and shifts

Revision ID: 0033_merge_heads
Revises: 0023_reservation_approval_and_reminders, 0032_add_therapist_shifts_table
Create Date: 2025-11-26 11:00:00
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0033_merge_heads"
down_revision = (
    "0023_reservation_approval_and_reminders",
    "0032_add_therapist_shifts_table",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No-op merge migration to unify heads.
    pass


def downgrade() -> None:
    # No-op downgrade.
    pass
