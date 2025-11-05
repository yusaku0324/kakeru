"""add log channel option for reservation notifications

Revision ID: 0021_add_log_notification_channel
Revises: 0020_reservation_notif_queue
Create Date: 2025-11-02 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0021_add_log_notification_channel"
down_revision = "0020_reservation_notif_queue"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO reservation_notification_channels (key, label)
        VALUES ('log', 'Log')
        ON CONFLICT (key) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM reservation_notification_channels
        WHERE key = 'log'
        """
    )
