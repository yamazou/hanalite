"""Lightweight schema patches for existing databases (no Alembic)."""

from sqlalchemy import inspect, text

from app.database import engine


def ensure_drop_m_boms_table() -> None:
    """BOM feature retired: remove legacy table if still present."""
    insp = inspect(engine)
    if not insp.has_table("m_boms"):
        return
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS m_boms"))


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


_DEFAULT_LOCATIONTYPS = (
    ("RM", "Raw Material"),
    ("Process", "Process"),
    ("NG", "NG"),
    ("FG", "Finished Goods"),
)


def _archive_soft_deleted_locationtyp_codes(conn) -> None:
    """Free unique codes held by soft-deleted rows (legacy deletes before code archival)."""
    conn.execute(
        text(
            """
            UPDATE m_locationtyps t
            SET t.locationtyp_cd = CONCAT(
                    LEFT(
                        t.locationtyp_cd,
                        GREATEST(1, 50 - CHAR_LENGTH(t.locationtyp_id) - 1)
                    ),
                    '~',
                    t.locationtyp_id
                ),
                t.updated_at = NOW()
            WHERE t.deleted_at IS NOT NULL
              AND t.locationtyp_cd NOT LIKE '%~%'
            """
        )
    )


def _seed_default_locationtyps(conn) -> None:
    _archive_soft_deleted_locationtyp_codes(conn)
    now_sql = "NOW()"
    for cd, nm in _DEFAULT_LOCATIONTYPS:
        conn.execute(
            text(
                f"""
                INSERT INTO m_locationtyps (locationtyp_cd, locationtyp_nm, created_at, updated_at)
                SELECT :cd, :nm, {now_sql}, {now_sql}
                FROM DUAL
                WHERE NOT EXISTS (
                    SELECT 1 FROM m_locationtyps
                    WHERE locationtyp_cd = :cd
                )
                """
            ),
            {"cd": cd, "nm": nm},
        )


def ensure_m_locations_locationtyp_id() -> None:
    insp = inspect(engine)
    with engine.begin() as conn:
        if not insp.has_table("m_locationtyps"):
            conn.execute(
                text(
                    """
                    CREATE TABLE m_locationtyps (
                        locationtyp_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                        locationtyp_cd VARCHAR(50) NOT NULL,
                        locationtyp_nm VARCHAR(100) NOT NULL,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        deleted_at DATETIME NULL DEFAULT NULL,
                        PRIMARY KEY (locationtyp_id),
                        UNIQUE KEY uk_locationtyps_cd (locationtyp_cd)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """
                )
            )
        _seed_default_locationtyps(conn)

        if not insp.has_table("m_locations"):
            return

        cols = {c["name"] for c in insp.get_columns("m_locations")}
        if "locationtyp_id" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE m_locations "
                    "ADD COLUMN locationtyp_id INT UNSIGNED NULL DEFAULT NULL "
                    "AFTER location_nm"
                )
            )
            cols.add("locationtyp_id")

        if "location_type" in cols:
            for old_cd, _ in _DEFAULT_LOCATIONTYPS:
                conn.execute(
                    text(
                        """
                        UPDATE m_locations l
                        INNER JOIN m_locationtyps t
                            ON t.deleted_at IS NULL AND t.locationtyp_cd = :old_cd
                        SET l.locationtyp_id = t.locationtyp_id
                        WHERE l.deleted_at IS NULL
                          AND l.location_type = :old_cd
                          AND (l.locationtyp_id IS NULL OR l.locationtyp_id = 0)
                        """
                    ),
                    {"old_cd": old_cd},
                )
            conn.execute(
                text(
                    """
                    UPDATE m_locations l
                    INNER JOIN m_locationtyps t
                        ON t.deleted_at IS NULL AND t.locationtyp_cd = 'Process'
                    SET l.locationtyp_id = t.locationtyp_id
                    WHERE l.deleted_at IS NULL
                      AND (l.locationtyp_id IS NULL OR l.locationtyp_id = 0)
                    """
                )
            )
            conn.execute(text("ALTER TABLE m_locations DROP COLUMN location_type"))
            cols.discard("location_type")

        fks = {fk["name"] for fk in insp.get_foreign_keys("m_locations")}
        if "fk_locations_locationtyp" not in fks and "locationtyp_id" in cols:
            conn.execute(
                text(
                    "ALTER TABLE m_locations "
                    "ADD CONSTRAINT fk_locations_locationtyp "
                    "FOREIGN KEY (locationtyp_id) REFERENCES m_locationtyps (locationtyp_id)"
                )
            )


def ensure_m_locationtyps_and_itemtyp_link() -> None:
    insp = inspect(engine)
    with engine.begin() as conn:
        if not insp.has_table("m_locationtyps"):
            conn.execute(
                text(
                    """
                    CREATE TABLE m_locationtyps (
                        locationtyp_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                        locationtyp_cd VARCHAR(50) NOT NULL,
                        locationtyp_nm VARCHAR(100) NOT NULL,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        deleted_at DATETIME NULL DEFAULT NULL,
                        PRIMARY KEY (locationtyp_id),
                        UNIQUE KEY uk_locationtyps_cd (locationtyp_cd)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """
                )
            )
        if not insp.has_table("m_itemtyps"):
            return
        cols = {c["name"] for c in insp.get_columns("m_itemtyps")}
        if "locationtyp_id" not in cols:
            after = "itemtyp_color" if "itemtyp_color" in cols else "itemtyp_nm"
            conn.execute(
                text(
                    f"ALTER TABLE m_itemtyps "
                    f"ADD COLUMN locationtyp_id INT UNSIGNED NULL DEFAULT NULL AFTER {after}"
                )
            )
            cols.add("locationtyp_id")
        fks = {fk["name"] for fk in insp.get_foreign_keys("m_itemtyps")}
        if "fk_itemtyps_locationtyp" not in fks and "locationtyp_id" in cols:
            conn.execute(
                text(
                    "ALTER TABLE m_itemtyps "
                    "ADD CONSTRAINT fk_itemtyps_locationtyp "
                    "FOREIGN KEY (locationtyp_id) REFERENCES m_locationtyps (locationtyp_id)"
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
                    output_item_id   INT UNSIGNED NOT NULL,
                    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted_at       DATETIME NULL DEFAULT NULL,
                    PRIMARY KEY (itemproc_id),
                    UNIQUE KEY uk_itemprocs_item_line (item_id, line_no),
                    KEY idx_itemprocs_item (item_id),
                    KEY idx_itemprocs_wip (wip_location_id),
                    KEY idx_itemprocs_output (output_item_id),
                    CONSTRAINT fk_itemprocs_item FOREIGN KEY (item_id) REFERENCES m_items (item_id),
                    CONSTRAINT fk_itemprocs_wip FOREIGN KEY (wip_location_id) REFERENCES m_locations (location_id),
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
                    req_qty           DECIMAL(15, 3) NULL,
                    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted_at        DATETIME NULL DEFAULT NULL,
                    PRIMARY KEY (itemproc_input_id),
                    UNIQUE KEY uk_itemproc_inputs_proc_no (itemproc_id, input_no),
                    KEY idx_itemproc_inputs_item (item_id),
                    CONSTRAINT fk_itemproc_inputs_proc FOREIGN KEY (itemproc_id) REFERENCES m_itemprocs (itemproc_id),
                    CONSTRAINT fk_itemproc_inputs_item FOREIGN KEY (item_id) REFERENCES m_items (item_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
        )


def ensure_itemproc_roots_table() -> None:
    insp = inspect(engine)
    if insp.has_table("m_itemproc_roots"):
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS m_itemproc_roots (
                    item_id    INT UNSIGNED NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (item_id),
                    CONSTRAINT fk_itemproc_roots_item FOREIGN KEY (item_id) REFERENCES m_items (item_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT IGNORE INTO m_itemproc_roots (item_id, created_at)
                SELECT DISTINCT item_id, NOW()
                FROM m_itemprocs
                WHERE deleted_at IS NULL
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


def ensure_itemprocs_drop_rm_location_column() -> None:
    """RM issue location is derived from Location type RM, not stored on m_itemprocs."""
    insp = inspect(engine)
    if not insp.has_table("m_itemprocs"):
        return
    cols = {c["name"] for c in insp.get_columns("m_itemprocs")}
    if "rm_location_id" not in cols:
        return
    with engine.begin() as conn:
        fk_name = conn.execute(
            text(
                """
                SELECT CONSTRAINT_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'm_itemprocs'
                  AND COLUMN_NAME = 'rm_location_id'
                  AND REFERENCED_TABLE_NAME IS NOT NULL
                LIMIT 1
                """
            )
        ).scalar_one_or_none()
        if fk_name:
            conn.execute(text(f"ALTER TABLE m_itemprocs DROP FOREIGN KEY `{fk_name}`"))
        idx_name = conn.execute(
            text(
                """
                SELECT INDEX_NAME
                FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'm_itemprocs'
                  AND COLUMN_NAME = 'rm_location_id'
                  AND INDEX_NAME != 'PRIMARY'
                LIMIT 1
                """
            )
        ).scalar_one_or_none()
        if idx_name:
            conn.execute(text(f"ALTER TABLE m_itemprocs DROP INDEX `{idx_name}`"))
        conn.execute(text("ALTER TABLE m_itemprocs DROP COLUMN rm_location_id"))


def ensure_itemproc_inputs_drop_from_location_column() -> None:
    """Issue location for inputs is derived (RM / previous WIP), not stored on m_itemproc_inputs."""
    insp = inspect(engine)
    if not insp.has_table("m_itemproc_inputs"):
        return
    cols = {c["name"] for c in insp.get_columns("m_itemproc_inputs")}
    if "from_location_id" not in cols:
        return
    with engine.begin() as conn:
        fk_name = conn.execute(
            text(
                """
                SELECT CONSTRAINT_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'm_itemproc_inputs'
                  AND COLUMN_NAME = 'from_location_id'
                  AND REFERENCED_TABLE_NAME IS NOT NULL
                LIMIT 1
                """
            )
        ).scalar_one_or_none()
        if fk_name:
            conn.execute(text(f"ALTER TABLE m_itemproc_inputs DROP FOREIGN KEY `{fk_name}`"))
        idx_name = conn.execute(
            text(
                """
                SELECT INDEX_NAME
                FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'm_itemproc_inputs'
                  AND COLUMN_NAME = 'from_location_id'
                  AND INDEX_NAME != 'PRIMARY'
                LIMIT 1
                """
            )
        ).scalar_one_or_none()
        if idx_name:
            conn.execute(text(f"ALTER TABLE m_itemproc_inputs DROP INDEX `{idx_name}`"))
        conn.execute(text("ALTER TABLE m_itemproc_inputs DROP COLUMN from_location_id"))


def ensure_m_items_nullable_itemtyp_id() -> None:
    """Allow items without an item type (e.g. Item Process Excel import)."""
    insp = inspect(engine)
    if not insp.has_table("m_items"):
        return
    cols = {c["name"]: c for c in insp.get_columns("m_items")}
    itemtyp_col = cols.get("itemtyp_id")
    if not itemtyp_col or itemtyp_col.get("nullable"):
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE m_items MODIFY COLUMN itemtyp_id INT UNSIGNED NULL"
            )
        )


def ensure_numbering_masters() -> None:
    """Numbering Elements / Patterns masters and item link."""
    insp = inspect(engine)
    with engine.begin() as conn:
        if not insp.has_table("m_numbering_elements"):
            conn.execute(
                text(
                    """
                    CREATE TABLE m_numbering_elements (
                        numbering_element_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                        numbering_element_cd VARCHAR(50) NOT NULL,
                        numbering_element_nm VARCHAR(100) NOT NULL,
                        element_kind VARCHAR(30) NOT NULL,
                        seq_width INT UNSIGNED NULL DEFAULT NULL,
                        literal_text VARCHAR(50) NULL DEFAULT NULL,
                        preview_sample VARCHAR(20) NOT NULL DEFAULT '',
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                            ON UPDATE CURRENT_TIMESTAMP,
                        deleted_at DATETIME NULL DEFAULT NULL,
                        PRIMARY KEY (numbering_element_id),
                        UNIQUE KEY uk_numbering_elements_cd (numbering_element_cd)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """
                )
            )
        if not insp.has_table("m_numbering_patterns"):
            conn.execute(
                text(
                    """
                    CREATE TABLE m_numbering_patterns (
                        numbering_pattern_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                        numbering_pattern_cd VARCHAR(50) NOT NULL,
                        numbering_pattern_nm VARCHAR(100) NOT NULL,
                        element_1 VARCHAR(50) NULL DEFAULT NULL,
                        element_2 VARCHAR(50) NULL DEFAULT NULL,
                        element_3 VARCHAR(50) NULL DEFAULT NULL,
                        element_4 VARCHAR(50) NULL DEFAULT NULL,
                        element_5 VARCHAR(50) NULL DEFAULT NULL,
                        element_6 VARCHAR(50) NULL DEFAULT NULL,
                        element_7 VARCHAR(50) NULL DEFAULT NULL,
                        element_8 VARCHAR(50) NULL DEFAULT NULL,
                        element_9 VARCHAR(50) NULL DEFAULT NULL,
                        element_10 VARCHAR(50) NULL DEFAULT NULL,
                        seq_reset_scope ENUM('never', 'daily', 'monthly', 'yearly')
                            NOT NULL DEFAULT 'daily',
                        numbering_image VARCHAR(100) NOT NULL DEFAULT '',
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                            ON UPDATE CURRENT_TIMESTAMP,
                        deleted_at DATETIME NULL DEFAULT NULL,
                        PRIMARY KEY (numbering_pattern_id),
                        UNIQUE KEY uk_numbering_patterns_cd (numbering_pattern_cd)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """
                )
            )
        if not insp.has_table("m_numbering_sequences"):
            conn.execute(
                text(
                    """
                    CREATE TABLE m_numbering_sequences (
                        numbering_sequence_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                        numbering_pattern_id INT UNSIGNED NOT NULL,
                        scope_key VARCHAR(100) NOT NULL DEFAULT '',
                        period_key VARCHAR(20) NOT NULL DEFAULT '',
                        last_value INT UNSIGNED NOT NULL DEFAULT 0,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                            ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (numbering_sequence_id),
                        UNIQUE KEY uk_numbering_sequences_scope (
                            numbering_pattern_id, scope_key, period_key
                        ),
                        KEY idx_numbering_sequences_pattern (numbering_pattern_id),
                        CONSTRAINT fk_numbering_sequences_pattern
                            FOREIGN KEY (numbering_pattern_id)
                            REFERENCES m_numbering_patterns (numbering_pattern_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """
                )
            )
        if insp.has_table("m_items"):
            cols = {c["name"] for c in insp.get_columns("m_items")}
            if "numbering_pattern_id" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE m_items "
                        "ADD COLUMN numbering_pattern_id INT UNSIGNED NULL DEFAULT NULL "
                        "AFTER customer2_id"
                    )
                )
                cols.add("numbering_pattern_id")
            if "numbering_pattern_id" in cols:
                fk_rows = conn.execute(
                    text(
                        """
                        SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
                        WHERE TABLE_SCHEMA = DATABASE()
                          AND TABLE_NAME = 'm_items'
                          AND CONSTRAINT_NAME = 'fk_items_numbering_pattern'
                        """
                    )
                ).fetchall()
                if not fk_rows and insp.has_table("m_numbering_patterns"):
                    conn.execute(
                        text(
                            "ALTER TABLE m_items "
                            "ADD CONSTRAINT fk_items_numbering_pattern "
                            "FOREIGN KEY (numbering_pattern_id) "
                            "REFERENCES m_numbering_patterns (numbering_pattern_id)"
                        )
                    )


_TENANT_TABLES = (
    "m_locationtyps",
    "m_itemtyps",
    "m_suppliers",
    "m_customers",
    "m_locations",
    "m_numbering_elements",
    "m_numbering_patterns",
    "m_numbering_sequences",
    "m_items",
    "m_itemprocs",
    "m_itemproc_inputs",
    "m_itemproc_roots",
    "m_movetyps",
    "inv_currents",
    "inv_balances",
    "inv_grgi",
    "pch_receipt_draft",
    "pch_receipt_draft_lines",
    "sls_delivery_draft",
    "sls_delivery_draft_lines",
    "prd_orders",
    "prd_order_lines",
    "prd_order_inputs",
    "prd_order_outputs",
)


def _ensure_tenant_columns_on_table(conn, table: str) -> None:
    cols = {c["name"] for c in inspect(engine).get_columns(table)}
    if "co_id" not in cols:
        conn.execute(
            text(
                f"ALTER TABLE {table} "
                "ADD COLUMN co_id INT UNSIGNED NOT NULL DEFAULT 1"
            )
        )
        conn.execute(text(f"UPDATE {table} SET co_id = 1 WHERE co_id = 0"))
        cols.add("co_id")
    if "created_by" not in cols:
        conn.execute(
            text(
                f"ALTER TABLE {table} "
                "ADD COLUMN created_by INT UNSIGNED NULL DEFAULT NULL"
            )
        )
    if "updated_by" not in cols:
        conn.execute(
            text(
                f"ALTER TABLE {table} "
                "ADD COLUMN updated_by INT UNSIGNED NULL DEFAULT NULL"
            )
        )


def ensure_auth_and_tenant_columns() -> None:
    """Company/user masters, tenant columns on business tables, default login seed."""
    insp = inspect(engine)
    with engine.begin() as conn:
        if not insp.has_table("m_companies"):
            conn.execute(
                text(
                    """
                    CREATE TABLE m_companies (
                        co_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                        company_cd VARCHAR(50) NOT NULL,
                        company_nm VARCHAR(200) NOT NULL,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                            ON UPDATE CURRENT_TIMESTAMP,
                        deleted_at DATETIME NULL DEFAULT NULL,
                        PRIMARY KEY (co_id),
                        UNIQUE KEY uk_companies_cd (company_cd)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
            )
        if not insp.has_table("m_users"):
            conn.execute(
                text(
                    """
                    CREATE TABLE m_users (
                        user_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                        co_id INT UNSIGNED NOT NULL,
                        user_cd VARCHAR(50) NOT NULL,
                        user_nm VARCHAR(200) NOT NULL DEFAULT '',
                        password_hash VARCHAR(255) NOT NULL,
                        is_active TINYINT(1) NOT NULL DEFAULT 1,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                            ON UPDATE CURRENT_TIMESTAMP,
                        deleted_at DATETIME NULL DEFAULT NULL,
                        created_by INT UNSIGNED NULL DEFAULT NULL,
                        updated_by INT UNSIGNED NULL DEFAULT NULL,
                        PRIMARY KEY (user_id),
                        UNIQUE KEY uk_users_co_user_cd (co_id, user_cd),
                        KEY idx_users_co (co_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
            )
        co_count = conn.execute(text("SELECT COUNT(*) FROM m_companies")).scalar_one()
        if co_count == 0:
            conn.execute(
                text(
                    "INSERT INTO m_companies (company_cd, company_nm) VALUES ('DEMO', 'Demo Company')"
                )
            )
        co_id = conn.execute(
            text(
                "SELECT co_id FROM m_companies WHERE company_cd = 'DEMO' "
                "AND deleted_at IS NULL LIMIT 1"
            )
        ).scalar_one_or_none()
        if co_id is None:
            co_id = conn.execute(
                text(
                    "SELECT co_id FROM m_companies WHERE deleted_at IS NULL "
                    "ORDER BY co_id LIMIT 1"
                )
            ).scalar_one()
        user_count = conn.execute(
            text("SELECT COUNT(*) FROM m_users WHERE co_id = :co_id"),
            {"co_id": co_id},
        ).scalar_one()
        if user_count == 0:
            from app.auth_security import hash_password

            conn.execute(
                text(
                    """
                    INSERT INTO m_users (co_id, user_cd, user_nm, password_hash, is_active)
                    VALUES (:co_id, 'admin', 'Administrator', :ph, 1)
                    """
                ),
                {"co_id": co_id, "ph": hash_password("admin")},
            )

    for table in _TENANT_TABLES:
        if insp.has_table(table):
            with engine.begin() as conn:
                _ensure_tenant_columns_on_table(conn, table)
