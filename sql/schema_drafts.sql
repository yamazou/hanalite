-- hanalite: Receipt draft tables (approval workflow)
-- Run after schema.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS pch_receipt_draft (
    inv_receipt_draft_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    status               ENUM('registered', 'approved', 'cancelled') NOT NULL DEFAULT 'registered',
    receipt_at           DATETIME NOT NULL,
    suppliers_id         INT UNSIGNED NULL DEFAULT NULL,
    reference_no         VARCHAR(100) NULL DEFAULT NULL COMMENT 'PO / delivery note no.',
    notes                TEXT NULL,
    approved_at          DATETIME NULL DEFAULT NULL,
    cancelled_at         DATETIME NULL DEFAULT NULL,
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at           DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (inv_receipt_draft_id),
    KEY idx_receipt_drafts_status (status),
    KEY idx_receipt_drafts_receipt_at (receipt_at),
    CONSTRAINT fk_receipt_drafts_supplier FOREIGN KEY (suppliers_id) REFERENCES m_suppliers (suppliers_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pch_receipt_draft_lines (
    inv_receipt_draft_line_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    inv_receipt_draft_id      INT UNSIGNED NOT NULL,
    line_no                   INT UNSIGNED NOT NULL DEFAULT 1,
    item_id                   INT UNSIGNED NOT NULL,
    location_id               INT UNSIGNED NOT NULL,
    lot                       VARCHAR(50) NOT NULL,
    qty                       DECIMAL(15, 3) NOT NULL,
    created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at                DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (inv_receipt_draft_line_id),
    KEY idx_draft_lines_draft (inv_receipt_draft_id),
    CONSTRAINT fk_draft_lines_draft FOREIGN KEY (inv_receipt_draft_id) REFERENCES pch_receipt_draft (inv_receipt_draft_id),
    CONSTRAINT fk_draft_lines_item FOREIGN KEY (item_id) REFERENCES m_items (item_id),
    CONSTRAINT fk_draft_lines_location FOREIGN KEY (location_id) REFERENCES m_locations (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sls_delivery_draft (
    sls_delivery_draft_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    status                ENUM('registered', 'approved', 'cancelled') NOT NULL DEFAULT 'registered',
    source_type           ENUM('manual', 'excel') NOT NULL DEFAULT 'manual',
    delivery_at           DATETIME NOT NULL,
    suppliers_id          INT UNSIGNED NULL DEFAULT NULL,
    reference_no          VARCHAR(100) NULL DEFAULT NULL COMMENT 'SO / delivery note no.',
    notes                 TEXT NULL,
    approved_at           DATETIME NULL DEFAULT NULL,
    cancelled_at          DATETIME NULL DEFAULT NULL,
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at            DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (sls_delivery_draft_id),
    KEY idx_delivery_drafts_status (status),
    KEY idx_delivery_drafts_delivery_at (delivery_at),
    CONSTRAINT fk_delivery_drafts_supplier FOREIGN KEY (suppliers_id) REFERENCES m_suppliers (suppliers_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sls_delivery_draft_lines (
    sls_delivery_draft_line_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    sls_delivery_draft_id      INT UNSIGNED NOT NULL,
    line_no                    INT UNSIGNED NOT NULL DEFAULT 1,
    item_id                    INT UNSIGNED NOT NULL,
    location_id                INT UNSIGNED NOT NULL,
    lot                        VARCHAR(50) NOT NULL,
    qty                        DECIMAL(15, 3) NOT NULL,
    created_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at                 DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (sls_delivery_draft_line_id),
    KEY idx_delivery_lines_draft (sls_delivery_draft_id),
    CONSTRAINT fk_delivery_lines_draft FOREIGN KEY (sls_delivery_draft_id) REFERENCES sls_delivery_draft (sls_delivery_draft_id),
    CONSTRAINT fk_delivery_lines_item FOREIGN KEY (item_id) REFERENCES m_items (item_id),
    CONSTRAINT fk_delivery_lines_location FOREIGN KEY (location_id) REFERENCES m_locations (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Link approved/cancelled movements back to draft (audit).
-- Skip if column already exists.
-- ALTER TABLE inv_grgi ADD COLUMN inv_receipt_draft_id INT UNSIGNED NULL DEFAULT NULL AFTER movetyps_id;
-- ALTER TABLE inv_grgi ADD KEY idx_inv_grgi_receipt_draft (inv_receipt_draft_id);

INSERT INTO m_movetyps (movetyps_cd) VALUES ('CAN')
ON DUPLICATE KEY UPDATE movetyps_cd = VALUES(movetyps_cd);
