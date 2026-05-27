-- hanalite: Bill of Materials (parent item -> child item + required qty)
-- Run after schema.sql and schema_item_cd.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS boms (
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
    CONSTRAINT fk_boms_parent FOREIGN KEY (p_item_id) REFERENCES items (item_id),
    CONSTRAINT fk_boms_child FOREIGN KEY (c_item_id) REFERENCES items (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
