-- hanalite: Bill of Materials (parent item -> child item + required qty)
-- Run after schema.sql and schema_item_cd.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS m_boms (
    bom_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    p_item_id   INT UNSIGNED NOT NULL COMMENT 'Parent item (e.g. FG)',
    c_item_id   INT UNSIGNED NOT NULL COMMENT 'Child item (e.g. RM)',
    level       INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'BOM process level/order',
    from_location_id INT UNSIGNED NOT NULL COMMENT 'Issue location of child item',
    to_location_id   INT UNSIGNED NOT NULL COMMENT 'Receive location after process',
    c_req_qty   DECIMAL(15, 3) NOT NULL COMMENT 'Required qty of child per parent',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (bom_id),
    UNIQUE KEY uk_boms_parent_child_from_to (p_item_id, c_item_id, from_location_id, to_location_id),
    KEY idx_boms_parent (p_item_id),
    KEY idx_boms_child (c_item_id),
    KEY idx_boms_from_location (from_location_id),
    KEY idx_boms_to_location (to_location_id),
    CONSTRAINT fk_boms_parent FOREIGN KEY (p_item_id) REFERENCES m_items (item_id),
    CONSTRAINT fk_boms_child FOREIGN KEY (c_item_id) REFERENCES m_items (item_id),
    CONSTRAINT fk_boms_from_location FOREIGN KEY (from_location_id) REFERENCES m_locations (location_id),
    CONSTRAINT fk_boms_to_location FOREIGN KEY (to_location_id) REFERENCES m_locations (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
