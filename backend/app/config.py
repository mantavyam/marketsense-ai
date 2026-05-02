from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./marketsense.db"
    allowed_origins: str = "http://localhost:3000"

    openrouter_api_key: str = ""
    gnews_api_key: str = ""
    newsapi_key: str = ""

    sentiment_model_name: str = "ProsusAI/finbert"
    transformers_cache: str = ""

    host: str = "0.0.0.0"
    port: int = 8000

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
