"""Lightweight schema patches for existing databases (no Alembic)."""

from sqlalchemy import inspect, text

from app.database import engine


def ensure_prd_orders_header_columns() -> None:
    insp = inspect(engine)
    if not insp.has_table("prd_orders"):
        return
    cols = {c["name"] for c in insp.get_columns("prd_orders")}
    with engine.begin() as conn:
        if "production_date" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE prd_orders "
                    "ADD COLUMN production_date DATE NOT NULL "
                    "DEFAULT (CURRENT_DATE) AFTER status"
                )
            )
            cols.add("production_date")
        if "reference_no" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE prd_orders "
                    "ADD COLUMN reference_no VARCHAR(100) NULL DEFAULT NULL "
                    "AFTER production_date"
                )
            )
            cols.add("reference_no")
        if "source_type" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE prd_orders "
                    "ADD COLUMN source_type ENUM('manual', 'excel') NOT NULL DEFAULT 'manual' "
                    "AFTER reference_no"
                )
            )


def ensure_prd_order_lines_columns() -> None:
    insp = inspect(engine)
    if not insp.has_table("prd_order_lines"):
        return
    cols = {c["name"] for c in insp.get_columns("prd_order_lines")}
    with engine.begin() as conn:
        if "output_item_id" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE prd_order_lines "
                    "ADD COLUMN output_item_id INT UNSIGNED NULL "
                    "AFTER wip_location_id"
                )
            )
            cols.add("output_item_id")
        if "planned_qty" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE prd_order_lines "
                    "ADD COLUMN planned_qty DECIMAL(15, 3) NULL "
                    "AFTER output_item_id"
                )
            )


def ensure_prd_order_inputs_columns() -> None:
    insp = inspect(engine)
    if not insp.has_table("prd_order_inputs"):
        return
    cols = {c["name"] for c in insp.get_columns("prd_order_inputs")}
    with engine.begin() as conn:
        if "from_location_id" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE prd_order_inputs "
                    "ADD COLUMN from_location_id INT UNSIGNED NULL "
                    "AFTER item_id"
                )
            )


def ensure_m_itemtyps_itemtyp_cd() -> None:
    insp = inspect(engine)
    if not insp.has_table("m_itemtyps"):
        return
    cols = {c["name"] for c in insp.get_columns("m_itemtyps")}
    if "itemtyp_cd" in cols:
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE m_itemtyps "
                "ADD COLUMN itemtyp_cd VARCHAR(50) NULL AFTER itemtyp_id"
            )
        )
        conn.execute(
            text(
                "UPDATE m_itemtyps SET itemtyp_cd = itemtyp_nm "
                "WHERE itemtyp_cd IS NULL OR TRIM(itemtyp_cd) = ''"
            )
        )
        conn.execute(
            text("ALTER TABLE m_itemtyps MODIFY COLUMN itemtyp_cd VARCHAR(50) NOT NULL")
        )


def ensure_m_movetyps_cd_nm() -> None:
    insp = inspect(engine)
    if not insp.has_table("m_movetyps"):
        return
    cols = {c["name"] for c in insp.get_columns("m_movetyps")}
    with engine.begin() as conn:
        if "movetyps_cd" not in cols and "movetyps_nm" in cols:
            conn.execute(
                text(
                    "ALTER TABLE m_movetyps "
                    "CHANGE COLUMN movetyps_nm movetyps_cd VARCHAR(50) NOT NULL"
                )
            )
            cols.discard("movetyps_nm")
            cols.add("movetyps_cd")
        if "movetyps_nm" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE m_movetyps "
                    "ADD COLUMN movetyps_nm VARCHAR(100) NULL DEFAULT NULL "
                    "AFTER movetyps_cd"
                )
            )


def ensure_m_itemtyps_itemtyp_color() -> None:
    insp = inspect(engine)
    if not insp.has_table("m_itemtyps"):
        return
    cols = {c["name"] for c in insp.get_columns("m_itemtyps")}
    if "itemtyp_color" in cols:
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE m_itemtyps "
                "ADD COLUMN itemtyp_color VARCHAR(7) NULL DEFAULT NULL "
                "AFTER itemtyp_nm"
            )
        )
