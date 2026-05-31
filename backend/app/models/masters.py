from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ItemTyp(Base):
    __tablename__ = "m_itemtyps"

    itemtyp_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    itemtyp_cd: Mapped[str] = mapped_column(String(50))
    itemtyp_nm: Mapped[str] = mapped_column(String(100))
    itemtyp_color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Supplier(Base):
    __tablename__ = "m_suppliers"

    suppliers_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    suppliers_cd: Mapped[str] = mapped_column(String(50))
    suppliers_nm: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Customer(Base):
    __tablename__ = "m_customers"

    customers_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customers_cd: Mapped[str] = mapped_column(String(50))
    customers_nm: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Location(Base):
    __tablename__ = "m_locations"

    location_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    location_cd: Mapped[str] = mapped_column(String(50))
    location_nm: Mapped[str] = mapped_column(String(200))
    location_type: Mapped[str] = mapped_column(String(20), default="Process")
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
    customer1_id: Mapped[int | None] = mapped_column(ForeignKey("m_customers.customers_id"), nullable=True)
    customer2_id: Mapped[int | None] = mapped_column(ForeignKey("m_customers.customers_id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    itemtyp: Mapped["ItemTyp"] = relationship()


class ItemProc(Base):
    __tablename__ = "m_itemprocs"

    itemproc_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("m_items.item_id"))
    line_no: Mapped[int] = mapped_column(Integer)
    wip_location_id: Mapped[int] = mapped_column(ForeignKey("m_locations.location_id"))
    rm_location_id: Mapped[int] = mapped_column(ForeignKey("m_locations.location_id"))
    output_item_id: Mapped[int] = mapped_column(ForeignKey("m_items.item_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    item: Mapped["Item"] = relationship(foreign_keys=[item_id])
    wip_location: Mapped["Location"] = relationship(foreign_keys=[wip_location_id])
    rm_location: Mapped["Location"] = relationship(foreign_keys=[rm_location_id])
    output_item: Mapped["Item"] = relationship(foreign_keys=[output_item_id])
    inputs: Mapped[list["ItemProcInput"]] = relationship(
        back_populates="itemproc",
        order_by="ItemProcInput.input_no",
    )


class ItemProcInput(Base):
    __tablename__ = "m_itemproc_inputs"

    itemproc_input_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    itemproc_id: Mapped[int] = mapped_column(ForeignKey("m_itemprocs.itemproc_id"))
    input_no: Mapped[int] = mapped_column(Integer)
    item_id: Mapped[int] = mapped_column(ForeignKey("m_items.item_id"))
    from_location_id: Mapped[int | None] = mapped_column(
        ForeignKey("m_locations.location_id"), nullable=True
    )
    req_qty: Mapped[Decimal | None] = mapped_column(Numeric(15, 3), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    itemproc: Mapped["ItemProc"] = relationship(back_populates="inputs")
    item: Mapped["Item"] = relationship(foreign_keys=[item_id])
    from_location: Mapped["Location"] = relationship(foreign_keys=[from_location_id])


