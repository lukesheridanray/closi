from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "LSRV CRM"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # Database
    database_url: str = "postgresql+asyncpg://lsrv:lsrv@localhost:5432/lsrv"
    database_url_sync: str = "postgresql://lsrv:lsrv@localhost:5432/lsrv"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # CORS - comma-separated string (e.g. "https://foo.com,https://bar.com" or "*")
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    # Email (Resend)
    resend_api_key: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""

    # Authorize.net
    authnet_api_login_id: str = ""
    authnet_transaction_key: str = ""
    authnet_signature_key: str = ""
    authnet_environment: str = "sandbox"  # sandbox | production

    # File Storage (Cloudflare R2 / S3-compatible)
    s3_endpoint_url: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_bucket_name: str = "lsrv"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
