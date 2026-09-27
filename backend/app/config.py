from pathlib import Path
from typing import List, Optional
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Locate backend directory and load backend/.env into os.environ at startup
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_PATH = _BACKEND_DIR / ".env"
if _ENV_PATH.is_file():
    load_dotenv(dotenv_path=_ENV_PATH)


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

    # LLM Configuration
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=str(_ENV_PATH) if _ENV_PATH.is_file() else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

