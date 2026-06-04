from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "mysql+pymysql://root:@127.0.0.1:3306/hanalite"
    api_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:5180,http://127.0.0.1:5180"
    app_name: str = "hanalite api"
    upload_dir: str = "uploads/receipts"
    auth_secret: str = "hanalite-dev-auth-secret-change-in-production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def upload_dir_path(self) -> Path:
        p = Path(self.upload_dir)
        if not p.is_absolute():
            p = _BACKEND_ROOT / p
        return p

settings = Settings()
