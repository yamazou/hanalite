from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator


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


class LocationTypOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    locationtyp_id: int
    locationtyp_cd: str
    locationtyp_nm: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class LocationTypCreate(BaseModel):
    locationtyp_cd: str = Field(min_length=1, max_length=50)
    locationtyp_nm: str = Field(min_length=1, max_length=100)


class LocationTypUpdate(BaseModel):
    locationtyp_cd: str = Field(min_length=1, max_length=50)
    locationtyp_nm: str = Field(min_length=1, max_length=100)


class ItemTypOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    itemtyp_id: int
    itemtyp_cd: str
    itemtyp_nm: str
    itemtyp_color: str | None = None
    locationtyp_id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ItemTypCreate(BaseModel):
    itemtyp_cd: str = Field(min_length=1, max_length=50)
    itemtyp_nm: str = Field(min_length=1, max_length=100)
    itemtyp_color: str | None = None
    locationtyp_id: int | None = Field(default=None, gt=0)

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
    locationtyp_id: int | None = Field(default=None, gt=0)

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
    updated_at: datetime | None = None


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
    updated_at: datetime | None = None


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
    updated_at: datetime | None = None


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
    locationtyp_id: int | None = None
    locationtyp_cd: str | None = None
    locationtyp_nm: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class LocationCreate(BaseModel):
    location_cd: str = Field(min_length=1, max_length=50)
    location_nm: str = Field(default="", max_length=200)
    locationtyp_id: int | None = Field(default=None, gt=0)


class LocationUpdate(BaseModel):
    location_cd: str = Field(min_length=1, max_length=50)
    location_nm: str = Field(default="", max_length=200)
    locationtyp_id: int | None = Field(default=None, gt=0)


class NumberingElementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    numbering_element_id: int
    numbering_element_cd: str
    numbering_element_nm: str
    element_kind: str
    seq_width: int | None = None
    literal_text: str | None = None
    preview_sample: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class NumberingElementCreate(BaseModel):
    numbering_element_cd: str = Field(min_length=1, max_length=50)
    numbering_element_nm: str = Field(min_length=1, max_length=100)
    element_kind: str = Field(min_length=1, max_length=30)
    seq_width: int | None = Field(default=None, ge=1, le=20)
    literal_text: str | None = Field(default=None, max_length=50)
    preview_sample: str = Field(default="", max_length=20)


class NumberingElementUpdate(BaseModel):
    numbering_element_cd: str = Field(min_length=1, max_length=50)
    numbering_element_nm: str = Field(min_length=1, max_length=100)
    element_kind: str = Field(min_length=1, max_length=30)
    seq_width: int | None = Field(default=None, ge=1, le=20)
    literal_text: str | None = Field(default=None, max_length=50)
    preview_sample: str = Field(default="", max_length=20)


class NumberingPatternOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    numbering_pattern_id: int
    numbering_pattern_cd: str
    numbering_pattern_nm: str
    element_1: str | None = None
    element_2: str | None = None
    element_3: str | None = None
    element_4: str | None = None
    element_5: str | None = None
    element_6: str | None = None
    element_7: str | None = None
    element_8: str | None = None
    element_9: str | None = None
    element_10: str | None = None
    seq_reset_scope: str
    numbering_image: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class NumberingPatternCreate(BaseModel):
    numbering_pattern_cd: str = Field(min_length=1, max_length=50)
    numbering_pattern_nm: str = Field(min_length=1, max_length=100)
    element_1: str | None = Field(default=None, max_length=50)
    element_2: str | None = Field(default=None, max_length=50)
    element_3: str | None = Field(default=None, max_length=50)
    element_4: str | None = Field(default=None, max_length=50)
    element_5: str | None = Field(default=None, max_length=50)
    element_6: str | None = Field(default=None, max_length=50)
    element_7: str | None = Field(default=None, max_length=50)
    element_8: str | None = Field(default=None, max_length=50)
    element_9: str | None = Field(default=None, max_length=50)
    element_10: str | None = Field(default=None, max_length=50)
    seq_reset_scope: str = Field(default="daily")


class NumberingPatternUpdate(BaseModel):
    numbering_pattern_cd: str = Field(min_length=1, max_length=50)
    numbering_pattern_nm: str = Field(min_length=1, max_length=100)
    element_1: str | None = Field(default=None, max_length=50)
    element_2: str | None = Field(default=None, max_length=50)
    element_3: str | None = Field(default=None, max_length=50)
    element_4: str | None = Field(default=None, max_length=50)
    element_5: str | None = Field(default=None, max_length=50)
    element_6: str | None = Field(default=None, max_length=50)
    element_7: str | None = Field(default=None, max_length=50)
    element_8: str | None = Field(default=None, max_length=50)
    element_9: str | None = Field(default=None, max_length=50)
    element_10: str | None = Field(default=None, max_length=50)
    seq_reset_scope: str = Field(default="daily")


class ItemListOut(BaseModel):
    item_id: int
    item_cd: str
    item_nm: str
    itemtyp_id: int | None
    itemtyp_nm: str | None = None
    supplier1_id: int | None = None
    supplier1_nm: str | None = None
    supplier2_id: int | None = None
    supplier3_id: int | None = None
    customer1_id: int | None = None
    customer1_nm: str | None = None
    customer2_id: int | None = None
    customer2_nm: str | None = None
    numbering_pattern_id: int | None = None
    numbering_pattern_cd: str | None = None
    numbering_pattern_nm: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ItemSearchOut(BaseModel):
    """Lightweight row for picker search by item_cd or item_nm."""

    item_id: int
    item_cd: str
    item_nm: str
    itemtyp_id: int | None
    itemtyp_nm: str | None = None


class ItemDetailOut(BaseModel):
    item_id: int
    item_cd: str
    item_nm: str
    itemtyp_id: int | None
    supplier1_id: int | None = None
    supplier2_id: int | None = None
    supplier3_id: int | None = None
    customer1_id: int | None = None
    customer2_id: int | None = None
    numbering_pattern_id: int | None = None


class ItemCreate(BaseModel):
    item_cd: str = Field(min_length=1, max_length=50)
    item_nm: str = Field(default="", max_length=200)
    itemtyp_id: int | None = Field(default=None, gt=0)
    supplier1_id: int | None = None
    supplier2_id: int | None = None
    supplier3_id: int | None = None
    customer1_id: int | None = None
    customer2_id: int | None = None
    numbering_pattern_id: int | None = Field(default=None, gt=0)


class ItemUpdate(BaseModel):
    item_cd: str = Field(min_length=1, max_length=50)
    item_nm: str = Field(default="", max_length=200)
    itemtyp_id: int | None = Field(default=None, gt=0)
    supplier1_id: int | None = None
    supplier2_id: int | None = None
    supplier3_id: int | None = None
    customer1_id: int | None = None
    customer2_id: int | None = None
    numbering_pattern_id: int | None = Field(default=None, gt=0)


