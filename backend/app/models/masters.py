from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ItemTyp(Base):
    __tablename__ = "m_itemtyps"

    itemtyp_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    itemtyp_nm: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Supplier(Base):
    __tablename__ = "m_suppliers"

    suppliers_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    suppliers_nm: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Location(Base):
    __tablename__ = "m_locations"

    location_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    location_cd: Mapped[str] = mapped_column(String(50))
    location_nm: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Item(Base):
    __tablename__ = "m_items"

    item_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_cd: Mapped[str] = mapped_column(String(50))
    item_nm: Mapped[str] = mapped_column(String(200))
    itemtyp_id: Mapped[int] = mapped_column(ForeignKey("m_itemtyps.itemtyp_id"))
    supplier1_id: Mapped[int | None] = mapped_column(ForeignKey("m_suppliers.suppliers_id"), nullable=True)
    supplier2_id: Mapped[int | None] = mapped_column(ForeignKey("m_suppliers.suppliers_id"), nullable=True)
    supplier3_id: Mapped[int | None] = mapped_column(ForeignKey("m_suppliers.suppliers_id"), nullable=True)
    supplier4_id: Mapped[int | None] = mapped_column(ForeignKey("m_suppliers.suppliers_id"), nullable=True)
    supplier5_id: Mapped[int | None] = mapped_column(ForeignKey("m_suppliers.suppliers_id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    itemtyp: Mapped["ItemTyp"] = relationship()


class ItemProc(Base):
    __tablename__ = "m_itemprocs"

    itemproc_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("m_items.item_id"))
    process_no: Mapped[int] = mapped_column(Integer)
    process_nm: Mapped[str] = mapped_column(String(100))
    rm_location_id: Mapped[int] = mapped_column(ForeignKey("m_locations.location_id"))
    wip_location_id: Mapped[int] = mapped_column(ForeignKey("m_locations.location_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    item: Mapped["Item"] = relationship(foreign_keys=[item_id])
    rm_location: Mapped["Location"] = relationship(foreign_keys=[rm_location_id])
    wip_location: Mapped["Location"] = relationship(foreign_keys=[wip_location_id])
