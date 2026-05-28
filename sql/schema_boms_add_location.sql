-- Add location to existing BOM table
-- Run once on existing DBs

SET NAMES utf8mb4;

ALTER TABLE m_boms
  ADD COLUMN location_id INT UNSIGNED NOT NULL AFTER c_item_id;

ALTER TABLE m_boms
  ADD KEY idx_boms_location (location_id);

ALTER TABLE m_boms
  ADD CONSTRAINT fk_boms_location
    FOREIGN KEY (location_id) REFERENCES m_locations (location_id);

ALTER TABLE m_boms
  DROP INDEX uk_boms_parent_child;

ALTER TABLE m_boms
  ADD UNIQUE KEY uk_boms_parent_child_loc (p_item_id, c_item_id, location_id);
