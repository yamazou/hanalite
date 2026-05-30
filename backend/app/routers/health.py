from fastapi import APIRouter, Request
from sqlalchemy import text

from app.database import engine
from app.schemas.masters import ItemTypOut

router = APIRouter(tags=["health"])

# Bump when new route groups are added so stale uvicorn processes are easy to spot.
API_BUILD = "2026-05-29-itemtyp-color"


@router.get("/health")
def health_check(request: Request):
    paths = {getattr(route, "path", "") for route in request.app.routes}
    inventory = any(p.startswith("/api/v1/inventory/") for p in paths)
    masters_write = "/api/v1/masters/items/{item_id}" in paths
    itemtyp_color_api = "itemtyp_color" in ItemTypOut.model_fields

    database = False
    database_error: str | None = None
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        database = True
    except Exception as exc:
        database_error = str(exc)

    return {
        "status": "ok" if database else "degraded",
        "service": "hanalite-api",
        "build": API_BUILD,
        "inventory_api": inventory,
        "masters_write_api": masters_write,
        "itemtyp_color_api": itemtyp_color_api,
        "database": database,
        "database_error": database_error,
    }
