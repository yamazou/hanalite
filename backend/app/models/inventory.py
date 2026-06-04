from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.tenant_mixin import TenantMixin


class MoveTyp(TenantMixin, Base):
    __tablename__ = "m_movetyps"

    movetyps_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    movetyps_cd: Mapped[str] = mapped_column(String(50))
    movetyps_nm: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class InvCurrent(TenantMixin, Base):
    __tablename__ = "inv_currents"

    inv_current_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("m_items.item_id"))
    location_id: Mapped[int] = mapped_column(ForeignKey("m_locations.location_id"))
    qty: Mapped[Decimal] = mapped_column(Numeric(15, 3))
    lot: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class InvBalance(TenantMixin, Base):
    __tablename__ = "inv_balances"

    inv_balance_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    period_year_month: Mapped[str] = mapped_column(String(6))
    item_id: Mapped[int] = mapped_column(ForeignKey("m_items.item_id"))
    location_id: Mapped[int] = mapped_column(ForeignKey("m_locations.location_id"))
    qty: Mapped[Decimal] = mapped_column(Numeric(15, 3))
    lot: Mapped[str] = mapped_column(String(50))
    beg_at: Mapped[datetime] = mapped_column(DateTime)
    beg_qty: Mapped[Decimal] = mapped_column(Numeric(15, 3))
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class InvGrgi(TenantMixin, Base):
    __tablename__ = "inv_grgi"

    inv_grgi_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("m_items.item_id"))
    location_id: Mapped[int] = mapped_column(ForeignKey("m_locations.location_id"))
    qty: Mapped[Decimal] = mapped_column(Numeric(15, 3))
    lot: Mapped[str] = mapped_column(String(50))
    move_qty: Mapped[Decimal] = mapped_column(Numeric(15, 3))
    movetyps_id: Mapped[int] = mapped_column(ForeignKey("m_movetyps.movetyps_id"))
    inv_receipt_draft_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
