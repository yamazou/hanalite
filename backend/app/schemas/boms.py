from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


class BomItemRef(BaseModel):
    """Resolve item by id, code, or name (exact name). One of three required."""

    item_id: int | None = Field(default=None, gt=0)
    item_cd: str | None = Field(default=None, max_length=50)
    item_nm: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def one_ref_required(self):
        if self.item_id or (self.item_cd and self.item_cd.strip()) or (self.item_nm and self.item_nm.strip()):
            return self
        raise ValueError("item_id, item_cd, or item_nm is required.")


class BomOut(BaseModel):
    bom_id: int
    p_item_id: int
    p_item_cd: str
    p_item_nm: str
    c_item_id: int
    c_item_cd: str
    c_item_nm: str
    level: int
    from_location_id: int
    from_location_cd: str
    from_location_nm: str
    to_location_id: int
    to_location_cd: str
    to_location_nm: str
    c_req_qty: Decimal
    created_at: datetime | None = None
    updated_at: datetime | None = None


class BomCreate(BaseModel):
    parent: BomItemRef
    child: BomItemRef
    level: int = Field(default=0, ge=0)
    from_location_id: int = Field(gt=0)
    to_location_id: int = Field(gt=0)
    c_req_qty: Decimal = Field(gt=0)


class BomUpdate(BaseModel):
    parent: BomItemRef | None = None
    child: BomItemRef | None = None
    level: int | None = Field(default=None, ge=0)
    from_location_id: int | None = Field(default=None, gt=0)
    to_location_id: int | None = Field(default=None, gt=0)
    c_req_qty: Decimal | None = Field(default=None, gt=0)
