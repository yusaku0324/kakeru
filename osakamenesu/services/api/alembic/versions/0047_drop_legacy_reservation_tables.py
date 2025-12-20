"""drop legacy reservation tables

Revision ID: 0047_drop_legacy_reservation_tables
Revises: 2a0c7ea3adb8
Create Date: 2025-12-21 12:00:00.000000

This migration removes the old Reservation model and related tables.
The system has been unified to use GuestReservation for all booking channels.

Tables dropped:
- reservation_notification_attempts
- reservation_notification_deliveries
- reservation_notification_attempt_statuses
- reservation_notification_statuses
- reservation_notification_channels
- reservation_preferred_slots
- reservation_status_events
- reservations

Enum types dropped:
- reservation_status
- reservation_slot_status
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0047_drop_legacy_reservation_tables"
down_revision = "2a0c7ea3adb8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop tables in order of foreign key dependencies

    # First drop the notification attempt table (depends on deliveries and attempt_statuses)
    op.drop_table("reservation_notification_attempts")

    # Drop notification deliveries (depends on reservations, channels, statuses)
    op.drop_table("reservation_notification_deliveries")

    # Drop the notification option tables
    op.drop_table("reservation_notification_attempt_statuses")
    op.drop_table("reservation_notification_statuses")
    op.drop_table("reservation_notification_channels")

    # Drop preferred slots (depends on reservations)
    op.drop_table("reservation_preferred_slots")

    # Drop status events (depends on reservations)
    op.drop_table("reservation_status_events")

    # Drop the main reservations table
    op.drop_table("reservations")

    # Drop the enum types
    sa.Enum(name="reservation_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="reservation_slot_status").drop(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    # This migration is destructive - downgrade would require recreating
    # all the tables with their data, which is not possible.
    # If you need to rollback, restore from a database backup.
    raise NotImplementedError("Downgrade not supported - restore from backup if needed")
