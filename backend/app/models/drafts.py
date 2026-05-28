from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.masters import Item, Location, Supplier

DraftStatus = Enum("registered", "approved", "cancelled", name="draft_status")
SourceType = Enum("manual", "excel", "pdf", name="source_type")


class InvReceiptDraft(Base):
    __tablename__ = "pch_receipt_draft"

    inv_receipt_draft_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    status: Mapped[str] = mapped_column(DraftStatus, default="registered")
    source_type: Mapped[str] = mapped_column(SourceType, default="manual")
    receipt_at: Mapped[datetime] = mapped_column(DateTime)
    suppliers_id: Mapped[int | None] = mapped_column(ForeignKey("m_suppliers.suppliers_id"), nullable=True)
    reference_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachment_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    attachment_original_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    parse_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    supplier: Mapped["Supplier | None"] = relationship()
    lines: Mapped[list["InvReceiptDraftLine"]] = relationship(back_populates="draft")


class InvReceiptDraftLine(Base):
    __tablename__ = "pch_receipt_draft_lines"

    inv_receipt_draft_line_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inv_receipt_draft_id: Mapped[int] = mapped_column(ForeignKey("pch_receipt_draft.inv_receipt_draft_id"))
    line_no: Mapped[int] = mapped_column(Integer, default=1)
    item_id: Mapped[int | None] = mapped_column(ForeignKey("m_items.item_id"), nullable=True)
    item_cd: Mapped[str | None] = mapped_column(String(50), nullable=True)
    item_nm: Mapped[str | None] = mapped_column(String(200), nullable=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("m_locations.location_id"))
    lot: Mapped[str] = mapped_column(String(50))
    qty: Mapped[Decimal] = mapped_column(Numeric(15, 3))
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    draft: Mapped["InvReceiptDraft"] = relationship(back_populates="lines")
    item: Mapped["Item | None"] = relationship()
    location: Mapped["Location"] = relationship()


class SlsDeliveryDraft(Base):
    __tablename__ = "sls_delivery_draft"

    sls_delivery_draft_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    status: Mapped[str] = mapped_column(DraftStatus, default="registered")
    source_type: Mapped[str] = mapped_column(SourceType, default="manual")
    delivery_at: Mapped[datetime] = mapped_column(DateTime)
    suppliers_id: Mapped[int | None] = mapped_column(ForeignKey("m_suppliers.suppliers_id"), nullable=True)
    reference_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    supplier: Mapped["Supplier | None"] = relationship()
    lines: Mapped[list["SlsDeliveryDraftLine"]] = relationship(back_populates="draft")


class SlsDeliveryDraftLine(Base):
    __tablename__ = "sls_delivery_draft_lines"

    sls_delivery_draft_line_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sls_delivery_draft_id: Mapped[int] = mapped_column(
        ForeignKey("sls_delivery_draft.sls_delivery_draft_id")
    )
    line_no: Mapped[int] = mapped_column(Integer, default=1)
    item_id: Mapped[int | None] = mapped_column(ForeignKey("m_items.item_id"), nullable=True)
    item_cd: Mapped[str | None] = mapped_column(String(50), nullable=True)
    item_nm: Mapped[str | None] = mapped_column(String(200), nullable=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("m_locations.location_id"))
    lot: Mapped[str] = mapped_column(String(50))
    qty: Mapped[Decimal] = mapped_column(Numeric(15, 3))
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    draft: Mapped["SlsDeliveryDraft"] = relationship(back_populates="lines")
    item: Mapped["Item | None"] = relationship()
    location: Mapped["Location"] = relationship()
