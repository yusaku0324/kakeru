from pathlib import Path
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="")
    # Async driverを優先して読み込む。ASYNC_DATABASE_URL があれば最優先、無ければ DATABASE_URL。
    database_url: str = Field(
        default="postgresql+asyncpg://app:app@osakamenesu-db:5432/osaka_menesu",
        validation_alias=AliasChoices("ASYNC_DATABASE_URL", "DATABASE_URL"),
    )
    api_origin: str = "http://localhost:3000"
    api_public_base_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "OSAKAMENESU_API_BASE", "API_BASE", "API_PUBLIC_BASE_URL"
        ),
    )
    meili_host: str = "http://osakamenesu-meili:7700"
    meili_master_key: str = "dev_meili_master_key"
    admin_api_key: str = Field(
        default="dev_admin_key",
        validation_alias=AliasChoices(
            "ADMIN_API_KEY", "OSAKAMENESU_ADMIN_API_KEY", "admin_api_key"
        ),
    )
    proxy_shared_secret: str | None = Field(
        default=None, validation_alias=AliasChoices("PROXY_SHARED_SECRET")
    )
    async_worker_token: str | None = Field(
        default=None, validation_alias=AliasChoices("ASYNC_WORKER_TOKEN")
    )
    rate_limit_redis_url: str | None = None
    rate_limit_namespace: str = "osakamenesu_outlinks"
    rate_limit_redis_error_cooldown: float = 5.0
    init_db_on_startup: bool = True
    slack_webhook_url: str | None = None
    notify_email_endpoint: str | None = None
    notify_line_endpoint: str | None = None
    notify_from_email: str | None = None
    mail_api_key: str | None = Field(
        default=None, validation_alias=AliasChoices("MAIL_APIKEY", "MAIL_API_KEY")
    )
    mail_from_address: str = Field(
        default="no-reply@osakamenesu.local",
        validation_alias=AliasChoices("MAIL_FROM_ADDRESS", "MAIL_FROM"),
    )
    mail_provider_base_url: str = Field(
        default="https://api.resend.com",
        validation_alias=AliasChoices("MAIL_PROVIDER_BASE_URL", "RESEND_BASE_URL"),
    )
    escalation_pending_threshold_minutes: int = 30
    escalation_check_interval_minutes: int = 5
    auth_magic_link_expire_minutes: int = 15
    auth_magic_link_rate_limit: int = 5
    auth_session_ttl_days: int = 30
    reservation_notification_max_attempts: int = 5
    reservation_notification_retry_base_seconds: int = 30
    reservation_notification_retry_backoff_multiplier: float = 2.0
    reservation_notification_worker_interval_seconds: float = 1.5
    reservation_notification_batch_size: int = 20
    ops_api_token: str | None = Field(
        default=None, validation_alias=AliasChoices("OPS_API_TOKEN", "OPS_TOKEN")
    )
    cursor_signature_secret: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "CURSOR_SIGNATURE_SECRET", "DASHBOARD_CURSOR_SIGNATURE_SECRET"
        ),
    )
    dashboard_session_cookie_name: str = Field(
        default="osakamenesu_session",
        validation_alias=AliasChoices(
            "AUTH_SESSION_COOKIE_NAME", "DASHBOARD_SESSION_COOKIE_NAME"
        ),
    )
    site_session_cookie_name: str = Field(
        default="osakamenesu_session",
        validation_alias=AliasChoices(
            "SITE_SESSION_COOKIE_NAME", "USER_SESSION_COOKIE_NAME"
        ),
    )
    auth_session_cookie_secure: bool = False
    auth_session_cookie_domain: str | None = None
    auth_session_cookie_same_site: str = Field(
        default="lax",
        validation_alias=AliasChoices(
            "AUTH_SESSION_COOKIE_SAMESITE", "SESSION_COOKIE_SAMESITE"
        ),
    )
    auth_magic_link_redirect_path: str = "/auth/complete"
    auth_magic_link_debug: bool = True
    site_base_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SITE_BASE_URL", "NEXT_PUBLIC_SITE_URL"),
    )
    media_storage_backend: str = Field(
        default="local",
        validation_alias=AliasChoices("MEDIA_STORAGE_BACKEND", "MEDIA_BACKEND"),
    )
    media_local_directory: str = Field(
        default="var/media",
        validation_alias=AliasChoices("MEDIA_LOCAL_DIRECTORY", "MEDIA_LOCAL_DIR"),
    )
    media_url_prefix: str = Field(
        default="/media",
        validation_alias=AliasChoices("MEDIA_URL_PREFIX", "MEDIA_LOCAL_URL_PREFIX"),
    )
    media_cdn_base_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("MEDIA_CDN_BASE_URL", "MEDIA_PUBLIC_BASE_URL"),
    )
    media_s3_bucket: str | None = Field(
        default=None,
        validation_alias=AliasChoices("MEDIA_S3_BUCKET", "MEDIA_BUCKET"),
    )
    media_s3_region: str | None = Field(
        default=None,
        validation_alias=AliasChoices("MEDIA_S3_REGION", "MEDIA_REGION"),
    )
    media_s3_endpoint: str | None = Field(
        default=None,
        validation_alias=AliasChoices("MEDIA_S3_ENDPOINT", "MEDIA_ENDPOINT_URL"),
    )
    media_s3_access_key_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("MEDIA_S3_ACCESS_KEY_ID", "MEDIA_ACCESS_KEY"),
    )
    media_s3_secret_access_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("MEDIA_S3_SECRET_ACCESS_KEY", "MEDIA_SECRET_KEY"),
    )
    sentry_traces_sample_rate: float | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "SENTRY_TRACES_SAMPLE_RATE", "NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE"
        ),
    )
    test_auth_secret: str | None = Field(
        default="secret",
        validation_alias=AliasChoices("E2E_TEST_AUTH_SECRET", "TEST_AUTH_SECRET"),
    )

    @property
    def auth_session_cookie_name(self) -> str:
        """Backward compatibility accessor for dashboard session cookie name."""
        return self.dashboard_session_cookie_name

    @property
    def media_root(self) -> Path:
        """Resolve media storage root directory for local backend."""
        path = Path(self.media_local_directory)
        if not path.is_absolute():
            base = Path(__file__).resolve().parents[2]
            path = base / path
        return path


settings = Settings()
