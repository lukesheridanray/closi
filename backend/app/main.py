from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.api import (
    auth as auth_api,
    contacts as contacts_api,
    deals as deals_api,
    pipelines as pipelines_api,
    tasks as tasks_api,
    quotes as quotes_api,
    contracts as contracts_api,
    invoices as invoices_api,
    payments as payments_api,
    activities as activities_api,
    analytics as analytics_api,
    users as users_api,
    organization as organization_api,
    subscriptions as subscriptions_api,
)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url=f"{settings.api_prefix}/docs",
    redoc_url=f"{settings.api_prefix}/redoc",
    openapi_url=f"{settings.api_prefix}/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# ── API Routers ──────────────────────────────────────
app.include_router(auth_api.router, prefix=settings.api_prefix)
app.include_router(contacts_api.router, prefix=settings.api_prefix)
app.include_router(deals_api.router, prefix=settings.api_prefix)
app.include_router(pipelines_api.router, prefix=settings.api_prefix)
app.include_router(tasks_api.router, prefix=settings.api_prefix)
app.include_router(quotes_api.router, prefix=settings.api_prefix)
app.include_router(contracts_api.router, prefix=settings.api_prefix)
app.include_router(invoices_api.router, prefix=settings.api_prefix)
app.include_router(payments_api.router, prefix=settings.api_prefix)
app.include_router(activities_api.router, prefix=settings.api_prefix)
app.include_router(analytics_api.router, prefix=settings.api_prefix)
app.include_router(users_api.router, prefix=settings.api_prefix)
app.include_router(organization_api.router, prefix=settings.api_prefix)
app.include_router(subscriptions_api.router, prefix=settings.api_prefix)
