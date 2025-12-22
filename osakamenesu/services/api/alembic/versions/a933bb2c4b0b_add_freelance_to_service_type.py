"""add_freelance_to_service_type

Revision ID: a933bb2c4b0b
Revises: 0047_drop_legacy_reservation_tables
Create Date: 2025-12-22 14:04:14.650535

Add 'freelance' value to service_type enum to support freelance therapists.
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "a933bb2c4b0b"
down_revision = "0047_drop_legacy_reservation_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'freelance' value to service_type enum
    # Using IF NOT EXISTS to make this idempotent
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'freelance'
                AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'service_type')
            ) THEN
                ALTER TYPE service_type ADD VALUE 'freelance';
            END IF;
        END$$;
    """)


def downgrade() -> None:
    # Note: PostgreSQL does not support removing enum values directly.
    # To fully downgrade, you would need to:
    # 1. Create a new enum without 'freelance'
    # 2. Update all columns to use the new enum
    # 3. Drop the old enum
    # For simplicity, we leave this as a no-op warning.
    pass
