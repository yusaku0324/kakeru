"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


# Helper: safe enum creation (idempotent)
def create_enum_if_not_exists(name: str, values: tuple[str, ...]):
    # 値のリストをシングルクォート付きで組み立てて、重複作成を避けるヘルパー
    literals = ", ".join([f"'{v}'" for v in values])
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{name}') THEN
                CREATE TYPE {name} AS ENUM ({literals});
            END IF;
        END$$;
        """
    )
    return postgresql.ENUM(*values, name=name, create_type=False)


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
