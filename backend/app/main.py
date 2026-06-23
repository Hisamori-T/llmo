import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.shared.db.postgres import init_db
from app.core.authentication.router import router as auth_router
from app.core.session_management.router import router as session_router
from app.core.user_management.router import router as user_router
from app.core.notification.router import router as notification_router
from app.modules.agency.router import router as agency_router
from app.modules.client.router import router as client_router
from app.modules.keyword.router import router as keyword_router
from app.modules.diagnosis.router import router as diagnosis_router
from app.modules.reporting.router import router as report_router
from app.modules.reporting.share_router import router as share_router
from app.modules.billing.router import router as billing_router
from app.modules.optimization.router import router as optimization_router
from app.modules.content.router import router as content_router
from app.modules.automation.router import router as automation_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 本番は `alembic upgrade head` でマイグレーション済み前提。
    # DEV_AUTO_CREATE=true の場合のみ create_all（開発用使い捨てDB向け）。
    if os.getenv('DEV_AUTO_CREATE', '').lower() == 'true':
        await init_db()
    yield


app = FastAPI(
    title='LLMO Score API',
    version='4.0.0',
    description='B2B AI認知度診断SaaS - 代理店モデル',
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth_router, prefix='/auth')
app.include_router(session_router, prefix='/users')
app.include_router(user_router, prefix='/users')
app.include_router(notification_router, prefix='/notifications')
app.include_router(agency_router, prefix='/agency')
app.include_router(client_router, prefix='/clients')
app.include_router(keyword_router, prefix='/keywords')
app.include_router(diagnosis_router, prefix='/diagnoses')
app.include_router(report_router, prefix='/reports')
app.include_router(share_router, prefix='/share')
app.include_router(billing_router, prefix='/billing')
app.include_router(optimization_router, prefix='/optimizations')
app.include_router(content_router, prefix='/contents')
app.include_router(automation_router, prefix='/automation')


@app.get('/health')
async def health():
    return {'status': 'ok', 'version': '4.0.0'}
