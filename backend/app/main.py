from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import boms, drafts, health, inventory, masters

app = FastAPI(
    title=settings.app_name,
    description="hanalite lot traceability API — receipt drafts, approval, inventory",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

prefix = settings.api_prefix

app.include_router(health.router, prefix=prefix)
app.include_router(drafts.router, prefix=prefix)
app.include_router(masters.router, prefix=prefix)
app.include_router(boms.router, prefix=prefix)
app.include_router(inventory.router, prefix=prefix)


@app.get("/")
def root():
    return {
        "app": settings.app_name,
        "docs": "/docs",
        "api_prefix": settings.api_prefix,
    }
