-- hanalite: introduce location dimension to inventory and drafts
-- Run on existing DB after schema_locations.sql

SET NAMES utf8mb4;

INSERT INTO m_locations (location_cd, location_nm) VALUES ('MAIN', 'Main Location')
ON DUPLICATE KEY UPDATE location_nm = VALUES(location_nm);

INSERT INTO m_movetyps (movetyps_cd) VALUES ('MV')
ON DUPLICATE KEY UPDATE movetyps_cd = VALUES(movetyps_cd);

ALTER TABLE inv_currents
    ADD COLUMN IF NOT EXISTS location_id INT UNSIGNED NULL AFTER item_id;
UPDATE inv_currents
SET location_id = (SELECT location_id FROM m_locations WHERE deleted_at IS NULL ORDER BY location_id LIMIT 1)
WHERE location_id IS NULL;
ALTER TABLE inv_currents
    MODIFY COLUMN location_id INT UNSIGNED NOT NULL;
ALTER TABLE inv_currents
    DROP INDEX uk_inv_currents_item_lot,
    ADD UNIQUE KEY uk_inv_currents_item_loc_lot (item_id, location_id, lot),
    ADD CONSTRAINT fk_inv_currents_location FOREIGN KEY (location_id) REFERENCES m_locations (location_id);

ALTER TABLE inv_grgi
    ADD COLUMN IF NOT EXISTS location_id INT UNSIGNED NULL AFTER item_id;
UPDATE inv_grgi
SET location_id = (SELECT location_id FROM m_locations WHERE deleted_at IS NULL ORDER BY location_id LIMIT 1)
WHERE location_id IS NULL;
ALTER TABLE inv_grgi
    MODIFY COLUMN location_id INT UNSIGNED NOT NULL,
    ADD KEY idx_inv_grgi_location (location_id),
    ADD CONSTRAINT fk_inv_grgi_location FOREIGN KEY (location_id) REFERENCES m_locations (location_id);

ALTER TABLE inv_balances
    ADD COLUMN IF NOT EXISTS location_id INT UNSIGNED NULL AFTER item_id;
UPDATE inv_balances
SET location_id = (SELECT location_id FROM m_locations WHERE deleted_at IS NULL ORDER BY location_id LIMIT 1)
WHERE location_id IS NULL;
ALTER TABLE inv_balances
    MODIFY COLUMN location_id INT UNSIGNED NOT NULL;
ALTER TABLE inv_balances
    DROP INDEX uk_inv_balances_period_item_lot,
    ADD UNIQUE KEY uk_inv_balances_period_item_loc_lot (period_year_month, item_id, location_id, lot),
    ADD CONSTRAINT fk_inv_balances_location FOREIGN KEY (location_id) REFERENCES m_locations (location_id);

ALTER TABLE pch_receipt_draft_lines
    ADD COLUMN IF NOT EXISTS location_id INT UNSIGNED NULL AFTER item_id;
UPDATE pch_receipt_draft_lines
SET location_id = (SELECT location_id FROM m_locations WHERE deleted_at IS NULL ORDER BY location_id LIMIT 1)
WHERE location_id IS NULL;
ALTER TABLE pch_receipt_draft_lines
    MODIFY COLUMN location_id INT UNSIGNED NOT NULL,
    ADD CONSTRAINT fk_draft_lines_location FOREIGN KEY (location_id) REFERENCES m_locations (location_id);

ALTER TABLE sls_delivery_draft_lines
    ADD COLUMN IF NOT EXISTS location_id INT UNSIGNED NULL AFTER item_id;
UPDATE sls_delivery_draft_lines
SET location_id = (SELECT location_id FROM m_locations WHERE deleted_at IS NULL ORDER BY location_id LIMIT 1)
WHERE location_id IS NULL;
ALTER TABLE sls_delivery_draft_lines
    MODIFY COLUMN location_id INT UNSIGNED NOT NULL,
    ADD CONSTRAINT fk_delivery_lines_location FOREIGN KEY (location_id) REFERENCES m_locations (location_id);
