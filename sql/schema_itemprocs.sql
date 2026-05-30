-- hanalite: Item process master (FG item -> process steps + RM inputs)
-- Run after schema.sql, schema_locations.sql, and schema_boms.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS m_itemprocs (
    itemproc_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    item_id          INT UNSIGNED NOT NULL COMMENT 'FG / parent item',
    line_no          INT UNSIGNED NOT NULL COMMENT 'Process step order',
    wip_location_id  INT UNSIGNED NOT NULL COMMENT 'Process (WIP) location',
    rm_location_id   INT UNSIGNED NOT NULL COMMENT 'Issue / RM location for step',
    output_item_id   INT UNSIGNED NOT NULL COMMENT 'Output item produced at step',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS m_itemproc_inputs (
    itemproc_input_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    itemproc_id       INT UNSIGNED NOT NULL,
    input_no          INT UNSIGNED NOT NULL COMMENT 'Input line within process step',
    item_id           INT UNSIGNED NOT NULL COMMENT 'Input item (RM / purchase / WIP)',
    from_location_id  INT UNSIGNED NOT NULL COMMENT 'Issue location for input',
    req_qty           DECIMAL(15, 3) NOT NULL COMMENT 'Required qty per 1 FG',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
