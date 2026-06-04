from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column


class TenantMixin:
    co_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
