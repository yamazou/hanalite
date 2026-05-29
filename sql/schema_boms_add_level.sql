-- Add level column to BOM and backfill default order
-- Run once on existing DBs already using from/to locations

SET NAMES utf8mb4;

ALTER TABLE m_boms
  ADD COLUMN level INT UNSIGNED NOT NULL DEFAULT 0 AFTER c_item_id;

UPDATE m_boms
SET level = 0
WHERE level IS NULL;
