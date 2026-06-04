"""Multi-company tenant context and query helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import TypeVar

from sqlalchemy import Select
from sqlalchemy.orm import DeclarativeBase

T = TypeVar("T", bound=DeclarativeBase)


@dataclass(frozen=True)
class TenantContext:
    co_id: int
    user_id: int
    user_cd: str
    company_cd: str


def _now() -> datetime:
    return datetime.now()


def stamp_new(row: object, ctx: TenantContext) -> None:
    if hasattr(row, "co_id"):
        setattr(row, "co_id", ctx.co_id)
    if hasattr(row, "created_by"):
        setattr(row, "created_by", ctx.user_id)
    if hasattr(row, "updated_by"):
        setattr(row, "updated_by", ctx.user_id)
    now = _now()
    if hasattr(row, "created_at") and getattr(row, "created_at", None) is None:
        setattr(row, "created_at", now)
    if hasattr(row, "updated_at"):
        setattr(row, "updated_at", now)


def stamp_update(row: object, ctx: TenantContext) -> None:
    if hasattr(row, "updated_by"):
        setattr(row, "updated_by", ctx.user_id)
    if hasattr(row, "updated_at"):
        setattr(row, "updated_at", _now())


def filter_co(stmt: Select[tuple[T]], model: type[T], ctx: TenantContext) -> Select[tuple[T]]:
    if hasattr(model, "co_id"):
        return stmt.where(model.co_id == ctx.co_id)
    return stmt


def row_belongs_to_tenant(row: object | None, ctx: TenantContext) -> bool:
    if row is None:
        return False
    if not hasattr(row, "co_id"):
        return True
    return getattr(row, "co_id") == ctx.co_id
