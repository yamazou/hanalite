from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.masters import Item, Location


class Bom(Base):
    __tablename__ = "m_boms"

    bom_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    p_item_id: Mapped[int] = mapped_column(ForeignKey("m_items.item_id"))
    c_item_id: Mapped[int] = mapped_column(ForeignKey("m_items.item_id"))
    location_id: Mapped[int] = mapped_column(ForeignKey("m_locations.location_id"))
    c_req_qty: Mapped[Decimal] = mapped_column(Numeric(15, 3))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    parent_item: Mapped["Item"] = relationship(foreign_keys=[p_item_id])
    child_item: Mapped["Item"] = relationship(foreign_keys=[c_item_id])
    location: Mapped["Location"] = relationship(foreign_keys=[location_id])
