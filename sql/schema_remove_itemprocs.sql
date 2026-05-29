-- Remove item process master and related dependencies
-- Run once on existing DBs that already migrated to BOM-based production lines

SET NAMES utf8mb4;

ALTER TABLE prd_order_lines
  DROP FOREIGN KEY fk_prd_order_lines_itemproc;

ALTER TABLE prd_order_lines
  DROP INDEX idx_prd_order_lines_itemproc;

ALTER TABLE prd_order_lines
  DROP COLUMN itemproc_id;

DROP TABLE IF EXISTS m_itemprocs;
