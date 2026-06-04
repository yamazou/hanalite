-- hanalite Lot Traceability System
-- Database: hanalite

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- (1) Masters

CREATE TABLE IF NOT EXISTS m_itemtyps (
    itemtyp_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    itemtyp_cd   VARCHAR(50) NOT NULL,
    itemtyp_nm   VARCHAR(100) NOT NULL,
    itemtyp_color VARCHAR(7) NULL DEFAULT NULL,
    locationtyp_id INT UNSIGNED NULL DEFAULT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (itemtyp_id),
    KEY idx_itemtyps_locationtyp (locationtyp_id),
    CONSTRAINT fk_itemtyps_locationtyp FOREIGN KEY (locationtyp_id) REFERENCES m_locationtyps (locationtyp_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS m_suppliers (
    suppliers_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    suppliers_cd VARCHAR(50) NOT NULL,
    suppliers_nm VARCHAR(200) NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (suppliers_id),
    UNIQUE KEY uk_suppliers_cd (suppliers_cd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS m_customers (
    customers_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    customers_cd VARCHAR(50) NOT NULL,
    customers_nm VARCHAR(200) NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (customers_id),
    UNIQUE KEY uk_customers_cd (customers_cd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS m_locationtyps (
    locationtyp_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    locationtyp_cd VARCHAR(50) NOT NULL,
    locationtyp_nm VARCHAR(100) NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (locationtyp_id),
    UNIQUE KEY uk_locationtyps_cd (locationtyp_cd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS m_movetyps (
    movetyps_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    movetyps_cd  VARCHAR(50)  NOT NULL,
    movetyps_nm  VARCHAR(100) NULL DEFAULT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (movetyps_id),
    UNIQUE KEY uk_movetyps_cd (movetyps_cd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS m_locations (
    location_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
    location_cd     VARCHAR(50)  NOT NULL,
    location_nm     VARCHAR(200) NOT NULL,
    locationtyp_id  INT UNSIGNED NULL DEFAULT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (location_id),
    UNIQUE KEY uk_locations_cd (location_cd),
    UNIQUE KEY uk_locations_nm (location_nm),
    KEY idx_locations_locationtyp (locationtyp_id),
    CONSTRAINT fk_locations_locationtyp FOREIGN KEY (locationtyp_id) REFERENCES m_locationtyps (locationtyp_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS m_items (
    item_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    item_cd      VARCHAR(50)  NOT NULL COMMENT 'Business item code (unique)',
    item_nm      VARCHAR(200) NOT NULL,
    itemtyp_id   INT UNSIGNED NULL,
    supplier1_id INT UNSIGNED NULL DEFAULT NULL,
    supplier2_id INT UNSIGNED NULL DEFAULT NULL,
    supplier3_id INT UNSIGNED NULL DEFAULT NULL,
    customer1_id INT UNSIGNED NULL DEFAULT NULL,
    customer2_id INT UNSIGNED NULL DEFAULT NULL,
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
    CONSTRAINT fk_items_customer1 FOREIGN KEY (customer1_id) REFERENCES m_customers (customers_id),
    CONSTRAINT fk_items_customer2 FOREIGN KEY (customer2_id) REFERENCES m_customers (customers_id)
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
INSERT INTO m_movetyps (movetyps_cd) VALUES ('GR'), ('GI'), ('MV')
ON DUPLICATE KEY UPDATE movetyps_cd = VALUES(movetyps_cd);

INSERT INTO m_locationtyps (locationtyp_cd, locationtyp_nm) VALUES
    ('RM', 'Raw Material'),
    ('Process', 'Process'),
    ('NG', 'NG'),
    ('FG', 'Finished Goods')
ON DUPLICATE KEY UPDATE locationtyp_nm = VALUES(locationtyp_nm);

INSERT INTO m_locations (location_cd, location_nm, locationtyp_id)
SELECT 'MAIN', 'Main Location', t.locationtyp_id
FROM m_locationtyps t
WHERE t.locationtyp_cd = 'Process' AND t.deleted_at IS NULL
LIMIT 1
ON DUPLICATE KEY UPDATE
    location_nm = VALUES(location_nm),
    locationtyp_id = VALUES(locationtyp_id);

INSERT INTO m_itemtyps (itemtyp_cd, itemtyp_nm) VALUES
    ('RM', 'Raw Material'),
    ('PURCHASE', 'Purchase parts'),
    ('WIP', 'Work in Process'),
    ('FG', 'Finished Goods')
ON DUPLICATE KEY UPDATE
    itemtyp_cd = VALUES(itemtyp_cd),
    itemtyp_nm = VALUES(itemtyp_nm);
