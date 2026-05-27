-- hanalite Lot Traceability System
-- Database: hanalite

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- (1) Masters

CREATE TABLE IF NOT EXISTS m_itemtyps (
    itemtyp_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    itemtyp_nm   VARCHAR(100) NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (itemtyp_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS m_suppliers (
    suppliers_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    suppliers_nm VARCHAR(200) NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (suppliers_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS m_movetyps (
    movetyps_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    movetyps_nm  VARCHAR(50)  NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (movetyps_id),
    UNIQUE KEY uk_movetyps_nm (movetyps_nm)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS m_locations (
    location_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    location_cd   VARCHAR(50)  NOT NULL,
    location_nm   VARCHAR(200) NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at    DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (location_id),
    UNIQUE KEY uk_locations_cd (location_cd),
    UNIQUE KEY uk_locations_nm (location_nm)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS m_items (
    item_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    item_cd      VARCHAR(50)  NOT NULL COMMENT 'Business item code (unique)',
    item_nm      VARCHAR(200) NOT NULL,
    itemtyp_id   INT UNSIGNED NOT NULL,
    supplier1_id INT UNSIGNED NULL DEFAULT NULL,
    supplier2_id INT UNSIGNED NULL DEFAULT NULL,
    supplier3_id INT UNSIGNED NULL DEFAULT NULL,
    supplier4_id INT UNSIGNED NULL DEFAULT NULL,
    supplier5_id INT UNSIGNED NULL DEFAULT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (item_id),
    UNIQUE KEY uk_items_item_cd (item_cd),
    KEY idx_items_itemtyp (itemtyp_id),
    KEY idx_items_supplier1 (supplier1_id),
    CONSTRAINT fk_items_itemtyp FOREIGN KEY (itemtyp_id) REFERENCES m_itemtyps (itemtyp_id),
    CONSTRAINT fk_items_supplier1 FOREIGN KEY (supplier1_id) REFERENCES m_suppliers (suppliers_id),
    CONSTRAINT fk_items_supplier2 FOREIGN KEY (supplier2_id) REFERENCES m_suppliers (suppliers_id),
    CONSTRAINT fk_items_supplier3 FOREIGN KEY (supplier3_id) REFERENCES m_suppliers (suppliers_id),
    CONSTRAINT fk_items_supplier4 FOREIGN KEY (supplier4_id) REFERENCES m_suppliers (suppliers_id),
    CONSTRAINT fk_items_supplier5 FOREIGN KEY (supplier5_id) REFERENCES m_suppliers (suppliers_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS m_boms (
    bom_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    p_item_id   INT UNSIGNED NOT NULL COMMENT 'Parent item (e.g. FG)',
    c_item_id   INT UNSIGNED NOT NULL COMMENT 'Child item (e.g. RM)',
    c_req_qty   DECIMAL(15, 3) NOT NULL COMMENT 'Required qty of child per parent',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (bom_id),
    UNIQUE KEY uk_boms_parent_child (p_item_id, c_item_id),
    KEY idx_boms_parent (p_item_id),
    KEY idx_boms_child (c_item_id),
    CONSTRAINT fk_boms_parent FOREIGN KEY (p_item_id) REFERENCES m_items (item_id),
    CONSTRAINT fk_boms_child FOREIGN KEY (c_item_id) REFERENCES m_items (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- (2) Transactions

CREATE TABLE IF NOT EXISTS inv_currents (
    inv_current_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    item_id        INT UNSIGNED NOT NULL,
    location_id    INT UNSIGNED NOT NULL,
    qty            DECIMAL(15, 3) NOT NULL DEFAULT 0,
    lot            VARCHAR(50)    NOT NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at     DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (inv_current_id),
    UNIQUE KEY uk_inv_currents_item_loc_lot (item_id, location_id, lot),
    KEY idx_inv_currents_lot (lot),
    CONSTRAINT fk_inv_currents_item FOREIGN KEY (item_id) REFERENCES m_items (item_id),
    CONSTRAINT fk_inv_currents_location FOREIGN KEY (location_id) REFERENCES m_locations (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inv_grgi (
    inv_grgi_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    item_id      INT UNSIGNED NOT NULL,
    location_id  INT UNSIGNED NOT NULL,
    qty          DECIMAL(15, 3) NOT NULL DEFAULT 0 COMMENT 'Balance after movement',
    lot          VARCHAR(50)    NOT NULL,
    move_qty     DECIMAL(15, 3) NOT NULL DEFAULT 0,
    movetyps_id  INT UNSIGNED NOT NULL,
    actual_at    DATETIME NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (inv_grgi_id),
    KEY idx_inv_grgi_item (item_id),
    KEY idx_inv_grgi_location (location_id),
    KEY idx_inv_grgi_lot (lot),
    KEY idx_inv_grgi_actual_at (actual_at),
    CONSTRAINT fk_inv_grgi_item FOREIGN KEY (item_id) REFERENCES m_items (item_id),
    CONSTRAINT fk_inv_grgi_location FOREIGN KEY (location_id) REFERENCES m_locations (location_id),
    CONSTRAINT fk_inv_grgi_movetyp FOREIGN KEY (movetyps_id) REFERENCES m_movetyps (movetyps_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inv_balances (
    inv_balance_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    period_year_month CHAR(6)   NOT NULL COMMENT 'YYYYMM',
    item_id          INT UNSIGNED NOT NULL,
    location_id      INT UNSIGNED NOT NULL,
    qty              DECIMAL(15, 3) NOT NULL DEFAULT 0,
    lot              VARCHAR(50)    NOT NULL,
    beg_at           DATETIME NOT NULL,
    beg_qty          DECIMAL(15, 3) NOT NULL DEFAULT 0,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at       DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (inv_balance_id),
    UNIQUE KEY uk_inv_balances_period_item_loc_lot (period_year_month, item_id, location_id, lot),
    KEY idx_inv_balances_lot (lot),
    CONSTRAINT fk_inv_balances_item FOREIGN KEY (item_id) REFERENCES m_items (item_id),
    CONSTRAINT fk_inv_balances_location FOREIGN KEY (location_id) REFERENCES m_locations (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Seed data
INSERT INTO m_movetyps (movetyps_nm) VALUES ('GR'), ('GI'), ('MV')
ON DUPLICATE KEY UPDATE movetyps_nm = VALUES(movetyps_nm);

INSERT INTO m_locations (location_cd, location_nm) VALUES ('MAIN', 'Main Location')
ON DUPLICATE KEY UPDATE location_nm = VALUES(location_nm);

INSERT INTO m_itemtyps (itemtyp_nm) VALUES
    ('RM'), ('Purchase parts'), ('WIP'), ('FG')
ON DUPLICATE KEY UPDATE itemtyp_nm = VALUES(itemtyp_nm);
