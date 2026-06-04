from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

ProductionStatus = Literal["registered", "approved", "completed"]
ProductionLineStatus = Literal["planned", "completed"]
ProductionSourceType = Literal["manual", "excel"]


class ProductionOrderLineWrite(BaseModel):
    prd_order_line_id: int | None = None
    line_no: int | None = Field(default=None, gt=0)
    rm_location_id: int = Field(gt=0)
    wip_location_id: int = Field(gt=0)
    output_item_id: int = Field(gt=0)
    planned_qty: Decimal = Field(gt=0)
    actual_qty: Decimal | None = Field(default=None, gt=0)


class ProductionOrderInputWrite(BaseModel):
    prd_order_input_id: int | None = None
    item_id: int = Field(gt=0)
    from_location_id: int = Field(gt=0)
    req_qty: Decimal = Field(gt=0)
    consume_qty: Decimal = Field(gt=0)
    lot: str | None = Field(default=None, max_length=50)
    line_no: int | None = Field(default=None, gt=0)


class ProductionOrderCreate(BaseModel):
    production_date: date
    reference_no: str | None = Field(default=None, max_length=100)
    parent_item_id: int = Field(gt=0)
    planned_qty: Decimal = Field(gt=0)
    lot: str = Field(min_length=1, max_length=50)
    notes: str | None = None
    source_type: ProductionSourceType = "manual"


class ProductionOrderUpdate(BaseModel):
    production_date: date | None = None
    reference_no: str | None = Field(default=None, max_length=100)
    parent_item_id: int | None = Field(default=None, gt=0)
    planned_qty: Decimal | None = Field(default=None, gt=0)
    actual_qty: Decimal | None = Field(default=None, gt=0)
    lot: str | None = Field(default=None, min_length=1, max_length=50)
    notes: str | None = None
    status: ProductionStatus | None = None
    lines: list[ProductionOrderLineWrite] | None = None
    inputs: list[ProductionOrderInputWrite] | None = None


class ProductionOrderRecalculateIn(BaseModel):
    basis_qty: Decimal = Field(gt=0)


class ProductionOrderCompleteLineIn(BaseModel):
    actual_qty: Decimal = Field(gt=0)


class ProductionOrderInputRead(BaseModel):
    prd_order_input_id: int
    line_no: int
    level: int
    itemtyp_nm: str
    item_id: int
    item_cd: str
    item_nm: str
    from_location_id: int | None
    from_location_cd: str | None
    from_location_nm: str | None
    req_qty: Decimal
    consume_qty: Decimal
    lot: str | None


class ProductionOrderLineRead(BaseModel):
    prd_order_line_id: int
    line_no: int
    process_no: int
    process_nm: str
    output_item_id: int | None
    output_item_cd: str | None
    output_item_nm: str | None
    planned_qty: Decimal | None
    rm_location_id: int
    rm_location_cd: str
    wip_location_id: int
    wip_location_cd: str
    status: ProductionLineStatus
    actual_qty: Decimal | None
    completed_at: datetime | None


class ProductionOrderOutputRead(BaseModel):
    prd_order_output_id: int
    prd_order_line_id: int | None
    line_no: int
    item_id: int
    item_cd: str
    item_nm: str
    output_qty: Decimal
    location_id: int
    location_cd: str
    location_nm: str
    lot: str


class ProductionOrderListItem(BaseModel):
    production_order_id: int
    status: ProductionStatus
    production_date: date
    reference_no: str | None
    source_type: ProductionSourceType
    parent_item_id: int
    parent_item_cd: str
    parent_item_nm: str
    planned_qty: Decimal
    actual_qty: Decimal | None
    lot: str
    line_count: int
    completed_line_count: int
    created_at: datetime | None
    approved_at: datetime | None
    cancelled_at: datetime | None


class ProductionOrderRead(ProductionOrderListItem):
    notes: str | None
    updated_at: datetime | None
    lines: list[ProductionOrderLineRead]
    inputs: list[ProductionOrderInputRead]
    outputs: list[ProductionOrderOutputRead]


class ProductionExcelImportPreviewRow(BaseModel):
    excel_row: int
    action: Literal["insert", "update"]
    production_order_id: int | None = None
    production_date: date
    reference_no: str | None
    parent_item_id: int
    parent_item_cd: str
    parent_item_nm: str
    planned_qty: Decimal
    lot: str


class ProductionExcelImportResult(BaseModel):
    """Parsed Excel rows for grid merge; persist on client Update (no DB write here)."""

    rows: list[ProductionExcelImportPreviewRow] = []
    errors: list[str] = []


