from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class CurrentStockItem(BaseModel):
    inv_current_id: int
    item_id: int
    item_nm: str
    itemtyp_nm: str
    lot: str
    qty: Decimal
    updated_at: datetime


class GrgiHistoryItem(BaseModel):
    inv_grgi_id: int
    item_id: int
    item_nm: str
    lot: str
    move_qty: Decimal
    qty: Decimal
    movetyps_nm: str
    actual_at: datetime
    created_at: datetime | None = None


class GrgiCreate(BaseModel):
    item_id: int = Field(gt=0)
    lot: str = Field(min_length=1, max_length=50)
    move_qty: Decimal = Field(gt=0)
    movetyps_id: int = Field(gt=0)
    actual_at: datetime


class MoveTypOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    movetyps_id: int
    movetyps_nm: str


class LotTraceCurrent(BaseModel):
    item_id: int
    item_nm: str
    itemtyp_nm: str
    lot: str
    qty: Decimal
    updated_at: datetime


class LotTraceHistory(BaseModel):
    inv_grgi_id: int
    item_nm: str
    movetyps_nm: str
    move_qty: Decimal
    qty: Decimal
    actual_at: datetime
    created_at: datetime | None


class LotTraceBalance(BaseModel):
    period_year_month: str
    item_nm: str
    lot: str
    beg_at: datetime
    beg_qty: Decimal
    qty: Decimal


class LotTraceResult(BaseModel):
    lot: str
    current: list[LotTraceCurrent]
    history: list[LotTraceHistory]
    balances: list[LotTraceBalance]


class BalanceItem(BaseModel):
    inv_balance_id: int
    period_year_month: str
    item_id: int
    item_nm: str
    lot: str
    beg_at: datetime
    beg_qty: Decimal
    qty: Decimal


class BalanceCreateResult(BaseModel):
    period_year_month: str
    rows_saved: int
