from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

ProductionStatus = Enum(
    "registered",
    "approved",
    "started",
    "completed",
    "cancelled",
    name="production_status",
)

LineStatus = Enum(
    "planned",
    "completed",
    name="production_line_status",
)

ProductionSourceType = Enum(
    "manual",
    "excel",
    name="prd_source_type",
)


class ProductionOrder(Base):
    __tablename__ = "prd_orders"

    production_order_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    status: Mapped[str] = mapped_column(ProductionStatus, default="registered")
    production_date: Mapped[date] = mapped_column(Date, nullable=False)
    reference_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source_type: Mapped[str] = mapped_column(ProductionSourceType, default="manual")
    parent_item_id: Mapped[int] = mapped_column(ForeignKey("m_items.item_id"))
    planned_qty: Mapped[Decimal] = mapped_column(Numeric(15, 3))
    actual_qty: Mapped[Decimal | None] = mapped_column(Numeric(15, 3), nullable=True)
    lot: Mapped[str] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ProductionOrderLine(Base):
    __tablename__ = "prd_order_lines"

    prd_order_line_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    production_order_id: Mapped[int] = mapped_column(ForeignKey("prd_orders.production_order_id"))
    line_no: Mapped[int] = mapped_column(Integer, default=1)
    rm_location_id: Mapped[int] = mapped_column(ForeignKey("m_locations.location_id"))
    wip_location_id: Mapped[int] = mapped_column(ForeignKey("m_locations.location_id"))
    output_item_id: Mapped[int | None] = mapped_column(ForeignKey("m_items.item_id"), nullable=True)
    planned_qty: Mapped[Decimal | None] = mapped_column(Numeric(15, 3), nullable=True)
    status: Mapped[str] = mapped_column(LineStatus, default="planned")
    actual_qty: Mapped[Decimal | None] = mapped_column(Numeric(15, 3), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ProductionOrderInput(Base):
    __tablename__ = "prd_order_inputs"

    prd_order_input_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    production_order_id: Mapped[int] = mapped_column(ForeignKey("prd_orders.production_order_id"))
    line_no: Mapped[int] = mapped_column(Integer, default=1)
    item_id: Mapped[int] = mapped_column(ForeignKey("m_items.item_id"))
    from_location_id: Mapped[int | None] = mapped_column(
        ForeignKey("m_locations.location_id"), nullable=True
    )
    req_qty: Mapped[Decimal] = mapped_column(Numeric(15, 3))
    consume_qty: Mapped[Decimal] = mapped_column(Numeric(15, 3))
    lot: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ProductionOrderOutput(Base):
    __tablename__ = "prd_order_outputs"

    prd_order_output_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    production_order_id: Mapped[int] = mapped_column(ForeignKey("prd_orders.production_order_id"))
    prd_order_line_id: Mapped[int | None] = mapped_column(
        ForeignKey("prd_order_lines.prd_order_line_id"), nullable=True
    )
    line_no: Mapped[int] = mapped_column(Integer, default=1)
    item_id: Mapped[int] = mapped_column(ForeignKey("m_items.item_id"))
    output_qty: Mapped[Decimal] = mapped_column(Numeric(15, 3))
    location_id: Mapped[int] = mapped_column(ForeignKey("m_locations.location_id"))
    lot: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
