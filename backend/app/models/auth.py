from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Company(Base):
    __tablename__ = "m_companies"

    co_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_cd: Mapped[str] = mapped_column(String(50))
    company_nm: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column()
    updated_at: Mapped[datetime] = mapped_column()
    deleted_at: Mapped[datetime | None] = mapped_column(nullable=True)

    users: Mapped[list["User"]] = relationship(back_populates="company")


class User(Base):
    __tablename__ = "m_users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    co_id: Mapped[int] = mapped_column(ForeignKey("m_companies.co_id"))
    user_cd: Mapped[str] = mapped_column(String(50))
    user_nm: Mapped[str] = mapped_column(String(200), default="")
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column()
    updated_at: Mapped[datetime] = mapped_column()
    deleted_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_by: Mapped[int | None] = mapped_column(Integer, nullable=True)

    company: Mapped["Company"] = relationship(back_populates="users")
