from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

ProductionStatus = Literal["registered", "approved", "cancelled"]
ProductionLineStatus = Literal["planned", "completed"]


class ProductionOrderInputWrite(BaseModel):
    prd_order_input_id: int | None = None
    item_id: int = Field(gt=0)
    req_qty: Decimal = Field(gt=0)
    consume_qty: Decimal = Field(gt=0)
    lot: str | None = Field(default=None, max_length=50)
    line_no: int | None = Field(default=None, gt=0)


class ProductionOrderCreate(BaseModel):
    parent_item_id: int = Field(gt=0)
    planned_qty: Decimal = Field(gt=0)
    lot: str = Field(min_length=1, max_length=50)
    notes: str | None = None


class ProductionOrderUpdate(BaseModel):
    planned_qty: Decimal | None = Field(default=None, gt=0)
    actual_qty: Decimal | None = Field(default=None, gt=0)
    lot: str | None = Field(default=None, min_length=1, max_length=50)
    notes: str | None = None
    status: ProductionStatus | None = None
    inputs: list[ProductionOrderInputWrite] | None = None


class ProductionOrderRecalculateIn(BaseModel):
    basis_qty: Decimal = Field(gt=0)


class ProductionOrderCompleteLineIn(BaseModel):
    actual_qty: Decimal = Field(gt=0)


class ProductionOrderInputRead(BaseModel):
    prd_order_input_id: int
    line_no: int
    item_id: int
    item_cd: str
    item_nm: str
    req_qty: Decimal
    consume_qty: Decimal
    lot: str | None


class ProductionOrderLineRead(BaseModel):
    prd_order_line_id: int
    line_no: int
    itemproc_id: int
    process_no: int
    process_nm: str
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
