from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

LocationType = Literal["RM", "Process", "NG", "FG"]


def _normalize_itemtyp_color(value: str | None) -> str | None:
    if value is None:
        return None
    s = value.strip()
    if not s:
        return None
    if not s.startswith("#"):
        s = f"#{s}"
    if len(s) != 7:
        raise ValueError("Color must be #RRGGBB")
    int(s[1:], 16)  # validate hex
    return s.upper()


class ItemTypOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    itemtyp_id: int
    itemtyp_cd: str
    itemtyp_nm: str
    itemtyp_color: str | None = None
    created_at: datetime | None = None


class ItemTypCreate(BaseModel):
    itemtyp_cd: str = Field(min_length=1, max_length=50)
    itemtyp_nm: str = Field(min_length=1, max_length=100)
    itemtyp_color: str | None = None

    @field_validator("itemtyp_color", mode="before")
    @classmethod
    def _color(cls, v: object) -> str | None:
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return _normalize_itemtyp_color(str(v))


class ItemTypUpdate(BaseModel):
    itemtyp_cd: str = Field(min_length=1, max_length=50)
    itemtyp_nm: str = Field(min_length=1, max_length=100)
    itemtyp_color: str | None = None

    @field_validator("itemtyp_color", mode="before")
    @classmethod
    def _color(cls, v: object) -> str | None:
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return _normalize_itemtyp_color(str(v))


class SupplierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    suppliers_id: int
    suppliers_cd: str
    suppliers_nm: str
    created_at: datetime | None = None


class SupplierCreate(BaseModel):
    suppliers_cd: str = Field(min_length=1, max_length=50)
    suppliers_nm: str = Field(min_length=1, max_length=200)


class SupplierUpdate(BaseModel):
    suppliers_cd: str = Field(min_length=1, max_length=50)
    suppliers_nm: str = Field(min_length=1, max_length=200)


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    customers_id: int
    customers_cd: str
    customers_nm: str
    created_at: datetime | None = None


class CustomerCreate(BaseModel):
    customers_cd: str = Field(min_length=1, max_length=50)
    customers_nm: str = Field(min_length=1, max_length=200)


class CustomerUpdate(BaseModel):
    customers_cd: str = Field(min_length=1, max_length=50)
    customers_nm: str = Field(min_length=1, max_length=200)


class MoveTypMasterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    movetyps_id: int
    movetyps_cd: str
    movetyps_nm: str | None = None
    created_at: datetime | None = None


class MoveTypCreate(BaseModel):
    movetyps_cd: str = Field(min_length=1, max_length=50)
    movetyps_nm: str | None = Field(default=None, max_length=100)


class MoveTypUpdate(BaseModel):
    movetyps_cd: str = Field(min_length=1, max_length=50)
    movetyps_nm: str | None = Field(default=None, max_length=100)


class LocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    location_id: int
    location_cd: str
    location_nm: str
    location_type: LocationType
    created_at: datetime | None = None


class LocationCreate(BaseModel):
    location_cd: str = Field(min_length=1, max_length=50)
    location_nm: str = Field(default="", max_length=200)
    location_type: LocationType


class LocationUpdate(BaseModel):
    location_cd: str = Field(min_length=1, max_length=50)
    location_nm: str = Field(default="", max_length=200)
    location_type: LocationType


class ItemListOut(BaseModel):
    item_id: int
    item_cd: str
    item_nm: str
    itemtyp_id: int
    itemtyp_nm: str
    supplier1_id: int | None = None
    supplier1_nm: str | None = None
    supplier2_id: int | None = None
    supplier3_id: int | None = None
    customer1_id: int | None = None
    customer1_nm: str | None = None
    customer2_id: int | None = None
    customer2_nm: str | None = None


class ItemSearchOut(BaseModel):
    """Lightweight row for picker search by item_cd or item_nm."""

    item_id: int
    item_cd: str
    item_nm: str
    itemtyp_id: int
    itemtyp_nm: str


class ItemDetailOut(BaseModel):
    item_id: int
    item_cd: str
    item_nm: str
    itemtyp_id: int
    supplier1_id: int | None = None
    supplier2_id: int | None = None
    supplier3_id: int | None = None
    customer1_id: int | None = None
    customer2_id: int | None = None


class ItemCreate(BaseModel):
    item_cd: str = Field(min_length=1, max_length=50)
    item_nm: str = Field(default="", max_length=200)
    itemtyp_id: int = Field(gt=0)
    supplier1_id: int | None = None
    supplier2_id: int | None = None
    supplier3_id: int | None = None
    customer1_id: int | None = None
    customer2_id: int | None = None


class ItemUpdate(BaseModel):
    item_cd: str = Field(min_length=1, max_length=50)
    item_nm: str = Field(default="", max_length=200)
    itemtyp_id: int = Field(gt=0)
    supplier1_id: int | None = None
    supplier2_id: int | None = None
    supplier3_id: int | None = None
    customer1_id: int | None = None
    customer2_id: int | None = None


