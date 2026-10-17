from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from functools import lru_cache
from typing import List
import os
import urllib.parse

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
        return [origin.strip().rstrip("/") for origin in self.FRONTEND_URL.split(",") if origin.strip()]

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
        if self.ENVIRONMENT.lower() == "production":
            origins = self.cors_origins
            if not origins:
                raise ValueError(
                    "FRONTEND_URL must be set to your production frontend domain in production"
                )
            for origin in origins:
                parsed = urllib.parse.urlparse(origin)
                if parsed.scheme != "https":
                    raise ValueError(
                        f"FRONTEND_URL origin '{origin}' must use HTTPS in production"
                    )
                hostname = (parsed.hostname or "").lower()
                if not hostname or hostname in ("localhost", "127.0.0.1", "0.0.0.0", "::1") or hostname.endswith(".local"):
                    raise ValueError(
                        f"FRONTEND_URL origin '{origin}' cannot use localhost or loopback addresses in production"
                    )
        return self

    model_config = SettingsConfigDict(env_file=env_path, env_file_encoding="utf-8")

@lru_cache()
def get_settings():
    return Settings()

