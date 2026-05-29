-- Convert BOM location -> from/to locations on existing DBs
-- Run once after schema_boms.sql updates

SET NAMES utf8mb4;

ALTER TABLE m_boms
  ADD COLUMN level INT UNSIGNED NOT NULL DEFAULT 0 AFTER c_item_id;

ALTER TABLE m_boms
  CHANGE COLUMN location_id from_location_id INT UNSIGNED NOT NULL;

ALTER TABLE m_boms
  ADD COLUMN to_location_id INT UNSIGNED NOT NULL AFTER from_location_id;

UPDATE m_boms b
SET b.to_location_id = b.from_location_id
WHERE b.to_location_id = 0;

ALTER TABLE m_boms
  DROP FOREIGN KEY fk_boms_location;

ALTER TABLE m_boms
  DROP INDEX idx_boms_location;

ALTER TABLE m_boms
  DROP INDEX uk_boms_parent_child_loc;

ALTER TABLE m_boms
  ADD KEY idx_boms_from_location (from_location_id),
  ADD KEY idx_boms_to_location (to_location_id),
  ADD CONSTRAINT fk_boms_from_location FOREIGN KEY (from_location_id) REFERENCES m_locations (location_id),
  ADD CONSTRAINT fk_boms_to_location FOREIGN KEY (to_location_id) REFERENCES m_locations (location_id),
  ADD UNIQUE KEY uk_boms_parent_child_from_to (p_item_id, c_item_id, from_location_id, to_location_id);
