from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ItemProcInputWrite(BaseModel):
    input_no: int = Field(ge=1)
    item_id: int = Field(gt=0)
    from_location_id: int = Field(gt=0)
    req_qty: Decimal = Field(gt=0)


class ItemProcInputRead(BaseModel):
    itemproc_input_id: int
    input_no: int
    item_id: int
    item_cd: str
    item_nm: str
    from_location_id: int
    from_location_cd: str
    from_location_nm: str
    req_qty: Decimal


class ItemProcWrite(BaseModel):
    line_no: int = Field(ge=1)
    wip_location_id: int = Field(gt=0)
    rm_location_id: int = Field(gt=0)
    output_item_id: int = Field(gt=0)
    inputs: list[ItemProcInputWrite] = Field(default_factory=list)


class ItemProcRead(BaseModel):
    itemproc_id: int
    line_no: int
    wip_location_id: int
    wip_location_cd: str
    wip_location_nm: str
    rm_location_id: int
    rm_location_cd: str
    rm_location_nm: str
    output_item_id: int
    output_item_cd: str
    output_item_nm: str
    inputs: list[ItemProcInputRead]
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ItemProcessesOut(BaseModel):
    item_id: int
    item_cd: str
    item_nm: str
    processes: list[ItemProcRead]


class ItemProcessesSave(BaseModel):
    processes: list[ItemProcWrite] = Field(default_factory=list)


class ItemProcessFinalItemRead(BaseModel):
    item_id: int
    item_cd: str
    item_nm: str
    itemtyp_cd: str
    customer_cd: str = ""
