from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://app:app@osakamenesu-db:5432/osaka_menesu"
    api_origin: str = "http://localhost:3000"
    meili_host: str = "http://osakamenesu-meili:7700"
    meili_master_key: str = "dev_meili_master_key"
    admin_api_key: str = "dev_admin_key"
    rate_limit_redis_url: str | None = None
    rate_limit_namespace: str = "osakamenesu_outlinks"
    rate_limit_redis_error_cooldown: float = 5.0
    init_db_on_startup: bool = True
    slack_webhook_url: str | None = None
    notify_email_endpoint: str | None = None
    notify_line_endpoint: str | None = None
    notify_from_email: str | None = None
    mail_api_key: str | None = None
    mail_from_address: str = "no-reply@osakamenesu.local"
    mail_provider_base_url: str = "https://api.resend.com"
    escalation_pending_threshold_minutes: int = 30
    escalation_check_interval_minutes: int = 5
    auth_magic_link_expire_minutes: int = 15
    auth_magic_link_rate_limit: int = 5
    auth_session_ttl_days: int = 30
    auth_session_cookie_name: str = "osakamenesu_session"
    auth_session_cookie_secure: bool = False
    auth_session_cookie_domain: str | None = None
    auth_magic_link_redirect_path: str = "/auth/complete"
    auth_magic_link_debug: bool = True
    site_base_url: str | None = None

    class Config:
        env_file = ".env"
        env_prefix = ""


settings = Settings()
