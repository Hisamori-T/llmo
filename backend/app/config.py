from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = 'production'
    app_url: str = 'https://llmo.fact-ally.com'
    allowed_origins: str = 'https://llmo.fact-ally.com,http://localhost:3000,http://localhost:3001'

    # PostgreSQL (v4.0 — Firestore removed)
    database_url: str = 'postgresql+asyncpg://llmo:llmo_secret@db:5432/llmo'

    # JWT auth (v4.0 — Firebase Auth removed)
    jwt_secret: str = 'change-me-in-production'
    jwt_algorithm: str = 'HS256'
    access_token_ttl: int = 3600        # seconds (1 hour)
    refresh_token_ttl: int = 2592000    # seconds (30 days)

    # LLM
    gemini_api_key: str = ''
    openai_api_key: str = ''            # GPT-4o (v4.0 multi-LLM)
    tavily_api_key: str = ''            # Tavily web search (v4.0)
    google_places_api_key: str = ''

    # Payments
    stripe_api_key: str = ''
    stripe_webhook_secret: str = ''
    stripe_starter_monthly_price_id: str = ''
    stripe_starter_yearly_price_id: str = ''
    stripe_pro_monthly_price_id: str = ''
    stripe_pro_yearly_price_id: str = ''
    stripe_enterprise_monthly_price_id: str = ''
    stripe_enterprise_yearly_price_id: str = ''

    # Notifications
    sendgrid_api_key: str = ''
    from_email: str = 'noreply@llmo.fact-ally.com'
    slack_webhook_url: str = ''
    line_channel_access_token: str = ''  # LINE Messaging API (v4.0)
    line_channel_secret: str = ''

    @property
    def origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(',')]

    class Config:
        env_file = '.env'
        extra = 'ignore'


settings = Settings()
