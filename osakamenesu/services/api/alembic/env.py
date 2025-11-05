import logging
import os
import sys
from logging.config import fileConfig
from pathlib import Path
from typing import MutableMapping

from alembic import context
from sqlalchemy import Column, MetaData, String, Table, engine_from_config, pool, text

# Alembic config holds values from alembic.ini when the CLI runs this module.
config = context.config
logger = logging.getLogger(__name__)


def _ensure_project_root_on_path() -> None:
    """Allow Alembic to import the application package when run via CLI."""
    root_dir = Path(__file__).resolve().parents[1]
    root_str = str(root_dir)
    if root_str not in sys.path:
        sys.path.insert(0, root_str)


def _configure_logging() -> None:
    config_file = getattr(config, "config_file_name", None)
    if not config_file:
        return

    config_path = Path(config_file)
    if not config_path.is_file():
        return

    try:
        fileConfig(config_file)
    except Exception as exc:
        # Best-effort logging setup; Alembic can continue without it.
        logger.warning("Failed to apply logging config %s: %s", config_file, exc)


_ensure_project_root_on_path()
_configure_logging()

# Import metadata after the application path is available.
from app.models import Base  # type: ignore  # noqa: E402
from app.settings import settings  # type: ignore  # noqa: E402

target_metadata = Base.metadata


def _sync_url(url: str) -> str:
    """Convert async URLs to a sync driver for Alembic engines."""
    if url.startswith("postgresql+asyncpg"):
        return url.replace("postgresql+asyncpg", "postgresql+psycopg2")
    return url


def _database_url() -> str:
    return _sync_url(settings.database_url)


def _configure_context_offline(url: str) -> None:
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        version_table_column_type=String(64),
    )


def run_migrations_offline() -> None:
    _configure_context_offline(_database_url())

    with context.begin_transaction():
        context.run_migrations()


def _configure_sqlalchemy_section() -> MutableMapping[str, str]:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = _database_url()
    schema = os.getenv("ALEMBIC_VERSION_SCHEMA")
    if schema:
        configuration.setdefault("version_table_schema", schema)
    return configuration




def _ensure_version_column_length(connection, *, min_length: int = 64) -> None:
    """Ensure alembic_version.version_num can store longer revision IDs."""
    version_table = config.get_main_option("version_table", "alembic_version")
    schema = config.get_main_option("version_table_schema")
    table_ref = f"{schema}.{version_table}" if schema else version_table

    metadata = MetaData(schema=schema)
    version = Table(
        version_table,
        metadata,
        Column("version_num", String(min_length), nullable=False),
        schema=schema,
    )

    try:
        version.create(connection, checkfirst=True)
        connection.commit()
    except Exception:
        connection.rollback()

    try:
        sql = text(
            "ALTER TABLE {table} ALTER COLUMN version_num TYPE varchar(:length) "
            "USING version_num::varchar(:length)".format(table=table_ref)
        )
        connection.execute(sql, {"length": min_length})
        connection.commit()
    except Exception:
        connection.rollback()

def run_migrations_online() -> None:
    configuration = _configure_sqlalchemy_section()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            version_table_column_type=String(64),
        )

        _ensure_version_column_length(connection)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
