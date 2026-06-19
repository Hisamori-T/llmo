from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    database_url: str = 'postgresql+asyncpg://postgres:secure_password_123@127.0.0.1:5432/llmo_db'
    jwt_secret: str = 'change-this-secret'
    environment: str = 'production'

    firebase_project_id: str = ''
    firebase_private_key_id: str = ''
    firebase_private_key: str = ''
    firebase_client_email: str = ''
    firebase_client_id: str = ''

    stripe_api_key: str = ''
    stripe_webhook_secret: str = ''
    stripe_starter_monthly_price_id: str = ''
    stripe_starter_yearly_price_id: str = ''
    stripe_pro_monthly_price_id: str = ''
    stripe_pro_yearly_price_id: str = ''
    stripe_enterprise_monthly_price_id: str = ''
    stripe_enterprise_yearly_price_id: str = ''

    claude_api_key: str = ''
    sendgrid_api_key: str = ''
    from_email: str = 'noreply@llmo.fact-ally.com'
    app_url: str = 'https://llmo.fact-ally.com'
    api_url: str = 'https://api.llmo.fact-ally.com'

    allowed_origins: str = 'https://llmo.fact-ally.com,http://localhost:3000'

    @property
    def origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(',')]

    class Config:
        env_file = '.env'

settings = Settings()
