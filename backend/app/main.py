import time

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError

from app.config import settings
from app.deps import TenantContextMiddleware
from app.db_schema import (
    ensure_auth_and_tenant_columns,
    ensure_drop_m_boms_table,
    ensure_itemprocs_tables,
    ensure_itemproc_roots_table,
    ensure_itemproc_inputs_drop_from_location_column,
    ensure_itemproc_inputs_req_qty_nullable,
    ensure_itemprocs_drop_rm_location_column,
    ensure_m_customers_and_item_customer_cols,
    ensure_supplier_and_customer_codes,
    ensure_m_itemtyps_itemtyp_cd,
    ensure_m_itemtyps_itemtyp_color,
    ensure_m_movetyps_cd_nm,
    ensure_m_locationtyps_and_itemtyp_link,
    ensure_m_locations_locationtyp_id,
    ensure_m_items_nullable_itemtyp_id,
    ensure_prd_order_inputs_columns,
    ensure_prd_order_lines_columns,
    ensure_prd_orders_header_columns,
)
from app.routers import auth, delivery_drafts, drafts, health, inventory, item_processes, masters, production


def _run_startup_schema_patches() -> None:
    """Apply lightweight schema patches; retry while MySQL is still starting (e.g. XAMPP boot)."""
    patches = (
        ensure_auth_and_tenant_columns,
        ensure_drop_m_boms_table,
        ensure_m_customers_and_item_customer_cols,
        ensure_supplier_and_customer_codes,
        ensure_itemprocs_tables,
        ensure_itemproc_roots_table,
        ensure_itemproc_inputs_drop_from_location_column,
        ensure_itemproc_inputs_req_qty_nullable,
        ensure_itemprocs_drop_rm_location_column,
        ensure_prd_orders_header_columns,
        ensure_prd_order_lines_columns,
        ensure_prd_order_inputs_columns,
        ensure_m_itemtyps_itemtyp_cd,
        ensure_m_itemtyps_itemtyp_color,
        ensure_m_movetyps_cd_nm,
        ensure_m_locationtyps_and_itemtyp_link,
        ensure_m_locations_locationtyp_id,
        ensure_m_items_nullable_itemtyp_id,
    )
    max_attempts = 30
    delay_seconds = 2.0
    last_error: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            for patch in patches:
                patch()
            return
        except OperationalError as exc:
            last_error = exc
            if attempt >= max_attempts:
                break
            time.sleep(delay_seconds)
    if last_error is not None:
        raise last_error


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _run_startup_schema_patches()
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
app.add_middleware(TenantContextMiddleware)

prefix = settings.api_prefix

app.include_router(health.router, prefix=prefix)
app.include_router(auth.router, prefix=prefix)
app.include_router(auth.protected, prefix=prefix)
app.include_router(drafts.router, prefix=prefix)
app.include_router(delivery_drafts.router, prefix=prefix)
app.include_router(masters.router, prefix=prefix)
app.include_router(item_processes.router, prefix=prefix)
app.include_router(inventory.router, prefix=prefix)
app.include_router(production.router, prefix=prefix)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    """Return the real error message instead of a generic 500 (helps diagnose MySQL vs app bugs)."""
    if isinstance(exc, HTTPException):
        raise exc
    detail = str(exc)
    if "was created in a different Context" in detail:
        detail = "Internal server error. Please retry the request."
    return JSONResponse(status_code=500, content={"detail": detail})


@app.get("/")
def root():
    return {
        "app": settings.app_name,
        "docs": "/docs",
        "api_prefix": settings.api_prefix,
    }
