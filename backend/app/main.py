from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db_schema import (
    ensure_m_itemtyps_itemtyp_cd,
    ensure_m_itemtyps_itemtyp_color,
    ensure_m_movetyps_cd_nm,
    ensure_prd_order_inputs_columns,
    ensure_prd_order_lines_columns,
    ensure_prd_orders_header_columns,
)
from app.routers import boms, delivery_drafts, drafts, health, inventory, masters, production


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_prd_orders_header_columns()
    ensure_prd_order_lines_columns()
    ensure_prd_order_inputs_columns()
    ensure_m_itemtyps_itemtyp_cd()
    ensure_m_itemtyps_itemtyp_color()
    ensure_m_movetyps_cd_nm()
    yield


app = FastAPI(
    title=settings.app_name,
    description="hanalite lot traceability API — receipt drafts, approval, inventory",
    version="0.1.0",
    lifespan=lifespan,
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
app.include_router(delivery_drafts.router, prefix=prefix)
app.include_router(masters.router, prefix=prefix)
app.include_router(boms.router, prefix=prefix)
app.include_router(inventory.router, prefix=prefix)
app.include_router(production.router, prefix=prefix)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    """Return the real error message instead of a generic 500 (helps diagnose MySQL vs app bugs)."""
    if isinstance(exc, HTTPException):
        raise exc
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.get("/")
def root():
    return {
        "app": settings.app_name,
        "docs": "/docs",
        "api_prefix": settings.api_prefix,
    }
