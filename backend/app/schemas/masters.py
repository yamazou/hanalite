from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ItemTypOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    itemtyp_id: int
    itemtyp_nm: str
    created_at: datetime | None = None


class ItemTypCreate(BaseModel):
    itemtyp_nm: str = Field(min_length=1, max_length=100)


class SupplierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    suppliers_id: int
    suppliers_nm: str
    created_at: datetime | None = None


class SupplierCreate(BaseModel):
    suppliers_nm: str = Field(min_length=1, max_length=200)


class MoveTypMasterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    movetyps_id: int
    movetyps_nm: str
    created_at: datetime | None = None


class MoveTypCreate(BaseModel):
    movetyps_nm: str = Field(min_length=1, max_length=50)


class LocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    location_id: int
    location_cd: str
    location_nm: str
    created_at: datetime | None = None


class LocationCreate(BaseModel):
    location_cd: str = Field(min_length=1, max_length=50)
    location_nm: str = Field(min_length=1, max_length=200)


class ItemListOut(BaseModel):
    item_id: int
    item_cd: str
    item_nm: str
    itemtyp_id: int
    itemtyp_nm: str
    supplier1_id: int | None = None
    supplier1_nm: str | None = None


class ItemSearchOut(BaseModel):
    """Lightweight row for BOM / picker search by item_cd or item_nm."""

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
    supplier4_id: int | None = None
    supplier5_id: int | None = None


class ItemCreate(BaseModel):
    item_cd: str = Field(min_length=1, max_length=50)
    item_nm: str = Field(min_length=1, max_length=200)
    itemtyp_id: int = Field(gt=0)
    supplier1_id: int | None = None
    supplier2_id: int | None = None
    supplier3_id: int | None = None
    supplier4_id: int | None = None
    supplier5_id: int | None = None


class ItemUpdate(BaseModel):
    item_cd: str = Field(min_length=1, max_length=50)
    item_nm: str = Field(min_length=1, max_length=200)
    itemtyp_id: int = Field(gt=0)
    supplier1_id: int | None = None
    supplier2_id: int | None = None
    supplier3_id: int | None = None
    supplier4_id: int | None = None
    supplier5_id: int | None = None
