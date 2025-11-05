"""Add reservation preferred slots table

Revision ID: 0022_add_reservation_preferred_slots
Revises: 2b1da46b88f9
Create Date: 2025-11-05 16:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '0022_add_reservation_preferred_slots'
down_revision = '2b1da46b88f9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    slot_status_enum = postgresql.ENUM('open', 'tentative', 'blocked', name='reservation_slot_status')
    bind = op.get_bind()
    slot_status_enum.create(bind, checkfirst=True)

    reservation_slot_status = postgresql.ENUM(
        'open',
        'tentative',
        'blocked',
        name='reservation_slot_status',
        create_type=False,
    )

    op.create_table(
        'reservation_preferred_slots',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'reservation_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('reservations.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('desired_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('desired_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', reservation_slot_status, nullable=False, server_default='open'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index(
        op.f('ix_reservation_preferred_slots_reservation_id'),
        'reservation_preferred_slots',
        ['reservation_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_reservation_preferred_slots_status'),
        'reservation_preferred_slots',
        ['status'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_reservation_preferred_slots_status'), table_name='reservation_preferred_slots')
    op.drop_index(op.f('ix_reservation_preferred_slots_reservation_id'), table_name='reservation_preferred_slots')
    op.drop_table('reservation_preferred_slots')

    slot_status_enum = postgresql.ENUM(name='reservation_slot_status')
    slot_status_enum.drop(op.get_bind(), checkfirst=True)
