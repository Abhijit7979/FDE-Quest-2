from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    supabase_url: str = Field(alias="SUPABASE_URL")
    supabase_jwt_secret: str | None = Field(default=None, alias="SUPABASE_JWT_SECRET")
    supabase_anon_key: str = Field(alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: str | None = Field(
        default=None, alias="SUPABASE_SERVICE_ROLE_KEY"
    )

    sketches_bucket: str = Field(default="sketches", alias="SKETCHES_BUCKET")

    llm_provider: str = Field(default="openai", alias="LLM_PROVIDER")
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_vision_model: str = Field(
        default="gpt-4o", alias="OPENAI_VISION_MODEL"
    )

    github_token: str | None = Field(default=None, alias="GITHUB_TOKEN")
    github_models_endpoint: str = Field(
        default="https://models.github.ai/inference",
        alias="GITHUB_MODELS_ENDPOINT",
    )
    github_model: str = Field(
        default="mistral-ai/mistral-medium-2505", alias="GITHUB_MODEL"
    )

    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        alias="CORS_ORIGINS",
    )
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
