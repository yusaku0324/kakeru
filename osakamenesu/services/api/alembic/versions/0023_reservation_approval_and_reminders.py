"""Add reservation approval decision fields and reminder scheduling

Revision ID: 0023_reservation_approval_and_reminders
Revises: 0022_add_reservation_preferred_slots
Create Date: 2025-11-05 23:40:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '0023_reservation_approval_and_reminders'
down_revision = '0022_add_reservation_preferred_slots'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('reservations', sa.Column('approval_token', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('reservations', sa.Column('approval_token_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('reservations', sa.Column('approval_decision', sa.String(length=16), nullable=True))
    op.add_column('reservations', sa.Column('approval_decided_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('reservations', sa.Column('approval_decided_by', sa.String(length=64), nullable=True))
    op.add_column('reservations', sa.Column('reminder_scheduled_at', sa.DateTime(timezone=True), nullable=True))

    op.create_unique_constraint(op.f('uq_reservations_approval_token'), 'reservations', ['approval_token'])

    op.create_index(op.f('ix_reservations_approval_token_expires_at'), 'reservations', ['approval_token_expires_at'], unique=False)
    op.create_index(op.f('ix_reservations_approval_decision'), 'reservations', ['approval_decision'], unique=False)
    op.create_index(op.f('ix_reservations_reminder_scheduled_at'), 'reservations', ['reminder_scheduled_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_reservations_reminder_scheduled_at'), table_name='reservations')
    op.drop_index(op.f('ix_reservations_approval_decision'), table_name='reservations')
    op.drop_index(op.f('ix_reservations_approval_token_expires_at'), table_name='reservations')
    op.drop_constraint(op.f('uq_reservations_approval_token'), 'reservations', type_='unique')

    op.drop_column('reservations', 'reminder_scheduled_at')
    op.drop_column('reservations', 'approval_decided_by')
    op.drop_column('reservations', 'approval_decided_at')
    op.drop_column('reservations', 'approval_decision')
    op.drop_column('reservations', 'approval_token_expires_at')
    op.drop_column('reservations', 'approval_token')
