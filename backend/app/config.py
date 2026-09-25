from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "CodeLens AI"
    API_V1_STR: str = "/api"

    # Database Configuration
    # Uses environment variable DATABASE_URL if set; defaults to standard local PostgreSQL connection
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/codelens_ai"

    # CORS Configuration
    # Allowed local frontend development origins
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
