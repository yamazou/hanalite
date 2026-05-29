from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DeliveryDraftStatus(str, Enum):
    registered = "registered"
    approved = "approved"
    cancelled = "cancelled"


class DeliverySourceType(str, Enum):
    manual = "manual"
    excel = "excel"


class DeliveryDraftLineCreate(BaseModel):
    item_id: int | None = Field(default=None, gt=0)
    item_cd: str | None = Field(default=None, max_length=50)
    item_nm: str | None = Field(default=None, max_length=200)
    location_id: int | None = Field(default=None, gt=0)
    lot: Annotated[str, Field(min_length=1, max_length=50)]
    qty: Decimal = Field(gt=0)
    line_no: int = Field(default=1, ge=1)

    @model_validator(mode="after")
    def require_item_reference(self) -> "DeliveryDraftLineCreate":
        if self.item_id is None and not (self.item_cd and str(self.item_cd).strip()) and not (
            self.item_nm and str(self.item_nm).strip()
        ):
            raise ValueError("item_id or item_cd/item_nm is required.")
        return self


class DeliveryDraftLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sls_delivery_draft_line_id: int
    line_no: int
    item_id: int | None = None
    item_cd: str | None = None
    item_nm: str | None = None
    itemtyp_id: int | None = None
    location_id: int
    location_cd: str | None = None
    location_nm: str | None = None
    lot: str
    qty: Decimal


class DeliveryDraftLineUpsert(DeliveryDraftLineCreate):
    sls_delivery_draft_line_id: int | None = Field(default=None, gt=0)


class DeliveryDraftCreate(BaseModel):
    delivery_at: datetime
    suppliers_id: int | None = None
    reference_no: str | None = Field(default=None, max_length=100)
    notes: str | None = None
    lines: list[DeliveryDraftLineCreate] = Field(default_factory=list)


class DeliveryDraftUpdate(BaseModel):
    delivery_at: datetime
    suppliers_id: int | None = None
    reference_no: str | None = Field(default=None, max_length=100)
    notes: str | None = None
    lines: list[DeliveryDraftLineUpsert] = Field(default_factory=list)


class DeliveryDraftRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sls_delivery_draft_id: int
    status: DeliveryDraftStatus
    delivery_at: datetime
    suppliers_id: int | None
    supplier_nm: str | None = None
    reference_no: str | None
    notes: str | None
    approved_at: datetime | None
    cancelled_at: datetime | None
    created_at: datetime
    source_type: DeliverySourceType = DeliverySourceType.manual
    lines: list[DeliveryDraftLineRead] = []


class DeliveryDraftListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sls_delivery_draft_id: int
    status: DeliveryDraftStatus
    delivery_at: datetime
    reference_no: str | None
    supplier_nm: str | None = None
    notes: str | None = None
    line_count: int
    source_type: DeliverySourceType = DeliverySourceType.manual
    approved_at: datetime | None = None
    cancelled_at: datetime | None = None
    created_at: datetime
