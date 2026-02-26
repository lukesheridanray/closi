from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.api import auth as auth_api

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
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# ── API Routers ──────────────────────────────────────
app.include_router(auth_api.router, prefix=settings.api_prefix)

# Future routers will be included here as they are built:
# from app.api import contacts, deals, tasks, quotes, contracts,
#     invoices, payments, inventory, pipelines, analytics, integrations, webhooks
#
# app.include_router(contacts.router, prefix=settings.api_prefix)
# ...
