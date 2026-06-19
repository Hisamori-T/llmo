from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from models.database import engine, Base
from routers import auth, diagnoses, reports, billing, users
from core.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title='LLMO Score API',
    version='1.0.0',
    docs_url='/docs' if settings.environment == 'development' else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth.router, prefix='/auth', tags=['auth'])
app.include_router(diagnoses.router, prefix='/diagnoses', tags=['diagnoses'])
app.include_router(reports.router, prefix='/reports', tags=['reports'])
app.include_router(billing.router, prefix='/billing', tags=['billing'])
app.include_router(users.router, prefix='/users', tags=['users'])

@app.get('/health')
def health():
    return {'status': 'ok', 'version': '1.0.0'}
