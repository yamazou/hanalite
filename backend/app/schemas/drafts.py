from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DraftStatus(str, Enum):
    registered = "registered"
    approved = "approved"
    cancelled = "cancelled"


class SourceType(str, Enum):
    manual = "manual"
    excel = "excel"
    pdf = "pdf"


class DraftLineCreate(BaseModel):
    item_id: int = Field(gt=0)
    lot: Annotated[str, Field(min_length=1, max_length=50)]
    qty: Decimal = Field(gt=0)
    line_no: int = Field(default=1, ge=1)


class DraftLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inv_receipt_draft_line_id: int
    line_no: int
    item_id: int
    item_nm: str | None = None
    lot: str
    qty: Decimal


class DraftCreate(BaseModel):
    receipt_at: datetime
    suppliers_id: int | None = None
    reference_no: str | None = Field(default=None, max_length=100)
    notes: str | None = None
    lines: list[DraftLineCreate] = Field(default_factory=list)


class DraftRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inv_receipt_draft_id: int
    status: DraftStatus
    receipt_at: datetime
    suppliers_id: int | None
    supplier_nm: str | None = None
    reference_no: str | None
    notes: str | None
    approved_at: datetime | None
    cancelled_at: datetime | None
    created_at: datetime
    source_type: SourceType = SourceType.manual
    attachment_original_name: str | None = None
    has_attachment: bool = False
    parse_message: str | None = None
    lines: list[DraftLineRead] = []


class DraftListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inv_receipt_draft_id: int
    status: DraftStatus
    receipt_at: datetime
    reference_no: str | None
    supplier_nm: str | None = None
    line_count: int
    source_type: SourceType = SourceType.manual
    created_at: datetime


class MessageResponse(BaseModel):
    message: str
    draft_id: int | None = None
