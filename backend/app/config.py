from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    environment: str = 'production'
    app_url: str = 'https://llmo.fact-ally.com'
    allowed_origins: str = 'https://llmo.fact-ally.com,http://localhost:3000,http://localhost:3001'

    firebase_project_id: str = ''

    gemini_api_key: str = ''
    google_places_api_key: str = ''

    stripe_api_key: str = ''
    stripe_webhook_secret: str = ''
    stripe_starter_monthly_price_id: str = ''
    stripe_starter_yearly_price_id: str = ''
    stripe_pro_monthly_price_id: str = ''
    stripe_pro_yearly_price_id: str = ''
    stripe_enterprise_monthly_price_id: str = ''
    stripe_enterprise_yearly_price_id: str = ''

    sendgrid_api_key: str = ''
    from_email: str = 'noreply@llmo.fact-ally.com'
    slack_webhook_url: str = ''

    @property
    def origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(',')]

    class Config:
        env_file = '.env'
        extra = 'ignore'


settings = Settings()
