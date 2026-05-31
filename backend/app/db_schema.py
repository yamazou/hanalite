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


def _dedupe_master_codes(
    conn,
    *,
    table: str,
    id_col: str,
    cd_col: str,
    id_prefix: str,
) -> None:
    rows = conn.execute(
        text(
            f"SELECT {id_col}, {cd_col} FROM {table} "
            f"WHERE deleted_at IS NULL AND {cd_col} IS NOT NULL"
        )
    ).fetchall()
    seen: dict[str, int] = {}
    for row in rows:
        rid = int(row[0])
        cd = str(row[1] or "").strip()
        key = cd.lower()
        if not key:
            conn.execute(
                text(f"UPDATE {table} SET {cd_col} = :cd WHERE {id_col} = :id"),
                {"cd": f"{id_prefix}{rid}", "id": rid},
            )
            continue
        if key in seen:
            conn.execute(
                text(f"UPDATE {table} SET {cd_col} = :cd WHERE {id_col} = :id"),
                {"cd": f"{id_prefix}{rid}", "id": rid},
            )
        else:
            seen[key] = rid


def _ensure_master_code_column(
    conn,
    insp,
    *,
    table: str,
    id_col: str,
    cd_col: str,
    nm_col: str,
    uk_name: str,
    id_prefix: str,
) -> None:
    if not insp.has_table(table):
        return
    cols = {c["name"] for c in insp.get_columns(table)}
    if cd_col not in cols:
        conn.execute(
            text(f"ALTER TABLE {table} ADD COLUMN {cd_col} VARCHAR(50) NULL DEFAULT NULL AFTER {id_col}")
        )
        cols.add(cd_col)
    conn.execute(
        text(
            f"UPDATE {table} SET {cd_col} = LEFT(TRIM({nm_col}), 50) "
            f"WHERE ({cd_col} IS NULL OR {cd_col} = '') AND deleted_at IS NULL"
        )
    )
    _dedupe_master_codes(conn, table=table, id_col=id_col, cd_col=cd_col, id_prefix=id_prefix)
    conn.execute(text(f"ALTER TABLE {table} MODIFY COLUMN {cd_col} VARCHAR(50) NOT NULL"))
    uk_rows = conn.execute(
        text(
            """
            SELECT INDEX_NAME FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = :table
              AND INDEX_NAME = :uk
            LIMIT 1
            """
        ),
        {"table": table, "uk": uk_name},
    ).fetchall()
    if not uk_rows:
        conn.execute(text(f"ALTER TABLE {table} ADD UNIQUE KEY {uk_name} ({cd_col})"))


def ensure_supplier_and_customer_codes() -> None:
    insp = inspect(engine)
    with engine.begin() as conn:
        _ensure_master_code_column(
            conn,
            insp,
            table="m_suppliers",
            id_col="suppliers_id",
            cd_col="suppliers_cd",
            nm_col="suppliers_nm",
            uk_name="uk_suppliers_cd",
            id_prefix="SUP",
        )
        _ensure_master_code_column(
            conn,
            insp,
            table="m_customers",
            id_col="customers_id",
            cd_col="customers_cd",
            nm_col="customers_nm",
            uk_name="uk_customers_cd",
            id_prefix="CUS",
        )


def ensure_m_customers_and_item_customer_cols() -> None:
    insp = inspect(engine)
    with engine.begin() as conn:
        if not insp.has_table("m_customers"):
            conn.execute(
                text(
                    """
                    CREATE TABLE m_customers (
                        customers_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                        customers_cd VARCHAR(50) NOT NULL,
                        customers_nm VARCHAR(200) NOT NULL,
                        created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        deleted_at   DATETIME NULL DEFAULT NULL,
                        PRIMARY KEY (customers_id),
                        UNIQUE KEY uk_customers_cd (customers_cd)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """
                )
            )
        if insp.has_table("m_items"):
            cols = {c["name"] for c in insp.get_columns("m_items")}
            if "customer1_id" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE m_items "
                        "ADD COLUMN customer1_id INT UNSIGNED NULL DEFAULT NULL "
                        "AFTER supplier3_id"
                    )
                )
            if "customer2_id" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE m_items "
                        "ADD COLUMN customer2_id INT UNSIGNED NULL DEFAULT NULL "
                        "AFTER customer1_id"
                    )
                )
            cols = {c["name"] for c in insp.get_columns("m_items")}
            if "customer1_id" in cols:
                fk_rows = conn.execute(
                    text(
                        """
                        SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
                        WHERE TABLE_SCHEMA = DATABASE()
                          AND TABLE_NAME = 'm_items'
                          AND CONSTRAINT_NAME = 'fk_items_customer1'
                        """
                    )
                ).fetchall()
                if not fk_rows:
                    conn.execute(
                        text(
                            "ALTER TABLE m_items "
                            "ADD CONSTRAINT fk_items_customer1 "
                            "FOREIGN KEY (customer1_id) REFERENCES m_customers (customers_id)"
                        )
                    )
            if "customer2_id" in cols:
                fk_rows = conn.execute(
                    text(
                        """
                        SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
                        WHERE TABLE_SCHEMA = DATABASE()
                          AND TABLE_NAME = 'm_items'
                          AND CONSTRAINT_NAME = 'fk_items_customer2'
                        """
                    )
                ).fetchall()
                if not fk_rows:
                    conn.execute(
                        text(
                            "ALTER TABLE m_items "
                            "ADD CONSTRAINT fk_items_customer2 "
                            "FOREIGN KEY (customer2_id) REFERENCES m_customers (customers_id)"
                        )
                    )
        count = conn.execute(
            text("SELECT COUNT(*) FROM m_customers WHERE deleted_at IS NULL")
        ).scalar_one()
        if int(count) == 0:
            conn.execute(
                text(
                    """
                    INSERT INTO m_customers (customers_cd, customers_nm, created_at, updated_at)
                    VALUES ('Customer1', 'Customer1', NOW(), NOW()), ('Customer2', 'Customer2', NOW(), NOW())
                    """
                )
            )


def ensure_itemprocs_tables() -> None:
    insp = inspect(engine)
    if insp.has_table("m_itemprocs") and insp.has_table("m_itemproc_inputs"):
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS m_itemprocs (
                    itemproc_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
                    item_id          INT UNSIGNED NOT NULL,
                    line_no          INT UNSIGNED NOT NULL,
                    wip_location_id  INT UNSIGNED NOT NULL,
                    rm_location_id   INT UNSIGNED NOT NULL,
                    output_item_id   INT UNSIGNED NOT NULL,
                    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted_at       DATETIME NULL DEFAULT NULL,
                    PRIMARY KEY (itemproc_id),
                    UNIQUE KEY uk_itemprocs_item_line (item_id, line_no),
                    KEY idx_itemprocs_item (item_id),
                    KEY idx_itemprocs_wip (wip_location_id),
                    KEY idx_itemprocs_rm (rm_location_id),
                    KEY idx_itemprocs_output (output_item_id),
                    CONSTRAINT fk_itemprocs_item FOREIGN KEY (item_id) REFERENCES m_items (item_id),
                    CONSTRAINT fk_itemprocs_wip FOREIGN KEY (wip_location_id) REFERENCES m_locations (location_id),
                    CONSTRAINT fk_itemprocs_rm FOREIGN KEY (rm_location_id) REFERENCES m_locations (location_id),
                    CONSTRAINT fk_itemprocs_output FOREIGN KEY (output_item_id) REFERENCES m_items (item_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS m_itemproc_inputs (
                    itemproc_input_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                    itemproc_id       INT UNSIGNED NOT NULL,
                    input_no          INT UNSIGNED NOT NULL,
                    item_id           INT UNSIGNED NOT NULL,
                    from_location_id  INT UNSIGNED NULL,
                    req_qty           DECIMAL(15, 3) NULL,
                    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted_at        DATETIME NULL DEFAULT NULL,
                    PRIMARY KEY (itemproc_input_id),
                    UNIQUE KEY uk_itemproc_inputs_proc_no (itemproc_id, input_no),
                    KEY idx_itemproc_inputs_item (item_id),
                    KEY idx_itemproc_inputs_from (from_location_id),
                    CONSTRAINT fk_itemproc_inputs_proc FOREIGN KEY (itemproc_id) REFERENCES m_itemprocs (itemproc_id),
                    CONSTRAINT fk_itemproc_inputs_item FOREIGN KEY (item_id) REFERENCES m_items (item_id),
                    CONSTRAINT fk_itemproc_inputs_from FOREIGN KEY (from_location_id) REFERENCES m_locations (location_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
        )


def ensure_itemproc_inputs_from_location_nullable() -> None:
    insp = inspect(engine)
    if not insp.has_table("m_itemproc_inputs"):
        return
    col = next(
        (c for c in insp.get_columns("m_itemproc_inputs") if c["name"] == "from_location_id"),
        None,
    )
    if col is not None and col.get("nullable") is True:
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE m_itemproc_inputs "
                "MODIFY COLUMN from_location_id INT UNSIGNED NULL"
            )
        )


def ensure_itemproc_inputs_req_qty_nullable() -> None:
    insp = inspect(engine)
    if not insp.has_table("m_itemproc_inputs"):
        return
    col = next(
        (c for c in insp.get_columns("m_itemproc_inputs") if c["name"] == "req_qty"),
        None,
    )
    if col is not None and col.get("nullable") is True:
        return
    with engine.begin() as conn:
        conn.execute(
            text("ALTER TABLE m_itemproc_inputs MODIFY COLUMN req_qty DECIMAL(15, 3) NULL")
        )
