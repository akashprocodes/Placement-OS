from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from functools import lru_cache
from typing import List
import os

env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')

class Settings(BaseSettings):
    PROJECT_NAME: str = "Placement OS API"
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"
    YOUTUBE_API_KEY: str = ""
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/placement_os"
    
    # JWT Auth
    JWT_SECRET_KEY: str = "replace-this-with-a-secure-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.FRONTEND_URL.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.ENVIRONMENT.lower() in ("production", "staging"):
            insecure_defaults = {
                "replace-this-with-a-secure-secret",
                "replace-this-with-a-secure-secret-in-production-min-32-chars",
                "secret",
                "changeme",
                "password",
            }
            if self.JWT_SECRET_KEY in insecure_defaults or len(self.JWT_SECRET_KEY) < 32:
                raise ValueError(
                    "JWT_SECRET_KEY must be a cryptographically secure string at least 32 characters long in production"
                )
        return self

    model_config = SettingsConfigDict(env_file=env_path, env_file_encoding="utf-8")

@lru_cache()
def get_settings():
    return Settings()

